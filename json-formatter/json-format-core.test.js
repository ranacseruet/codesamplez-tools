import { autoFixJSON, formatJson, sortKeysAlphabetically } from './json-format-core';

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
        expect(Object.keys(sortKeysAlphabetically(input))).toEqual(['a', 'b', 'list']);
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
        expect(Object.keys(result.formatted)).toEqual(['b', 'a']);
    });

    it('applies auto-fix before parsing when enabled', () => {
        const result = formatJson({ input: "{a:1,}", autoFix: true, sortKeys: false });
        expect(result.formatted).toEqual({ a: 1 });
    });

    it('throws on invalid JSON', () => {
        expect(() => formatJson({ input: '{invalid}', autoFix: false, sortKeys: false })).toThrow();
    });

    it('trims surrounding whitespace from the input', () => {
        const result = formatJson({ input: '  {"a":1}  ', autoFix: false, sortKeys: false });
        expect(result.formatted).toEqual({ a: 1 });
    });
});
