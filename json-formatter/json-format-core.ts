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
    /** Apply the lenient auto-fix pass (trailing commas, quotes) before parsing. */
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
 * against the *same* auto-fixed string `formatJson` parses — so the message reflects
 * the real residual error, not a token auto-fix would have repaired — then mapped back
 * onto the raw textarea (line-for-line, column clamped) for jump-to-error highlighting.
 */
export function locateJsonError(raw: string, autoFix = false): JsonErrorLocation | null {
    if (!raw.trim()) return null;
    // Keep raw's line breaks (don't trim) so candidate lines stay aligned with raw.
    const candidate = autoFix ? autoFixJSON(raw) : raw;
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

/** Lenient pre-parse fix-ups: trailing commas, single quotes, unquoted keys. */
export function autoFixJSON(jsonString: string): string {
    // Remove trailing commas
    let fixedJson = jsonString.replace(/,\s*([}\]])/g, '$1');

    // Convert single-quoted strings to double-quoted (handles escaped quotes)
    fixedJson = fixedJson.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

    // Add quotes to unquoted keys
    fixedJson = fixedJson.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');

    return fixedJson;
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
 * The compute half of the JSON formatter: optional auto-fix, parse, optional
 * key sort, and stringify. Throws on invalid JSON (the caller surfaces the
 * message); both the main thread and the worker run this same function.
 */
export function formatJson(request: JsonFormatRequest): JsonFormatResult {
    let inputValue = request.input.trim();
    if (request.autoFix) {
        inputValue = autoFixJSON(inputValue);
    }

    const parsed = JSON.parse(inputValue) as unknown;
    const formatted = request.sortKeys ? sortKeysAlphabetically(parsed) : parsed;

    return {
        formatted,
        formattedString: JSON.stringify(formatted, null, indentSpacer(request.indent ?? 2))
    };
}
