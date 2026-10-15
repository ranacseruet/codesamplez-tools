/**
 * Pure JSON formatting core — no DOM, structured-cloneable request/result so it
 * can run either on the main thread or inside the formatter Web Worker. The
 * `JSONFormatter` class delegates its static helpers + `prepareFormattedJson`
 * here, and `format.worker.ts` exposes `formatJson` directly.
 */

/**
 * Output indentation choice for the formatted string. `2` / `4` are space counts,
 * `'tab'` indents with a tab character, and `'minify'` emits compact single-line JSON
 * (no whitespace). Maps to the third argument of `JSON.stringify`.
 */
export type IndentOption = 2 | 4 | 'tab' | 'minify';

export interface JsonFormatRequest {
    /** Raw textarea contents (untrimmed — `formatJson` trims). */
    input: string;
    /** If parsing fails, attempt lenient repairs (trailing commas, single quotes, unquoted keys). */
    autoFix: boolean;
    /** Sort object keys alphabetically (recursively). */
    sortKeys: boolean;
    /** Output indentation; defaults to 2 spaces when omitted. */
    indent?: IndentOption;
}

/** Map an `IndentOption` to the `space` argument of `JSON.stringify`. */
export function indentSpacer(indent: IndentOption): string | number {
    if (indent === 'tab') return '\t';
    if (indent === 'minify') return 0; // 0 → compact, single-line output
    return indent; // 2 or 4 spaces
}

/**
 * Parse an `IndentOption` from an arbitrary string-like value (a `<select>`'s
 * `.value`, or a decoded share-URL field), defaulting to `2` for anything
 * unrecognized. Shared by the indent `<select>` reader and the share-URL
 * payload decoder so the two never drift out of sync.
 */
export function parseIndentOption(value: unknown): IndentOption {
    if (value === '4') return 4;
    if (value === 'tab') return 'tab';
    if (value === 'minify') return 'minify';
    return 2;
}

/** Where a JSON syntax error sits, located against the raw textarea contents. */
export interface JsonErrorLocation {
    /** The raw `JSON.parse` error message. */
    message: string;
    /** 0-based character offset into the raw string. */
    index: number;
    /** 1-based line number of `index`. */
    line: number;
    /** 1-based column number of `index`. */
    column: number;
}

/** 1-based line/column for a character offset (for error reporting / jump-to-error). */
export function lineColumnFromIndex(text: string, index: number): { line: number; column: number } {
    const bound = Math.max(0, Math.min(index, text.length));
    let line = 1;
    let column = 1;
    for (let i = 0; i < bound; i++) {
        if (text[i] === '\n') {
            line++;
            column = 1;
        } else {
            column++;
        }
    }
    return { line, column };
}

/** Resolve a 1-based line/column pair back to a 0-based character offset. */
export function indexFromLineColumn(text: string, line: number, column: number): number {
    let index = 0;
    let currentLine = 1;
    while (currentLine < line && index < text.length) {
        if (text[index] === '\n') currentLine++;
        index++;
    }
    return index + (column - 1);
}

/**
 * Extract a character offset (into `parsed`) from a `JSON.parse` error message.
 * Engines word these differently — V8/Node give `position N` (and a `line/column`),
 * Firefox gives `line N column M`, and end-of-input errors carry no coordinate.
 * Returns `null` when nothing locatable is present.
 */
export function indexFromErrorMessage(message: string, parsed: string): number | null {
    const positionMatch = message.match(/position (\d+)/i);
    if (positionMatch) return Number(positionMatch[1]);

    const lineColumnMatch = message.match(/line (\d+) column (\d+)/i);
    if (lineColumnMatch) return indexFromLineColumn(parsed, Number(lineColumnMatch[1]), Number(lineColumnMatch[2]));

    // "Unexpected end of JSON input" / "end of data" — point at the very end.
    if (/unexpected end|end of (the )?(json )?(data|input)/i.test(message)) return parsed.length;

    return null;
}

/**
 * Translate a 1-based line/column (measured in the auto-fixed string) onto the raw
 * input. Auto-fix never adds or removes line breaks, so the line number carries over
 * directly; the column is clamped to the raw line's length so it never points past
 * the end of that line.
 */
function mapLineColumnToRaw(raw: string, line: number, column: number): number {
    let lineStart = 0;
    let currentLine = 1;
    while (currentLine < line && lineStart < raw.length) {
        if (raw[lineStart] === '\n') currentLine++;
        lineStart++;
    }
    let lineEnd = lineStart;
    while (lineEnd < raw.length && raw[lineEnd] !== '\n') lineEnd++;
    const maxColumn = lineEnd - lineStart + 1; // 1-based column just past the line's last char
    return lineStart + (Math.min(column, maxColumn) - 1);
}

/**
 * Locate the first JSON syntax error in `raw`, or `null` if it parses, is blank, or
 * the engine reports no usable position. When `autoFix` is on, the error is located
 * against the same auto-fixed string `formatJson` parses, but only after the raw input
 * fails to parse. The residual error is then mapped back onto the raw textarea
 * (line-for-line, column clamped) for jump-to-error highlighting.
 */
export function locateJsonError(raw: string, autoFix = false): JsonErrorLocation | null {
    if (!raw.trim()) return null;
    // Keep raw's line breaks (don't trim) so candidate lines stay aligned with raw.
    let candidate = raw;
    if (autoFix) {
        try {
            JSON.parse(raw);
            return null;
        } catch {
            candidate = autoFixJSON(raw);
        }
    }

    try {
        JSON.parse(candidate);
        return null;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const located = indexFromErrorMessage(message, candidate);
        // No reliable position — let the caller fall back to the plain message.
        if (located === null) return null;

        const candidateIndex = Math.max(0, Math.min(located, candidate.length));
        const { line, column } = lineColumnFromIndex(candidate, candidateIndex);
        const index = autoFix ? mapLineColumnToRaw(raw, line, column) : candidateIndex;
        return { message, index, ...lineColumnFromIndex(raw, index) };
    }
}

export interface JsonFormatResult {
    /**
     * The parsed (and optionally sorted) value. Structured-cloneable, so the
     * worker can post it back for the main thread's tree renderer to walk —
     * avoiding a second `JSON.parse` on the main thread.
     */
    formatted: unknown;
    /** `JSON.stringify(formatted, null, 2)` — the plain-view / copy / download text. */
    formattedString: string;
}

/** Convert single-quoted string content to valid double-quoted JSON string content. */
function convertSingleQuotedContent(content: string): string {
    let result = '';
    for (let i = 0; i < content.length; i++) {
        const ch = content[i];
        if (ch === '\\') {
            const next = content[i + 1];
            if (next === '\'') {
                // In single-quoted string, \' was escaped. In double-quoted JSON,
                // ' does not need escaping and \' is an invalid escape sequence.
                result += '\'';
                i++;
            } else if (next === '"') {
                // Already-escaped \" inside single quotes remains \".
                result += '\\"';
                i++;
            } else if (next === '\\') {
                // Escaped backslash \\ remains \\.
                result += '\\\\';
                i++;
            } else {
                // Other valid escapes (\n, \r, \t, etc.) preserved.
                result += '\\' + next;
                i++;
            }
        } else if (ch === '"') {
            // Unescaped double quote inside single-quoted string must be escaped in double-quoted JSON.
            result += '\\"';
        } else {
            result += ch;
        }
    }
    return `"${result}"`;
}

/** Apply lenient fix-ups to text outside string literals: trailing commas and unquoted keys. */
function autoFixJsonSegment(segment: string): string {
    // Remove trailing commas
    let fixedJson = segment.replace(/,\s*([}\]])/g, '$1');

    // Add quotes to unquoted keys (supports letters, digits, underscores, dollar signs, and hyphens)
    fixedJson = fixedJson.replace(/([{,]\s*)([\w$-]+)\s*:/g, '$1"$2":');

    return fixedJson;
}

/** Lenient pre-parse fix-ups: trailing commas, single quotes, unquoted keys. */
export function autoFixJSON(jsonString: string): string {
    const fixedSegments: string[] = [];
    let segmentStart = 0;
    let index = 0;

    while (index < jsonString.length) {
        const ch = jsonString[index];
        if (ch !== '"' && ch !== '\'') {
            index += 1;
            continue;
        }

        // An apostrophe preceded by a word character (e.g. "it's", "don't")
        // is part of an unquoted word/identifier, not the opening of a string literal.
        if (ch === '\'' && index > 0 && /\w/.test(jsonString[index - 1])) {
            index += 1;
            continue;
        }

        fixedSegments.push(autoFixJsonSegment(jsonString.slice(segmentStart, index)));
        const quoteChar = ch;
        const stringStart = index;
        index += 1;
        let closed = false;

        while (index < jsonString.length) {
            if (jsonString[index] === '\\') {
                index += Math.min(2, jsonString.length - index);
            } else if (jsonString[index] === quoteChar) {
                index += 1;
                closed = true;
                break;
            } else {
                index += 1;
            }
        }

        if (quoteChar === '"') {
            fixedSegments.push(jsonString.slice(stringStart, index));
        } else if (closed) {
            fixedSegments.push(convertSingleQuotedContent(jsonString.slice(stringStart + 1, index - 1)));
        } else {
            // Unclosed single quote / stray apostrophe: pass through autoFixJsonSegment
            // so subsequent unquoted keys and trailing commas in the tail are still fixed.
            fixedSegments.push(autoFixJsonSegment(jsonString.slice(stringStart, index)));
        }
        segmentStart = index;
    }

    fixedSegments.push(autoFixJsonSegment(jsonString.slice(segmentStart)));
    return fixedSegments.join('');
}

/** Recursively sort object keys alphabetically; arrays keep order, recurse into items. */
export function sortKeysAlphabetically(obj: unknown): unknown {
    if (Array.isArray(obj)) {
        return obj.map((item) => sortKeysAlphabetically(item));
    }
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    const record = obj as Record<string, unknown>;
    return Object.keys(record)
        .sort()
        .reduce((sorted, key) => {
            sorted[key] = sortKeysAlphabetically(record[key]);
            return sorted;
        }, {} as Record<string, unknown>);
}

/**
 * The compute half of the JSON formatter: parse, optional auto-fix on failure,
 * optional key sort, and stringify. Throws on invalid JSON (the caller surfaces the
 * message); both the main thread and the worker run this same function.
 */
export function formatJson(request: JsonFormatRequest): JsonFormatResult {
    let inputValue = request.input.trim();
    let parsed: unknown;
    try {
        parsed = JSON.parse(inputValue) as unknown;
    } catch (error) {
        if (!request.autoFix) throw error;
        inputValue = autoFixJSON(inputValue);
        parsed = JSON.parse(inputValue) as unknown;
    }

    const formatted = request.sortKeys ? sortKeysAlphabetically(parsed) : parsed;

    return {
        formatted,
        formattedString: JSON.stringify(formatted, null, indentSpacer(request.indent ?? 2))
    };
}
