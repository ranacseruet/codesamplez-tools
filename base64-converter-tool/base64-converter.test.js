// Setup minimal test environment
const original = { ...global };

// TextEncoder/Decoder polyfills
global.TextEncoder = class {
    encode(str) {
        return new Uint8Array([...str].map(ch => ch.charCodeAt(0)));
    }
};
global.TextDecoder = class {
    decode(arr) {
        return String.fromCharCode(...arr);
    }
};

// btoa/atob polyfills
if (!global.btoa) {
    global.btoa = str => Buffer.from(str, 'binary').toString('base64');
}
if (!global.atob) {
    global.atob = str => Buffer.from(str, 'base64').toString('binary');
}

// Import Base64Codec
const Base64Codec = require('./Base64Codec.js');
const codec = new Base64Codec();

describe('Base64Codec', () => {
    describe('isBase64', () => {
        test('validates correct base64 strings', () => {
            expect(codec.isBase64('SGVsbG8=')).toBe(true);
            expect(codec.isBase64('SGVsbG8gV29ybGQ=')).toBe(true);
            expect(codec.isBase64('YWJjZA==')).toBe(true);
        });

        test('rejects invalid base64 strings', () => {
            expect(codec.isBase64('SGVsbG8===')).toBe(false); // Too many padding chars
            expect(codec.isBase64('SG VsbG8=')).toBe(false); // Space not allowed
            expect(codec.isBase64('!')).toBe(false); // Invalid char
            expect(codec.isBase64('SGVsbG')).toBe(false); // Invalid length
        });
    });

    describe('encodeText', () => {
        test('encodes UTF-8 text correctly', () => {
            expect(codec.encodeText('Hello', 'utf8')).toBe('SGVsbG8=');
            expect(codec.encodeText('Hello World', 'utf8')).toBe('SGVsbG8gV29ybGQ=');
            expect(codec.encodeText('', 'utf8')).toBe('');
        });

        test('encodes ASCII text correctly', () => {
            expect(codec.encodeText('Hello', 'ascii')).toBe('SGVsbG8=');
            expect(codec.encodeText('Hello©', 'ascii')).toBe('SGVsbG8/'); // © becomes ?
        });

        test('encodes ISO-8859-1 text correctly', () => {
            expect(codec.encodeText('Hello', 'iso88591')).toBe('SGVsbG8=');
            const euro = String.fromCharCode(0x80);
            expect(codec.encodeText(`Hello${euro}`, 'iso88591')).toBe('SGVsbG+A');
        });

        test('encodes UCS-2 text correctly', () => {
            expect(codec.encodeText('Hello', 'ucs2')).toBe('SABlAGwAbABvAA==');
            expect(codec.encodeText('😀', 'ucs2')).toBe('PdgA3g=='); // Emoji test
        });

        test('handles special characters', () => {
            expect(codec.encodeText('Hello © World', 'utf8')).toBe('SGVsbG8gwqkgV29ybGQ=');
            expect(codec.encodeText('Hello 🌍', 'utf8')).toBe('SGVsbG8g8J+MjQ==');
        });
    });

    describe('decodeText', () => {
        test('decodes UTF-8 text correctly', () => {
            expect(codec.decodeText('SGVsbG8=', 'utf8')).toBe('Hello');
            expect(codec.decodeText('SGVsbG8gV29ybGQ=', 'utf8')).toBe('Hello World');
        });

        test('decodes ASCII text correctly', () => {
            expect(codec.decodeText('SGVsbG8=', 'ascii')).toBe('Hello');
        });

        test('decodes ISO-8859-1 text correctly', () => {
            expect(codec.decodeText('SGVsbG8=', 'iso88591')).toBe('Hello');
        });

        test('decodes UCS-2 text correctly', () => {
            expect(codec.decodeText('SABlAGwAbABvAA==', 'ucs2')).toBe('Hello');
            expect(codec.decodeText('PdgA3g==', 'ucs2')).toBe('😀');
        });

        test('handles special characters', () => {
            expect(codec.decodeText('SGVsbG8gwqkgV29ybGQ=', 'utf8')).toBe('Hello © World');
            expect(codec.decodeText('SGVsbG8g8J+MjQ==', 'utf8')).toBe('Hello 🌍');
        });
    });

    describe('error handling', () => {
        test('throws error for invalid encoding input', () => {
            expect(() => codec.encodeText(undefined, 'utf8')).toThrow();
            expect(() => codec.encodeText(null, 'utf8')).toThrow();
        });

        test('throws error for invalid decoding input', () => {
            expect(() => codec.decodeText('invalid base64!', 'utf8')).toThrow();
            expect(() => codec.decodeText('SGVsbG8====', 'utf8')).toThrow(); // Invalid padding
        });
    });
});

// Restore global
Object.assign(global, original);
