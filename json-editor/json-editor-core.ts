/**
 * Pure tree model for the JSON Editor tool.
 *
 * Runtime ids make recursive rows stable while a document is being edited.
 * They are deliberately kept separate from the JSON values returned by
 * `jsonEditorNodeToValue` and `serializeJsonEditorNode`.
 */

export type JsonValueType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';
export type JsonEditorIndent = 2 | 4 | 'tab' | 'minify';
export type JsonEditorIdFactory = () => string;

export interface JsonEditorStringNode {
    id: string;
    type: 'string';
    value: string;
}

export interface JsonEditorNumberNode {
    id: string;
    type: 'number';
    value: number;
}

export interface JsonEditorBooleanNode {
    id: string;
    type: 'boolean';
    value: boolean;
}

export interface JsonEditorNullNode {
    id: string;
    type: 'null';
    value: null;
}

export interface JsonEditorObjectNode {
    id: string;
    type: 'object';
    children: JsonObjectProperty[];
}

export interface JsonEditorArrayNode {
    id: string;
    type: 'array';
    children: JsonEditorNode[];
}

export type JsonEditorNode =
    | JsonEditorStringNode
    | JsonEditorNumberNode
    | JsonEditorBooleanNode
    | JsonEditorNullNode
    | JsonEditorObjectNode
    | JsonEditorArrayNode;

export interface JsonObjectProperty {
    id: string;
    key: string;
    value: JsonEditorNode;
}

export interface JsonEditorLimits {
    maxBytes: number;
    maxNodes: number;
    maxDepth: number;
}

export const JSON_EDITOR_LIMITS: JsonEditorLimits = Object.freeze({
    maxBytes: 5 * 1024 * 1024,
    maxNodes: 10_000,
    maxDepth: 100
});

const JSON_NUMBER_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

export interface JsonEditorParseDiagnostics {
    message: string;
    index: number;
    line: number;
    column: number;
}

export class JsonEditorParseError extends Error {
    readonly diagnostics: JsonEditorParseDiagnostics;

    constructor(diagnostics: JsonEditorParseDiagnostics) {
        super(diagnostics.message);
        this.name = 'JsonEditorParseError';
        this.diagnostics = diagnostics;
    }
}

export type JsonEditorLimitKind = 'maxNodes' | 'maxDepth';

export class JsonEditorLimitError extends Error {
    readonly kind: JsonEditorLimitKind;

    constructor(kind: JsonEditorLimitKind, message: string) {
        super(message);
        this.name = 'JsonEditorLimitError';
        this.kind = kind;
    }
}

/** Return true only for finite JSON number literals, not JavaScript extras. */
export function isValidJsonEditorNumber(input: string): boolean {
    const trimmed = input.trim();
    return JSON_NUMBER_PATTERN.test(trimmed) && Number.isFinite(Number(trimmed));
}

function createDiagnostics(text: string, message: string, index: number): JsonEditorParseDiagnostics {
    const boundedIndex = Math.max(0, Math.min(index, text.length));
    let line = 1;
    let column = 1;

    for (let offset = 0; offset < boundedIndex; offset += 1) {
        if (text[offset] === '\n') {
            line += 1;
            column = 1;
        } else {
            column += 1;
        }
    }

    return {
        message,
        index: boundedIndex,
        line,
        column
    };
}

function byteLength(text: string): number {
    return new Blob([text]).size;
}

function parserErrorIndex(message: string, text: string): number {
    const positionMatch = message.match(/position (\d+)/i);
    if (positionMatch) {
        return Number(positionMatch[1]);
    }

    const lineColumnMatch = message.match(/line (\d+) column (\d+)/i);
    if (lineColumnMatch) {
        const targetLine = Number(lineColumnMatch[1]);
        const targetColumn = Number(lineColumnMatch[2]);
        let index = 0;
        let line = 1;

        while (line < targetLine && index < text.length) {
            if (text[index] === '\n') {
                line += 1;
            }
            index += 1;
        }

        return index + targetColumn - 1;
    }

    if (/unexpected end|end of (the )?(json )?(data|input)/i.test(message)) {
        return text.length;
    }

    return text.length;
}

interface BuildState {
    nodes: number;
}

function failLimit(text: string, message: string, index = text.length): never {
    throw new JsonEditorParseError(createDiagnostics(text, message, index));
}

function isContainerValue(value: unknown): boolean {
    return Array.isArray(value) || (typeof value === 'object' && value !== null);
}

function createNodeFromValue(
    value: unknown,
    idFactory: JsonEditorIdFactory,
    depth: number,
    state: BuildState,
    limits: JsonEditorLimits
): JsonEditorNode {
    if (isContainerValue(value) && depth > limits.maxDepth) {
        failLimit('', `JSON exceeds the maximum nesting depth of ${limits.maxDepth}.`);
    }

    state.nodes += 1;
    if (state.nodes > limits.maxNodes) {
        failLimit('', `JSON exceeds the maximum of ${limits.maxNodes.toLocaleString()} tree nodes.`);
    }

    if (value === null) {
        return { id: idFactory(), type: 'null', value: null };
    }

    if (Array.isArray(value)) {
        return {
            id: idFactory(),
            type: 'array',
            children: value.map((item) => createNodeFromValue(item, idFactory, isContainerValue(item) ? depth + 1 : depth, state, limits))
        };
    }

    switch (typeof value) {
        case 'string':
            return { id: idFactory(), type: 'string', value };
        case 'number':
            return { id: idFactory(), type: 'number', value };
        case 'boolean':
            return { id: idFactory(), type: 'boolean', value };
        case 'object': {
            const objectValue = value as Record<string, unknown>;
            const children: JsonObjectProperty[] = [];

            Object.keys(objectValue).forEach((key) => {
                children.push({
                    id: idFactory(),
                    key,
                    value: createNodeFromValue(objectValue[key], idFactory, isContainerValue(objectValue[key]) ? depth + 1 : depth, state, limits)
                });
            });

            return { id: idFactory(), type: 'object', children };
        }
        default:
            // JSON.parse cannot produce undefined, bigint, function, or symbol;
            // this guard keeps the public constructor safe if called directly.
            throw new TypeError(`Unsupported JSON value type: ${typeof value}`);
    }
}

/** Create the initial empty object document. */
export function createJsonEditorDocument(idFactory: JsonEditorIdFactory): JsonEditorObjectNode {
    return { id: idFactory(), type: 'object', children: [] };
}

/** Convert a parsed JSON value into a runtime-id tree. */
export function createJsonEditorNode(value: unknown, idFactory: JsonEditorIdFactory): JsonEditorNode {
    return createNodeFromValue(value, idFactory, isContainerValue(value) ? 1 : 0, { nodes: 0 }, JSON_EDITOR_LIMITS);
}

/** Strictly parse JSON and enforce the editor's input, node, and depth limits. */
export function parseJsonEditorInput(
    input: string,
    idFactory: JsonEditorIdFactory,
    limits: JsonEditorLimits = JSON_EDITOR_LIMITS
): JsonEditorNode {
    if (byteLength(input) > limits.maxBytes) {
        failLimit(input, `Input exceeds the ${Math.round(limits.maxBytes / (1024 * 1024))} MiB limit.`);
    }

    if (!input.trim()) {
        failLimit(input, 'Enter JSON to import.', 0);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(input) as unknown;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new JsonEditorParseError(createDiagnostics(input, message, parserErrorIndex(message, input)));
    }

    try {
        return createNodeFromValue(parsed, idFactory, isContainerValue(parsed) ? 1 : 0, { nodes: 0 }, limits);
    } catch (error) {
        if (error instanceof JsonEditorParseError) {
            // Limit failures generated during recursive construction do not
            // retain the original input. Re-anchor their diagnostics here.
            const message = error.message;
            throw new JsonEditorParseError(createDiagnostics(input, message, input.length));
        }
        throw error;
    }
}

/** Return the plain JSON value represented by a runtime-id tree. */
export function jsonEditorNodeToValue(node: JsonEditorNode): unknown {
    switch (node.type) {
        case 'string':
        case 'number':
        case 'boolean':
        case 'null':
            return node.value;
        case 'array':
            return node.children.map((child) => jsonEditorNodeToValue(child));
        case 'object': {
            const value: Record<string, unknown> = {};
            node.children.forEach((property) => {
                value[property.key] = jsonEditorNodeToValue(property.value);
            });
            return value;
        }
    }
}

/** Clone a tree while assigning fresh runtime ids to every node and property. */
export function cloneJsonEditorNode(node: JsonEditorNode, idFactory: JsonEditorIdFactory): JsonEditorNode {
    switch (node.type) {
        case 'string':
            return { id: idFactory(), type: 'string', value: node.value };
        case 'number':
            return { id: idFactory(), type: 'number', value: node.value };
        case 'boolean':
            return { id: idFactory(), type: 'boolean', value: node.value };
        case 'null':
            return { id: idFactory(), type: 'null', value: null };
        case 'array':
            return {
                id: idFactory(),
                type: 'array',
                children: node.children.map((child) => cloneJsonEditorNode(child, idFactory))
            };
        case 'object':
            return {
                id: idFactory(),
                type: 'object',
                children: node.children.map((property) => ({
                    id: idFactory(),
                    key: property.key,
                    value: cloneJsonEditorNode(property.value, idFactory)
                }))
            };
    }
}

/** Count nodes, excluding object property ids because they are not values. */
export function countJsonEditorNodes(node: JsonEditorNode): number {
    if (node.type === 'array') {
        return 1 + node.children.reduce((total, child) => total + countJsonEditorNodes(child), 0);
    }

    if (node.type === 'object') {
        return 1 + node.children.reduce((total, property) => total + countJsonEditorNodes(property.value), 0);
    }

    return 1;
}

/** Return the number of value levels from the root to the deepest descendant. */
export function getJsonEditorDepth(node: JsonEditorNode): number {
    if (node.type === 'array') {
        return node.children.length === 0
            ? 1
            : 1 + Math.max(...node.children.map((child) => getJsonEditorDepth(child)));
    }

    if (node.type === 'object') {
        return node.children.length === 0
            ? 1
            : 1 + Math.max(...node.children.map((property) => getJsonEditorDepth(property.value)));
    }

    return 0;
}

/** Reject a tree that cannot be safely rendered by the editor. */
export function assertJsonEditorLimits(
    node: JsonEditorNode,
    limits: JsonEditorLimits = JSON_EDITOR_LIMITS
): void {
    const nodeCount = countJsonEditorNodes(node);
    if (nodeCount > limits.maxNodes) {
        throw new JsonEditorLimitError('maxNodes', `JSON exceeds the maximum of ${limits.maxNodes.toLocaleString()} tree nodes.`);
    }

    const depth = getJsonEditorDepth(node);
    if (depth > limits.maxDepth) {
        throw new JsonEditorLimitError('maxDepth', `JSON exceeds the maximum nesting depth of ${limits.maxDepth}.`);
    }
}

export function isJsonEditorContainer(node: JsonEditorNode): node is JsonEditorObjectNode | JsonEditorArrayNode {
    return node.type === 'object' || node.type === 'array';
}

/** Find a value node by its runtime id. */
export function findJsonEditorNode(root: JsonEditorNode, nodeId: string): JsonEditorNode | null {
    if (root.id === nodeId) return root;

    if (root.type === 'array') {
        for (let index = 0; index < root.children.length; index += 1) {
            const found = findJsonEditorNode(root.children[index], nodeId);
            if (found) return found;
        }
    }

    if (root.type === 'object') {
        for (let index = 0; index < root.children.length; index += 1) {
            const found = findJsonEditorNode(root.children[index].value, nodeId);
            if (found) return found;
        }
    }

    return null;
}

/** Find an object property by its runtime id. */
export function findJsonObjectProperty(root: JsonEditorNode, propertyId: string): JsonObjectProperty | null {
    if (root.type === 'object') {
        for (let index = 0; index < root.children.length; index += 1) {
            const property = root.children[index];
            if (property.id === propertyId) return property;
            const found = findJsonObjectProperty(property.value, propertyId);
            if (found) return found;
        }
    } else if (root.type === 'array') {
        for (let index = 0; index < root.children.length; index += 1) {
            const found = findJsonObjectProperty(root.children[index], propertyId);
            if (found) return found;
        }
    }

    return null;
}

/** Find the object that owns a property id. */
export function findJsonObjectPropertyParent(root: JsonEditorNode, propertyId: string): JsonEditorObjectNode | null {
    if (root.type === 'object') {
        for (let index = 0; index < root.children.length; index += 1) {
            const property = root.children[index];
            if (property.id === propertyId) return root;
            const found = findJsonObjectPropertyParent(property.value, propertyId);
            if (found) return found;
        }
    } else if (root.type === 'array') {
        for (let index = 0; index < root.children.length; index += 1) {
            const found = findJsonObjectPropertyParent(root.children[index], propertyId);
            if (found) return found;
        }
    }

    return null;
}

/** Check whether a key would duplicate a sibling object property. */
export function hasDuplicateJsonObjectKey(
    parent: JsonEditorObjectNode,
    key: string,
    exceptPropertyId?: string
): boolean {
    return parent.children.some((property) => property.id !== exceptPropertyId && property.key === key);
}

/** Return a unique object key, preserving the requested base when possible. */
export function getUniqueJsonObjectKey(properties: JsonObjectProperty[], base = 'newProperty'): string {
    if (!properties.some((property) => property.key === base)) return base;

    let suffix = 2;
    while (properties.some((property) => property.key === `${base}${suffix}`)) {
        suffix += 1;
    }
    return `${base}${suffix}`;
}

function mapNodeById(
    node: JsonEditorNode,
    targetId: string,
    mapper: (target: JsonEditorNode) => JsonEditorNode
): { node: JsonEditorNode; changed: boolean } {
    if (node.id === targetId) {
        return { node: mapper(node), changed: true };
    }

    if (node.type === 'array') {
        let changed = false;
        const children = node.children.map((child) => {
            const mapped = mapNodeById(child, targetId, mapper);
            changed = changed || mapped.changed;
            return mapped.node;
        });
        return changed ? { node: { ...node, children }, changed: true } : { node, changed: false };
    }

    if (node.type === 'object') {
        let changed = false;
        const children = node.children.map((property) => {
            const mapped = mapNodeById(property.value, targetId, mapper);
            changed = changed || mapped.changed;
            return mapped.changed ? { ...property, value: mapped.node } : property;
        });
        return changed ? { node: { ...node, children }, changed: true } : { node, changed: false };
    }

    return { node, changed: false };
}

function mapPropertyById(
    node: JsonEditorNode,
    propertyId: string,
    mapper: (property: JsonObjectProperty) => JsonObjectProperty
): { node: JsonEditorNode; changed: boolean } {
    if (node.type === 'array') {
        let changed = false;
        const children = node.children.map((child) => {
            const mapped = mapPropertyById(child, propertyId, mapper);
            changed = changed || mapped.changed;
            return mapped.node;
        });
        return changed ? { node: { ...node, children }, changed: true } : { node, changed: false };
    }

    if (node.type === 'object') {
        let changed = false;
        const children = node.children.map((property) => {
            if (property.id === propertyId) {
                changed = true;
                return mapper(property);
            }
            const mapped = mapPropertyById(property.value, propertyId, mapper);
            changed = changed || mapped.changed;
            return mapped.changed ? { ...property, value: mapped.node } : property;
        });
        return changed ? { node: { ...node, children }, changed: true } : { node, changed: false };
    }

    return { node, changed: false };
}

/** Update a primitive value without mutating the existing tree. */
export function updateJsonEditorValue(
    root: JsonEditorNode,
    nodeId: string,
    value: string | number | boolean | null
): JsonEditorNode {
    const current = findJsonEditorNode(root, nodeId);
    if (!current || isJsonEditorContainer(current)) {
        return root;
    }

    if (current.type === 'number') {
        const numericValue = Number(value);
        if ((typeof value === 'string' && !isValidJsonEditorNumber(value)) || !Number.isFinite(numericValue)) {
            throw new Error('JSON numbers must be finite and use valid JSON number syntax.');
        }
    }

    return mapNodeById(root, nodeId, (node) => {
        if (node.type === 'string') return { ...node, value: String(value ?? '') };
        if (node.type === 'number') return { ...node, value: Number(value) };
        if (node.type === 'boolean') return { ...node, value: Boolean(value) };
        return { ...node, value: null };
    }).node;
}

/** Rename a property; duplicate sibling keys are rejected. */
export function renameJsonObjectProperty(root: JsonEditorNode, propertyId: string, key: string): JsonEditorNode {
    const parent = findJsonObjectPropertyParent(root, propertyId);
    if (!parent || hasDuplicateJsonObjectKey(parent, key, propertyId)) {
        throw new Error(`An object cannot contain duplicate key "${key}".`);
    }

    return mapPropertyById(root, propertyId, (property) => ({ ...property, key })).node;
}

/** Append a null-valued property to an object. */
export function addJsonObjectProperty(
    root: JsonEditorNode,
    parentId: string,
    idFactory: JsonEditorIdFactory,
    baseKey = 'newProperty',
    limits: JsonEditorLimits = JSON_EDITOR_LIMITS
): JsonEditorNode {
    const next = mapNodeById(root, parentId, (node) => {
        if (node.type !== 'object') return node;
        return {
            ...node,
            children: [
                ...node.children,
                {
                    id: idFactory(),
                    key: getUniqueJsonObjectKey(node.children, baseKey),
                    value: { id: idFactory(), type: 'null', value: null }
                }
            ]
        };
    }).node;
    assertJsonEditorLimits(next, limits);
    return next;
}

/** Append a null-valued item to an array. */
export function addJsonArrayItem(
    root: JsonEditorNode,
    parentId: string,
    idFactory: JsonEditorIdFactory,
    limits: JsonEditorLimits = JSON_EDITOR_LIMITS
): JsonEditorNode {
    const next = mapNodeById(root, parentId, (node) => {
        if (node.type !== 'array') return node;
        return {
            ...node,
            children: [...node.children, { id: idFactory(), type: 'null', value: null }]
        };
    }).node;
    assertJsonEditorLimits(next, limits);
    return next;
}

/** Delete a non-root value node and its containing object property if needed. */
export function deleteJsonEditorNode(root: JsonEditorNode, nodeId: string): JsonEditorNode {
    if (root.id === nodeId) return root;

    if (root.type === 'array') {
        const directIndex = root.children.findIndex((child) => child.id === nodeId);
        if (directIndex !== -1) {
            return {
                ...root,
                children: root.children.slice(0, directIndex).concat(root.children.slice(directIndex + 1))
            };
        }

        let changed = false;
        const children = root.children.map((child) => {
            const next = deleteJsonEditorNode(child, nodeId);
            changed = changed || next !== child;
            return next;
        });
        return changed ? { ...root, children } : root;
    }

    if (root.type === 'object') {
        const directIndex = root.children.findIndex((property) => property.value.id === nodeId);
        if (directIndex !== -1) {
            return {
                ...root,
                children: root.children.slice(0, directIndex).concat(root.children.slice(directIndex + 1))
            };
        }

        let changed = false;
        const children = root.children.map((property) => {
            const next = deleteJsonEditorNode(property.value, nodeId);
            changed = changed || next !== property.value;
            return next !== property.value ? { ...property, value: next } : property;
        });
        return changed ? { ...root, children } : root;
    }

    return root;
}

/** Duplicate a direct child after itself, generating fresh ids and a unique key. */
export function duplicateJsonEditorNode(
    root: JsonEditorNode,
    nodeId: string,
    idFactory: JsonEditorIdFactory,
    limits: JsonEditorLimits = JSON_EDITOR_LIMITS
): JsonEditorNode {
    if (root.id === nodeId) return root;

    if (root.type === 'array') {
        const directIndex = root.children.findIndex((child) => child.id === nodeId);
        if (directIndex !== -1) {
            const duplicate = cloneJsonEditorNode(root.children[directIndex], idFactory);
            const next = {
                ...root,
                children: root.children.slice(0, directIndex + 1).concat([duplicate], root.children.slice(directIndex + 1))
            };
            assertJsonEditorLimits(next, limits);
            return next;
        }

        let changed = false;
        const children = root.children.map((child) => {
            const next = duplicateJsonEditorNode(child, nodeId, idFactory, limits);
            changed = changed || next !== child;
            return next;
        });
        const next = changed ? { ...root, children } : root;
        if (changed) assertJsonEditorLimits(next, limits);
        return next;
    }

    if (root.type === 'object') {
        const directIndex = root.children.findIndex((property) => property.value.id === nodeId);
        if (directIndex !== -1) {
            const source = root.children[directIndex];
            const duplicate: JsonObjectProperty = {
                id: idFactory(),
                key: getUniqueJsonObjectKey(root.children, `${source.key}Copy`),
                value: cloneJsonEditorNode(source.value, idFactory)
            };
            const next = {
                ...root,
                children: root.children.slice(0, directIndex + 1).concat([duplicate], root.children.slice(directIndex + 1))
            };
            assertJsonEditorLimits(next, limits);
            return next;
        }

        let changed = false;
        const children = root.children.map((property) => {
            const next = duplicateJsonEditorNode(property.value, nodeId, idFactory, limits);
            changed = changed || next !== property.value;
            return next !== property.value ? { ...property, value: next } : property;
        });
        const next = changed ? { ...root, children } : root;
        if (changed) assertJsonEditorLimits(next, limits);
        return next;
    }

    return root;
}

/** Move a direct child one position up or down while preserving sibling order. */
export function moveJsonEditorNode(root: JsonEditorNode, nodeId: string, direction: 'up' | 'down'): JsonEditorNode {
    if (root.id === nodeId) return root;

    if (root.type === 'array') {
        const directIndex = root.children.findIndex((child) => child.id === nodeId);
        const targetIndex = direction === 'up' ? directIndex - 1 : directIndex + 1;
        if (directIndex !== -1 && targetIndex >= 0 && targetIndex < root.children.length) {
            const children = root.children.slice();
            const current = children[directIndex];
            children[directIndex] = children[targetIndex];
            children[targetIndex] = current;
            return { ...root, children };
        }

        let changed = false;
        const children = root.children.map((child) => {
            const next = moveJsonEditorNode(child, nodeId, direction);
            changed = changed || next !== child;
            return next;
        });
        return changed ? { ...root, children } : root;
    }

    if (root.type === 'object') {
        const directIndex = root.children.findIndex((property) => property.value.id === nodeId);
        const targetIndex = direction === 'up' ? directIndex - 1 : directIndex + 1;
        if (directIndex !== -1 && targetIndex >= 0 && targetIndex < root.children.length) {
            const children = root.children.slice();
            const current = children[directIndex];
            children[directIndex] = children[targetIndex];
            children[targetIndex] = current;
            return { ...root, children };
        }

        let changed = false;
        const children = root.children.map((property) => {
            const next = moveJsonEditorNode(property.value, nodeId, direction);
            changed = changed || next !== property.value;
            return next !== property.value ? { ...property, value: next } : property;
        });
        return changed ? { ...root, children } : root;
    }

    return root;
}

function convertPrimitiveValue(node: JsonEditorNode, targetType: 'string' | 'number' | 'boolean'): string | number | boolean {
    if (targetType === 'string') {
        if (node.type === 'null') return '';
        if (node.type === 'string' || node.type === 'number' || node.type === 'boolean') {
            return String(node.value);
        }
        return '';
    }

    if (targetType === 'number') {
        if (node.type === 'number') return node.value;
        if (node.type === 'boolean') return node.value ? 1 : 0;
        if (node.type === 'string') {
            const value = Number(node.value);
            return Number.isFinite(value) ? value : 0;
        }
        return 0;
    }

    if (targetType === 'boolean') {
        if (node.type === 'boolean') return node.value;
        if (node.type === 'number') return node.value !== 0;
        if (node.type === 'string') return node.value.toLowerCase() === 'true';
        return false;
    }

}

/** Change a node type, resetting container children when the type changes. */
export function changeJsonEditorNodeType(
    root: JsonEditorNode,
    nodeId: string,
    targetType: JsonValueType,
    idFactory: JsonEditorIdFactory,
    limits: JsonEditorLimits = JSON_EDITOR_LIMITS
): JsonEditorNode {
    const current = findJsonEditorNode(root, nodeId);
    if (!current || current.type === targetType) return root;

    const next = mapNodeById(root, nodeId, (node) => {
        if (targetType === 'object') return { id: node.id, type: 'object', children: [] };
        if (targetType === 'array') return { id: node.id, type: 'array', children: [] };
        if (targetType === 'string') return { id: node.id, type: 'string', value: String(convertPrimitiveValue(node, targetType)) };
        if (targetType === 'number') return { id: node.id, type: 'number', value: Number(convertPrimitiveValue(node, targetType)) };
        if (targetType === 'boolean') return { id: node.id, type: 'boolean', value: Boolean(convertPrimitiveValue(node, targetType)) };
        return { id: node.id, type: 'null', value: null };
    }).node;
    assertJsonEditorLimits(next, limits);
    return next;
}

function serializeNode(node: JsonEditorNode, indent: JsonEditorIndent, depth: number): string {
    const spacer = indent === 'tab' ? '\t' : indent === 'minify' ? '' : ' '.repeat(indent);
    const pretty = indent !== 'minify';
    const currentIndent = spacer.repeat(depth);
    const childIndent = spacer.repeat(depth + 1);

    if (node.type === 'string') return JSON.stringify(node.value);
    if (node.type === 'number') {
        if (!Number.isFinite(node.value)) throw new Error('JSON numbers must be finite.');
        return JSON.stringify(node.value);
    }
    if (node.type === 'boolean') return node.value ? 'true' : 'false';
    if (node.type === 'null') return 'null';

    if (node.type === 'array') {
        if (node.children.length === 0) return '[]';
        const values = node.children.map((child) => serializeNode(child, indent, depth + 1));
        return pretty
            ? `[\n${childIndent}${values.join(`,\n${childIndent}`)}\n${currentIndent}]`
            : `[${values.join(',')}]`;
    }

    const seenKeys = new Set<string>();
    node.children.forEach((property) => {
        if (seenKeys.has(property.key)) {
            throw new Error(`An object cannot contain duplicate key "${property.key}".`);
        }
        seenKeys.add(property.key);
    });

    if (node.children.length === 0) return '{}';
    const properties = node.children.map((property) => (
        `${JSON.stringify(property.key)}${pretty ? ': ' : ':'}${serializeNode(property.value, indent, depth + 1)}`
    ));
    return pretty
        ? `{\n${childIndent}${properties.join(`,\n${childIndent}`)}\n${currentIndent}}`
        : `{${properties.join(',')}}`;
}

/** Serialize a runtime tree as valid JSON with the selected indentation. */
export function serializeJsonEditorNode(node: JsonEditorNode, indent: JsonEditorIndent = 2): string {
    return serializeNode(node, indent, 0);
}

/** Parse a select value into the supported indentation union. */
export function parseJsonEditorIndent(value: unknown): JsonEditorIndent {
    if (value === '4') return 4;
    if (value === 'tab') return 'tab';
    if (value === 'minify') return 'minify';
    return 2;
}
