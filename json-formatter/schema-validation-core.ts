/**
 * JSON Schema validation compute core.
 *
 * This module is imported only by the schema-validation worker chunk. The
 * formatter's main bundle deliberately imports its public types only, so Ajv
 * and json-source-map never become part of the initial formatter traffic.
 */
import Ajv, { type ErrorObject } from 'ajv';
import Ajv2020 from 'ajv/dist/2020';
import { parse, type Mapping, type Pointers } from 'json-source-map';
import { indexFromErrorMessage, lineColumnFromIndex } from './json-format-core';

export const MAX_SCHEMA_BYTES = 256 * 1024;
export const MAX_SCHEMA_DEPTH = 100;

export type SchemaDraft = 'auto' | 'draft-07' | '2020-12';
export type SupportedSchemaDraft = Exclude<SchemaDraft, 'auto'>;

export interface SchemaValidationRequest {
    /** Raw JSON from the formatter input textarea. */
    data: string;
    /** Raw JSON Schema text from the optional schema textarea. */
    schema: string;
    /** Auto-detect from `$schema`, or explicitly select a supported draft. */
    draft?: SchemaDraft;
}

export interface SchemaDiagnostic {
    /** JSON Pointer into the data document (RFC 6901). */
    pointer: string;
    /** JSON Schema keyword that failed. */
    rule: string;
    /** Human-readable, stable diagnostic message. */
    message: string;
    /** 1-based source position in the raw data document. */
    line: number;
    /** 1-based source position in the raw data document. */
    column: number;
}

export type SchemaValidationResult =
    | {
          outcome: 'valid';
          draft: SupportedSchemaDraft;
          /**
           * Draft 2020-12 keywords the schema uses that Draft 7 does not
           * enforce. Only reported when Draft 7 was the no-`$schema` fallback,
           * since then the user never chose to have them ignored.
           */
          ignoredKeywords?: string[];
      }
    | { outcome: 'invalid-data'; draft: SupportedSchemaDraft; diagnostic: SchemaDiagnostic }
    | {
          outcome: 'invalid-json';
          message: string;
          line?: number;
          column?: number;
      }
    | {
          outcome: 'invalid-schema';
          message: string;
          line?: number;
          column?: number;
      }
    | {
          outcome: 'unsupported-draft';
          message: string;
          declared?: string;
      }
    | { outcome: 'unavailable'; message: string };

interface ParsedJson {
    data: unknown;
    pointers: Pointers;
}

interface ParseFailure {
    message: string;
    line?: number;
    column?: number;
}

const DRAFT_07_DECLARATIONS = new Set([
    'http://json-schema.org/draft-07/schema',
    'http://json-schema.org/draft-07/schema#',
    'https://json-schema.org/draft-07/schema',
    'https://json-schema.org/draft-07/schema#'
]);

const DRAFT_2020_DECLARATIONS = new Set([
    'http://json-schema.org/draft/2020-12/schema',
    'http://json-schema.org/draft/2020-12/schema#',
    'https://json-schema.org/draft/2020-12/schema',
    'https://json-schema.org/draft/2020-12/schema#'
]);

const SCHEMA_VALUE_KEYWORDS = new Set([
    'additionalItems',
    'additionalProperties',
    'contains',
    'contentSchema',
    'else',
    'if',
    'items',
    'not',
    'propertyNames',
    'then',
    'unevaluatedItems',
    'unevaluatedProperties'
]);

const SCHEMA_ARRAY_KEYWORDS = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']);

const SCHEMA_MAP_KEYWORDS = new Set([
    '$defs',
    'definitions',
    'dependentSchemas',
    'patternProperties',
    'properties'
]);

function parseJson(text: string): ParsedJson | ParseFailure {
    try {
        return parse(text);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const index = indexFromErrorMessage(message, text);
        return {
            message,
            ...(index === null ? {} : lineColumnFromIndex(text, index))
        };
    }
}

function isParseFailure(value: ParsedJson | ParseFailure): value is ParseFailure {
    return typeof (value as ParseFailure).message === 'string';
}

function utf8ByteLength(text: string): number {
    return new TextEncoder().encode(text).byteLength;
}

function schemaDepth(schema: unknown): number {
    const stack: Array<{ value: unknown; depth: number }> = [{ value: schema, depth: 0 }];
    let deepest = 0;

    while (stack.length > 0) {
        const current = stack.pop()!;
        deepest = Math.max(deepest, current.depth);
        if (deepest > MAX_SCHEMA_DEPTH) return deepest;

        if (Array.isArray(current.value)) {
            for (const child of current.value) {
                stack.push({ value: child, depth: current.depth + 1 });
            }
        } else if (current.value !== null && typeof current.value === 'object') {
            for (const child of Object.values(current.value)) {
                stack.push({ value: child, depth: current.depth + 1 });
            }
        }
    }
    return deepest;
}

/**
 * Visit every schema object, walking only schema-bearing positions. Values
 * under `const`, `enum`, `default`, and `examples` are data, and the keys of
 * `properties`-style maps are names, so neither is mistaken for a keyword.
 * `visit` returns true to stop the walk early.
 */
function walkSchemaObjects(schema: unknown, visit: (node: Record<string, unknown>) => boolean): void {
    let stopped = false;

    const visitSchemaMap = (value: unknown): void => {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return;
        for (const child of Object.values(value)) {
            if (stopped) return;
            visitSchema(child);
        }
    };

    const visitSchema = (value: unknown): void => {
        if (stopped) return;
        if (Array.isArray(value)) {
            for (const child of value) visitSchema(child);
            return;
        }
        if (value === null || typeof value !== 'object') return;

        const node = value as Record<string, unknown>;
        if (visit(node)) {
            stopped = true;
            return;
        }

        for (const [key, child] of Object.entries(node)) {
            if (SCHEMA_MAP_KEYWORDS.has(key)) {
                visitSchemaMap(child);
            } else if (SCHEMA_ARRAY_KEYWORDS.has(key) || SCHEMA_VALUE_KEYWORDS.has(key)) {
                visitSchema(child);
            } else if (key === 'dependencies' && child !== null && typeof child === 'object' && !Array.isArray(child)) {
                // Draft 7 dependencies can be either string arrays or schemas.
                visitSchemaMap(child);
            }
        }
    };

    visitSchema(schema);
}

function findExternalReference(schema: unknown): string | null {
    let external: string | null = null;
    walkSchemaObjects(schema, (node) => {
        for (const key of ['$ref', '$dynamicRef', '$recursiveRef']) {
            const reference = node[key];
            if (typeof reference === 'string' && !reference.startsWith('#')) {
                external = reference;
                return true;
            }
        }
        return false;
    });
    return external;
}

/**
 * Keywords Draft 2020-12 added that the Draft 7 validator does not enforce:
 * Ajv's Draft 7 build silently skips them (verified per keyword), so a schema
 * relying on one can pass data it was written to reject.
 */
const DRAFT_2020_ONLY_KEYWORDS = [
    '$anchor',
    '$dynamicAnchor',
    '$dynamicRef',
    'dependentRequired',
    'dependentSchemas',
    'maxContains',
    'minContains',
    'prefixItems',
    'unevaluatedItems',
    'unevaluatedProperties'
];

function findDraft2020OnlyKeywords(schema: unknown): string[] {
    const found = new Set<string>();
    walkSchemaObjects(schema, (node) => {
        for (const keyword of DRAFT_2020_ONLY_KEYWORDS) {
            if (Object.prototype.hasOwnProperty.call(node, keyword)) found.add(keyword);
        }
        return false;
    });
    return DRAFT_2020_ONLY_KEYWORDS.filter((keyword) => found.has(keyword));
}

function declaredDraft(schema: unknown): { draft?: SupportedSchemaDraft; declared?: string; error?: string } {
    if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
        return {};
    }

    const declaration = (schema as Record<string, unknown>).$schema;
    if (declaration === undefined) return {};
    if (typeof declaration !== 'string') {
        return { error: 'The $schema declaration must be a string.' };
    }
    if (DRAFT_07_DECLARATIONS.has(declaration)) return { draft: 'draft-07', declared: declaration };
    if (DRAFT_2020_DECLARATIONS.has(declaration)) return { draft: '2020-12', declared: declaration };
    return { declared: declaration };
}

function resolveDraft(schema: unknown, requested: SchemaDraft | undefined):
    | { draft: SupportedSchemaDraft; declared?: string; fallback?: true }
    | { unsupported: true; declared?: string }
    | { invalidSchema: true; message: string } {
    const declaration = declaredDraft(schema);
    if (declaration.error) {
        return { invalidSchema: true, message: declaration.error };
    }

    if (requested === 'draft-07' || requested === '2020-12') {
        return { draft: requested, declared: declaration.declared };
    }
    if (declaration.draft) return { draft: declaration.draft, declared: declaration.declared };
    if (declaration.declared) return { unsupported: true, declared: declaration.declared };
    return { draft: 'draft-07', fallback: true };
}

function rfc6901Segment(segment: string): string {
    return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function appendPointer(pointer: string, segment: string): string {
    return `${pointer}/${rfc6901Segment(segment)}`;
}

function sourceLocation(pointers: Pointers, pointer: string, preferKey = false): { line: number; column: number } {
    const mapping: Mapping | undefined = pointers[pointer] ?? pointers[''];
    const location = preferKey ? mapping?.key ?? mapping?.value : mapping?.value;
    return {
        line: (location?.line ?? 0) + 1,
        column: (location?.column ?? 0) + 1
    };
}

function firstDiagnostic(error: ErrorObject, pointers: Pointers): SchemaDiagnostic {
    const instancePath = error.instancePath || '';
    let pointer = instancePath;
    let preferKey = false;

    if (error.keyword === 'required') {
        pointer = instancePath;
    } else if (error.keyword === 'additionalProperties') {
        const property = typeof error.params?.additionalProperty === 'string'
            ? error.params.additionalProperty
            : '';
        pointer = appendPointer(instancePath, property);
        preferKey = true;
    }

    const location = sourceLocation(pointers, pointer, preferKey);
    return {
        pointer,
        rule: error.keyword,
        message: error.message ? `must ${error.message.replace(/^must\s+/, '')}` : 'does not satisfy the schema',
        ...location
    };
}

function makeAjv(draft: SupportedSchemaDraft): Ajv {
    const options = {
        // The draft meta-schema is the source of truth for schema validity.
        // Ajv's strict throwing mode rejects draft-valid schemas that omit
        // optional type declarations, use tuple syntax, or carry annotations.
        strict: false,
        validateSchema: true,
        allErrors: false,
        validateFormats: false,
        coerceTypes: false,
        useDefaults: false,
        removeAdditional: false
    } as const;
    return draft === '2020-12' ? new Ajv2020(options) : new Ajv(options);
}

function schemaForCompile(schema: unknown, draft: SupportedSchemaDraft): unknown {
    if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) return schema;

    // Ajv registers Draft 7 under its historical HTTP URI and Draft 2020-12
    // under the canonical HTTPS URI. Always rewrite the copied root so both
    // HTTP/HTTPS declarations and an explicit draft override compile against
    // the selected Ajv class without mutating the user's parsed schema.
    return {
        ...(schema as Record<string, unknown>),
        $schema: draft === 'draft-07'
            ? 'http://json-schema.org/draft-07/schema#'
            : 'https://json-schema.org/draft/2020-12/schema'
    };
}

function invalidSchema(message: string, line?: number, column?: number): SchemaValidationResult {
    return { outcome: 'invalid-schema', message, ...(line === undefined ? {} : { line, column }) };
}

export function validateJsonSchema(request: SchemaValidationRequest): SchemaValidationResult {
    if (utf8ByteLength(request.schema) > MAX_SCHEMA_BYTES) {
        return invalidSchema('Schema is too large (maximum 256 KiB).');
    }

    if (!request.schema.trim()) {
        return invalidSchema('Schema is empty.');
    }

    const schemaParsed = parseJson(request.schema);
    if (isParseFailure(schemaParsed)) {
        return invalidSchema(`Invalid JSON Schema: ${schemaParsed.message}`, schemaParsed.line, schemaParsed.column);
    }

    if (schemaDepth(schemaParsed.data) > MAX_SCHEMA_DEPTH) {
        return invalidSchema('Schema is too deeply nested (maximum depth is 100).');
    }

    const externalReference = findExternalReference(schemaParsed.data);
    if (externalReference !== null) {
        return invalidSchema('External $ref values are not supported; use a fragment-local reference instead.');
    }

    const resolved = resolveDraft(schemaParsed.data, request.draft);
    if ('invalidSchema' in resolved) {
        return invalidSchema(resolved.message);
    }
    if ('unsupported' in resolved) {
        return {
            outcome: 'unsupported-draft',
            message: `Unsupported JSON Schema draft${resolved.declared ? `: ${resolved.declared}` : '.'}`,
            ...(resolved.declared && !resolved.declared.startsWith('The $schema') ? { declared: resolved.declared } : {})
        };
    }

    const dataParsed = parseJson(request.data);
    if (isParseFailure(dataParsed)) {
        return { outcome: 'invalid-json', message: dataParsed.message, line: dataParsed.line, column: dataParsed.column };
    }

    try {
        const validator = makeAjv(resolved.draft).compile(schemaForCompile(schemaParsed.data, resolved.draft) as object | boolean);
        const valid = validator(dataParsed.data);
        if (valid) {
            const ignoredKeywords = resolved.fallback ? findDraft2020OnlyKeywords(schemaParsed.data) : [];
            return ignoredKeywords.length > 0
                ? { outcome: 'valid', draft: resolved.draft, ignoredKeywords }
                : { outcome: 'valid', draft: resolved.draft };
        }

        const error = validator.errors?.[0];
        if (!error) {
            return { outcome: 'unavailable', message: 'Schema validation did not return a diagnostic.' };
        }
        return { outcome: 'invalid-data', draft: resolved.draft, diagnostic: firstDiagnostic(error, dataParsed.pointers) };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return invalidSchema(`Invalid JSON Schema: ${message}`);
    }
}
