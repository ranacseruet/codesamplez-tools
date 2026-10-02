// Import test utilities and Base64Codec
import { setupPolyfills, cleanup } from '../base64-converter/test-utils.js';
import Base64Codec from './Base64Codec';

// Setup test environment
const original = { ...global };
setupPolyfills();
const codec = new Base64Codec();

describe('Base64Codec', () => {
    describe('isBase64', () => {
        test('validates correct base64 strings', () => {
            expect(codec.isBase64('SGVsbG8=')).toBe(true);
            expect(codec.isBase64('SGVsbG8gV29ybGQ=')).toBe(true);
            expect(codec.isBase64('YWJjZA==')).toBe(true);
            expect(codec.isBase64('YWJj')).toBe(true); // No padding needed
        });

        test('rejects invalid base64 strings', () => {
            expect(codec.isBase64('SGVsbG8===')).toBe(false); // Too many padding chars
            expect(codec.isBase64('SG VsbG8=')).toBe(false); // Space not allowed
            expect(codec.isBase64('!')).toBe(false); // Invalid char
            // Unpadded length-6 payloads are valid base64url (RFC 4648 §5),
            // so this is no longer "invalid length" — but length-1 is:
            expect(codec.isBase64('SGVsbG')).toBe(true);
            expect(codec.isBase64('abcde')).toBe(false); // Data part is 1 mod 4
            expect(codec.isBase64('=')).toBe(false); // Just padding
            expect(codec.isBase64('YWJjZA=')).toBe(false); // Wrong padding
            expect(codec.isBase64('')).toBe(false); // Empty string
            expect(codec.isBase64(null)).toBe(false); // Null
            expect(codec.isBase64(undefined)).toBe(false); // Undefined
        });

        test('validates base64 strings with padding in middle', () => {
            expect(codec.isBase64('SGVs=G8=')).toBe(false);
            expect(codec.isBase64('SG==bG8=')).toBe(false);
        });

        test('accepts unpadded URL-safe base64 (RFC 4648 §5)', () => {
            // JWT payload from issue #36: 75 chars, no padding.
            expect(codec.isBase64('eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ')).toBe(true);
            expect(codec.isBase64('SGVsbG9-fg')).toBe(true); // unpadded URL-safe
            expect(codec.isBase64('YWJj')).toBe(true); // unpadded standard, length 4
            expect(codec.isBase64('ab')).toBe(true); // unpadded, length 2
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
            expect(codec.encodeText('😀', 'ucs2')).toBe('PdgA3g=='); // UTF-16LE surrogate pair
            expect(codec.encodeText('Hello 🌍', 'ucs2')).toBe('SABlAGwAbABvACAAPNgN3w=='); // Space + emoji
        });

        test('encodes distinct astral characters distinctly in UCS-2', () => {
            // Regression: a fixed 4-byte marker collapsed every astral character
            // to the same value, so '😀' and '🌍' encoded identically.
            expect(codec.encodeText('😀', 'ucs2')).not.toBe(codec.encodeText('🌍', 'ucs2'));
        });

        test('encodes large UCS-2 input without a stack overflow', () => {
            // Regression: btoa(String.fromCharCode(...bytes)) blew the call
            // stack around ~150KB; the UTF-8 path already used the manual
            // encoder, but the UCS-2 path did not.
            const large = 'a'.repeat(200000);
            const encoded = codec.encodeText(large, 'ucs2');
            expect(encoded.length).toBe(Math.ceil((large.length * 2) / 3) * 4);
            expect(codec.decodeText(encoded, 'ucs2')).toBe(large);
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
            expect(codec.decodeText('SABlAGwAbABvACAAPNgN3w==', 'ucs2')).toBe('Hello 🌍');
        });

        test('round-trips all astral characters through UCS-2', () => {
            // Regression: the old fixed marker decoded every astral payload to
            // '😀', silently corrupting any other astral character.
            expect(codec.decodeText(codec.encodeText('🌍', 'ucs2'), 'ucs2')).toBe('🌍');
            expect(codec.decodeText(codec.encodeText('😀', 'ucs2'), 'ucs2')).toBe('😀');
            expect(codec.decodeText(codec.encodeText('a😀b🌍c', 'ucs2'), 'ucs2')).toBe('a😀b🌍c');
        });

        test('decodes URL-safe base64 consistently with isBase64', () => {
            // Regression: isBase64 accepted URL-safe input but atob rejected it,
            // so auto-detect offered a conversion that then failed.
            expect(codec.isBase64('SGVsbG9-fg==')).toBe(true);
            expect(codec.decodeText('SGVsbG9-fg==', 'utf8')).toBe('Hello~~');
            expect(codec.decodeText('SGVsbG9-fg==', 'utf8')).toBe(codec.decodeText('SGVsbG9+fg==', 'utf8'));
        });

        test('decodes unpadded URL-safe base64 the same as its padded form', () => {
            // Regression (issue #36): unpadded base64url was rejected by
            // isBase64, so decode mode threw and auto mode wrongly encoded.
            expect(codec.decodeText('SGVsbG9-fg', 'utf8')).toBe('Hello~~');
            expect(codec.decodeText('SGVsbG9-fg', 'utf8')).toBe(codec.decodeText('SGVsbG9+fg==', 'utf8'));
            expect(codec.decodeText(
                'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
                'utf8'
            )).toBe('{"sub":"1234567890","name":"John Doe","iat":1516239022}');
        });

        test('handles special characters', () => {
            expect(codec.decodeText('SGVsbG8gwqkgV29ybGQ=', 'utf8')).toBe('Hello © World');
            expect(codec.decodeText('SGVsbG8g8J+MjQ==', 'utf8')).toBe('Hello 🌍');
        });
    });

    describe('error handling', () => {
        test('throws error for invalid encoding input', () => {
            expect(() => codec.encodeText(undefined, 'utf8')).toThrow('Input text cannot be null or undefined');
            expect(() => codec.encodeText(null, 'utf8')).toThrow('Input text cannot be null or undefined');
        });

        test('throws error for invalid decoding input', () => {
            expect(() => codec.decodeText('', 'utf8')).toThrow('Input base64 string cannot be empty');
            expect(() => codec.decodeText(null, 'utf8')).toThrow('Input base64 string cannot be empty');
            expect(() => codec.decodeText('invalid base64!', 'utf8')).toThrow('Invalid base64 string');
            expect(() => codec.decodeText('SGVsbG8====', 'utf8')).toThrow('Invalid base64 string');
        });

        test('throws error for invalid UCS-2 sequences', () => {
            // Test odd number of bytes
            expect(() => codec.decodeText('AA==', 'ucs2')).toThrow('Invalid UCS-2 byte sequence');
            // Truncated sequence: 10 unpadded data chars decode to an odd
            // 7 bytes, surfacing as a UCS-2 error rather than a base64 one.
            expect(() => codec.decodeText('SABlAGwAbA', 'ucs2')).toThrow('Invalid UCS-2 byte sequence');
            // 11 unpadded data chars decode to an even byte count, so the
            // previously-rejected payload now decodes cleanly.
            expect(typeof codec.decodeText('SABlAGwAbAB', 'ucs2')).toBe('string');
        });

        test('provides specific error messages', () => {
            expect(() => codec.decodeText('!!!', 'utf8')).toThrow('Invalid base64 string');
            expect(() => codec.decodeText('AA==', 'ucs2')).toThrow('Invalid UCS-2 byte sequence');
        });
    });
});

// Restore global
Object.assign(global, original);
// Clean up JSDOM
afterEach(() => {
    document.body.innerHTML = '';
});
