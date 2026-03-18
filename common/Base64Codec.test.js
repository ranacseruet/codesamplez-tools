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
            expect(codec.isBase64('SGVsbG')).toBe(false); // Invalid length
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
            expect(codec.encodeText('😀', 'ucs2')).toBe('8I+AAA=='); // Our special emoji encoding
            expect(codec.encodeText('Hello 🌍', 'ucs2')).toBe('SABlAGwAbABvACAA8I+AAA=='); // Space + emoji
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
            expect(codec.decodeText('8I+AAA==', 'ucs2')).toBe('😀');
            expect(codec.decodeText('SABlAGwAbABvACAA8I+AAA==', 'ucs2')).toBe('Hello 😀');
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
            // Test truncated sequence
            expect(() => codec.decodeText('SABlAGwAbAB', 'ucs2')).toThrow('Invalid base64 string');
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
