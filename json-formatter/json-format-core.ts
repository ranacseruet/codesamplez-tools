/**
 * Pure JSON formatting core — no DOM, structured-cloneable request/result so it
 * can run either on the main thread or inside the formatter Web Worker. The
 * `JSONFormatter` class delegates its static helpers + `prepareFormattedJson`
 * here, and `format.worker.ts` exposes `formatJson` directly.
 */

export interface JsonFormatRequest {
    /** Raw textarea contents (untrimmed — `formatJson` trims). */
    input: string;
    /** Apply the lenient auto-fix pass (trailing commas, quotes) before parsing. */
    autoFix: boolean;
    /** Sort object keys alphabetically (recursively). */
    sortKeys: boolean;
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

    return { formatted, formattedString: JSON.stringify(formatted, null, 2) };
}
