import { jest } from '@jest/globals';
import {
    autoFixJSON,
    formatJson,
    indentSpacer,
    indexFromErrorMessage,
    indexFromLineColumn,
    lineColumnFromIndex,
    locateJsonError,
    parseIndentOption,
    sortKeysAlphabetically
} from './json-format-core';

describe('autoFixJSON', () => {
    it('removes trailing commas', () => {
        expect(autoFixJSON('{"a":1,}')).toBe('{"a":1}');
        expect(autoFixJSON('[1,2,]')).toBe('[1,2]');
    });

    it('converts single quotes to double quotes', () => {
        expect(autoFixJSON("{'a':'b'}")).toBe('{"a":"b"}');
    });

    it('quotes unquoted keys', () => {
        expect(autoFixJSON('{a:1}')).toBe('{"a":1}');
    });

    it('preserves valid double-quoted strings containing fix-up-like text', () => {
        const input = JSON.stringify({
            a: "escaped \" quote don't,}",
            b: "{word: stay"
        });
        expect(autoFixJSON(input)).toBe(input);
    });
});

describe('sortKeysAlphabetically', () => {
    it('sorts object keys recursively and preserves array order', () => {
        const input = { b: 2, a: { z: 1, y: 2 }, list: [{ d: 4, c: 3 }] };
        expect(sortKeysAlphabetically(input)).toEqual({
            a: { y: 2, z: 1 },
            b: 2,
            list: [{ c: 3, d: 4 }]
        });
        // Object key order is observable via Object.keys.
        expect(Object.keys(sortKeysAlphabetically(input) as Record<string, unknown>)).toEqual(['a', 'b', 'list']);
    });

    it('passes primitives through unchanged', () => {
        expect(sortKeysAlphabetically(5)).toBe(5);
        expect(sortKeysAlphabetically(null)).toBeNull();
        expect(sortKeysAlphabetically('x')).toBe('x');
    });
});

describe('formatJson', () => {
    it('parses, sorts, and stringifies with 2-space indent', () => {
        const result = formatJson({ input: '{"b":2,"a":1}', autoFix: false, sortKeys: true });
        expect(result.formatted).toEqual({ a: 1, b: 2 });
        expect(result.formattedString).toBe('{\n  "a": 1,\n  "b": 2\n}');
    });

    it('preserves key order when sortKeys is false', () => {
        const result = formatJson({ input: '{"b":2,"a":1}', autoFix: false, sortKeys: false });
        expect(Object.keys(result.formatted as Record<string, unknown>)).toEqual(['b', 'a']);
    });

    it('applies auto-fix when the raw parse fails', () => {
        const result = formatJson({ input: '{a:1,}', autoFix: true, sortKeys: false });
        expect(result.formatted).toEqual({ a: 1 });
    });

    it('preserves valid JSON values containing apostrophes when auto-fix is enabled', () => {
        const input = JSON.stringify({ a: "don't", b: "won't" });
        const result = formatJson({ input, autoFix: true, sortKeys: false });

        expect(result.formatted).toEqual({ a: "don't", b: "won't" });
    });

    it('fixes invalid structure without rewriting fix-up-like text inside strings', () => {
        const value = "say \"don't\",} and {word: text";
        const input = '{a: ' + JSON.stringify(value) + ',}';
        const result = formatJson({ input, autoFix: true, sortKeys: false });

        expect(result.formatted).toEqual({ a: value });
    });

    it('throws on invalid JSON', () => {
        expect(() => formatJson({ input: '{invalid}', autoFix: false, sortKeys: false })).toThrow();
    });

    it('trims surrounding whitespace from the input', () => {
        const result = formatJson({ input: '  {"a":1}  ', autoFix: false, sortKeys: false });
        expect(result.formatted).toEqual({ a: 1 });
    });

    it('defaults to 2-space indent when indent is omitted', () => {
        const result = formatJson({ input: '{"a":1}', autoFix: false, sortKeys: false });
        expect(result.formattedString).toBe('{\n  "a": 1\n}');
    });

    it('honours a 4-space indent', () => {
        const result = formatJson({ input: '{"a":1}', autoFix: false, sortKeys: false, indent: 4 });
        expect(result.formattedString).toBe('{\n    "a": 1\n}');
    });

    it('honours tab indentation', () => {
        const result = formatJson({ input: '{"a":1}', autoFix: false, sortKeys: false, indent: 'tab' });
        expect(result.formattedString).toBe('{\n\t"a": 1\n}');
    });

    it('minifies to a single compact line', () => {
        const result = formatJson({ input: '{\n  "a": 1,\n  "b": 2\n}', autoFix: false, sortKeys: false, indent: 'minify' });
        expect(result.formattedString).toBe('{"a":1,"b":2}');
    });
});

describe('indentSpacer', () => {
    it('maps each indent option to a JSON.stringify spacer', () => {
        expect(indentSpacer(2)).toBe(2);
        expect(indentSpacer(4)).toBe(4);
        expect(indentSpacer('tab')).toBe('\t');
        expect(indentSpacer('minify')).toBe(0);
    });
});

describe('parseIndentOption', () => {
    it('parses valid indent options and defaults to 2 for unknown inputs', () => {
        expect(parseIndentOption('4')).toBe(4);
        expect(parseIndentOption('tab')).toBe('tab');
        expect(parseIndentOption('minify')).toBe('minify');
        expect(parseIndentOption('2')).toBe(2);
        expect(parseIndentOption('unknown')).toBe(2);
        expect(parseIndentOption(null)).toBe(2);
        expect(parseIndentOption(undefined)).toBe(2);
    });
});

describe('lineColumnFromIndex', () => {
    it('computes 1-based line/column and clamps out-of-range indices', () => {
        const text = 'a\nbc\nd';
        expect(lineColumnFromIndex(text, 0)).toEqual({ line: 1, column: 1 });
        expect(lineColumnFromIndex(text, 2)).toEqual({ line: 2, column: 1 });
        expect(lineColumnFromIndex(text, 3)).toEqual({ line: 2, column: 2 });
        expect(lineColumnFromIndex(text, 5)).toEqual({ line: 3, column: 1 });
        expect(lineColumnFromIndex(text, 999)).toEqual({ line: 3, column: 2 });
        expect(lineColumnFromIndex(text, -5)).toEqual({ line: 1, column: 1 });
    });
});

describe('indexFromLineColumn', () => {
    it('resolves a 1-based line/column back to a 0-based offset', () => {
        const text = 'a\nbc\nd';
        expect(indexFromLineColumn(text, 1, 1)).toBe(0);
        expect(indexFromLineColumn(text, 2, 1)).toBe(2);
        expect(indexFromLineColumn(text, 2, 2)).toBe(3);
        expect(indexFromLineColumn(text, 3, 1)).toBe(5);
    });

    it('is the inverse of lineColumnFromIndex', () => {
        const text = '{\n  "a": 1,\n  "b": 2\n}';
        for (const index of [0, 1, 5, 12, 18]) {
            const { line, column } = lineColumnFromIndex(text, index);
            expect(indexFromLineColumn(text, line, column)).toBe(index);
        }
    });
});

describe('locateJsonError', () => {
    it('returns null for valid or blank input', () => {
        expect(locateJsonError('{"a":1}')).toBeNull();
        expect(locateJsonError('   ')).toBeNull();
        expect(locateJsonError('')).toBeNull();
    });

    it('returns null for valid apostrophe-containing JSON when auto-fix is enabled', () => {
        const raw = JSON.stringify({ a: "don't", b: "won't" });
        expect(locateJsonError(raw, true)).toBeNull();
    });

    it('locates a syntax error with a message, index, and line/column', () => {
        const raw = '{"a": 1, "b" 2}';
        const result = locateJsonError(raw);
        expect(result).not.toBeNull();
        expect(typeof result?.message).toBe('string');
        // The error sits at the missing colon (the `2` token region).
        expect(result!.index).toBeGreaterThan(0);
        expect(result!.index).toBeLessThanOrEqual(raw.length);
        expect(result!.line).toBe(1);
        expect(result!.column).toBe(result!.index + 1);
    });

    it('handles non-Error thrown during JSON.parse in locateJsonError', () => {
        const parseSpy = jest.spyOn(JSON, 'parse').mockImplementationOnce(() => {
            throw 'Unexpected token in JSON at position 2';
        });

        const result = locateJsonError('{"a": 1}');
        expect(result).not.toBeNull();
        expect(result?.message).toBe('Unexpected token in JSON at position 2');
        expect(result?.index).toBe(2);

        parseSpy.mockRestore();
    });

    it('maps the offset onto the correct line for multi-line input', () => {
        const raw = '{\n  "a": 1\n  "b": 2\n}';
        const result = locateJsonError(raw);
        expect(result).not.toBeNull();
        // The parser flags the second key once it sees no separating comma.
        expect(result!.line).toBeGreaterThanOrEqual(2);
        expect(raw[result!.index]).toBeDefined();
    });

    it('points end-of-input errors at the end of the string', () => {
        const raw = '{"a": 1';
        const result = locateJsonError(raw);
        expect(result).not.toBeNull();
        expect(result!.index).toBe(raw.length);
    });

    it('locates the auto-fixable token when auto-fix is off', () => {
        // Without auto-fix the unquoted `a` is the first real syntax error.
        const result = locateJsonError('{a:1, b:}', false);
        expect(result?.index).toBe(1); // the `a`
    });

    it('locates the residual error (not an auto-fixable token) when auto-fix is on', () => {
        const raw = '{a:1 b:2}';
        const result = locateJsonError(raw, true);
        expect(result).not.toBeNull();
        expect(result!.index).toBeGreaterThan(1);
        expect(result!.index).toBeLessThanOrEqual(raw.length);
    });

    it('offers no jump when the residual (auto-fixed) error carries no position', () => {
        expect(locateJsonError('{a:1, b:}', true)).toBeNull();
    });

    it('keeps the mapped index on the correct raw line when auto-fix shifts columns', () => {
        const raw = '{\n  a: 1\n  b: 2\n}';
        const result = locateJsonError(raw, true);
        expect(result).not.toBeNull();
        expect(result!.line).toBeGreaterThanOrEqual(2);
        expect(result!.index).toBeLessThanOrEqual(raw.length);
    });
});

describe('indexFromErrorMessage', () => {
    it('reads a V8/Node position', () => {
        expect(indexFromErrorMessage('Unexpected token in JSON at position 7', 'abcdefghij')).toBe(7);
    });

    it('reads a Firefox line/column and resolves it against the parsed string', () => {
        const parsed = 'a\nbc\nd';
        expect(indexFromErrorMessage('JSON.parse: bad at line 2 column 2 of the JSON data', parsed)).toBe(3);
    });

    it('points end-of-input messages at the end of the parsed string', () => {
        expect(indexFromErrorMessage('Unexpected end of JSON input', 'abc')).toBe(3);
        expect(indexFromErrorMessage('end of data', 'abcd')).toBe(4);
    });

    it('returns null when no position can be parsed', () => {
        expect(indexFromErrorMessage('totally opaque parser failure', 'abc')).toBeNull();
    });
});
