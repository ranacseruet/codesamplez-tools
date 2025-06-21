// Import the class and standalone function
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
import { JWTDecoder, hmacSha256 } from './JWTDecoder.js';

// Helper function needed for comparing results in tests
// Note: Using atob/binaryString for jsdom environment compatibility
function base64UrlToUint8Array(base64Url) {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    switch (base64.length % 4) {
        case 0: break;
        case 2: base64 += '=='; break;
        case 3: base64 += '='; break;
        default: throw new Error('Invalid base64url length');
    }
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Define the mock hmacSha256 implementation to be injected into verifySignature
const mockHmacSha256 = async (message, key) => {
    if (!message || !key) {
        throw new Error('Invalid input: message and key are required');
    }
    // Pre-calculated signature for the standard test token and secret
    const validSignatureBytes = base64UrlToUint8Array('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
    const invalidSignatureBytes = new Uint8Array(32).fill(1); // Use non-zero bytes for clarity

    // Simulate correct signature only for the specific secret
    if (key === 'your-256-bit-secret') {
        return validSignatureBytes;
    } else {
        return invalidSignatureBytes; // Return a distinctly different signature for wrong keys
    }
};


describe('JWTDecoder Class', () => {
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const validSecret = 'your-256-bit-secret';
    const invalidSecret = 'wrong-secret';
    const tokenWithInvalidJson = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjIsImFnZSI6MzB9.invalidJsonPayload'; // Header ok, payload invalid json structure
    const tokenWithInvalidBase64 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid-base64-payload.signature';
    const tokenWithTwoParts = 'header.payload';
    const emptyToken = '';

    describe('Constructor and Parsing', () => {
        it('should correctly parse a valid JWT token', () => {
            const decoder = new JWTDecoder(validToken);
            expect(decoder.isValidFormat).toBe(true);
            expect(decoder.getParsingError()).toBeNull();
            expect(decoder.getHeader()).toEqual({ alg: "HS256", typ: "JWT" });
            expect(decoder.getPayload()).toEqual({ sub: "1234567890", name: "John Doe", iat: 1516239022 });
            expect(decoder.getSignature()).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
        });

        it('should handle tokens with invalid JSON in header or payload', () => {
            // Example: Payload is not valid JSON after base64 decoding
            const invalidJsonToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aW52YWxpZCBqc29uIHNhbXBsZQ.signature'; // Invalid JSON in payload
            const decoder = new JWTDecoder(invalidJsonToken);
            expect(decoder.isValidFormat).toBe(true); // Format (3 parts) is still valid
            expect(decoder.getParsingError()).toMatch(/Failed to parse payload: Unexpected token/); // Specific payload error
            expect(decoder.getHeader()).toEqual({ alg: "HS256", typ: "JWT" }); // Header should parse correctly
            expect(decoder.getPayload()).toBeNull(); // Payload parsing failed
            expect(decoder.getSignature()).toBe('signature');
        });

        it('should handle tokens with invalid base64url encoding', () => {
            const decoder = new JWTDecoder(tokenWithInvalidBase64);
            expect(decoder.isValidFormat).toBe(true); // Format (3 parts) is still valid
            // Expect a JSON parsing error because the decoded base64 is not valid JSON
            expect(decoder.getParsingError()).toMatch(/Failed to parse payload: Unexpected token/);
            expect(decoder.getHeader()).toEqual({ alg: "HS256", typ: "JWT" }); // Header should still parse ok
            expect(decoder.getPayload()).toBeNull(); // Payload parsing failed due to JSON error
            expect(decoder.getSignature()).toBe('signature');
        });

        it('should handle tokens with incorrect number of parts', () => {
            const decoder = new JWTDecoder(tokenWithTwoParts);
            expect(decoder.isValidFormat).toBe(false);
            expect(decoder.getParsingError()).toBe('Invalid token format (must have 3 parts)');
            expect(decoder.getHeader()).toBeNull();
            expect(decoder.getPayload()).toBeNull();
            expect(decoder.getSignature()).toBeNull(); // No signature part identified
        });

        it('should handle empty or null token strings', () => {
            const decoder = new JWTDecoder(emptyToken);
            expect(decoder.isValidFormat).toBe(false);
            expect(decoder.getParsingError()).toBe('No token provided');
            expect(decoder.getHeader()).toBeNull();
            expect(decoder.getPayload()).toBeNull();
            expect(decoder.getSignature()).toBeNull();

            const nullDecoder = new JWTDecoder(null);
            expect(nullDecoder.isValidFormat).toBe(false);
            expect(nullDecoder.getParsingError()).toBe('No token provided');
        });
    });

    describe('verifySignature', () => {
        it('should return true for a valid signature using injected mock', async () => {
            const decoder = new JWTDecoder(validToken);
            const isValid = await decoder.verifySignature(validSecret, mockHmacSha256);
            expect(isValid).toBe(true);
        });

        it('should return false for an invalid signature using injected mock', async () => {
            const decoder = new JWTDecoder(validToken);
            const isValid = await decoder.verifySignature(invalidSecret, mockHmacSha256);
            expect(isValid).toBe(false);
        });

        it('should return false if the token format was invalid', async () => {
            const decoder = new JWTDecoder(tokenWithTwoParts);
            const isValid = await decoder.verifySignature(validSecret, mockHmacSha256);
            expect(isValid).toBe(false);
        });

        it('should return false if no secret is provided', async () => {
            const decoder = new JWTDecoder(validToken);
            const isValid = await decoder.verifySignature('', mockHmacSha256); // Empty secret
            expect(isValid).toBe(false);
            const isValidNull = await decoder.verifySignature(null, mockHmacSha256); // Null secret
            expect(isValidNull).toBe(false);
        });

        it('should return false if the signature part is missing (handled by constructor)', async () => {
             const tokenNoSig = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.'; // Trailing dot indicates empty signature part
             const decoder = new JWTDecoder(tokenNoSig);
             expect(decoder.isValidFormat).toBe(true); // Format is 3 parts
             expect(decoder.getHeader()).not.toBeNull(); // Header should parse
             expect(decoder.getPayload()).not.toBeNull(); // Payload should parse
             expect(decoder.getSignature()).toBe(''); // Signature is empty string
             const isValid = await decoder.verifySignature(validSecret, mockHmacSha256);
             expect(isValid).toBe(false); // Verification fails because signature is empty/incorrect
        });

        // Test using the actual hmacSha256 (might fail if crypto not available)
        // This tests the integration, assuming the actual hmac works
        /*
        it('should validate correctly using the actual hmacSha256 (if crypto available)', async () => {
            const decoder = new JWTDecoder(validToken);
            try {
                // Use the default hmacSha256 from the module
                const isValid = await decoder.verifySignature(validSecret);
                expect(isValid).toBe(true);

                const isInvalid = await decoder.verifySignature(invalidSecret);
                expect(isInvalid).toBe(false);
            } catch (e) {
                 // Expect failure if crypto.subtle is not available in the test environment
                 expect(e.message).toContain('Web Crypto API (crypto.subtle) not available');
            }
        });
        */
    });

    // Test the standalone hmacSha256 function (actual/mock)
    describe('hmacSha256 (standalone function)', () => {
        // Test the mock directly for predictable results
        it('mockHmacSha256 should return correct mock signature for the known secret', async () => {
            const expectedSig = base64UrlToUint8Array('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
            const signature = await mockHmacSha256('any message', validSecret);
            expect(signature).toEqual(expectedSig);
        });

        it('mockHmacSha256 should return invalid mock signature for other secrets', async () => {
            const invalidSig = new Uint8Array(32).fill(1);
            const signature = await mockHmacSha256('any message', invalidSecret);
            expect(signature).toEqual(invalidSig);
        });

        it('mockHmacSha256 throws error for empty message', async () => {
            await expect(mockHmacSha256('', 'key')).rejects.toThrow('Invalid input: message and key are required');
        });

        it('mockHmacSha256 throws error for empty key', async () => {
            await expect(mockHmacSha256('message', '')).rejects.toThrow('Invalid input: message and key are required');
        });

        // Optionally, test the actual hmacSha256 if the environment supports it
        /*
        it('actual hmacSha256 should generate a signature (if crypto available)', async () => {
            try {
                const signature = await hmacSha256('test message', 'test key');
                expect(signature).toBeInstanceOf(Uint8Array);
                expect(signature.length).toBe(32); // SHA-256 output length
            } catch (e) {
                // Expect failure if crypto.subtle is not available
                expect(e.message).toContain('Web Crypto API (crypto.subtle) not available');
            }
        });

        it('actual hmacSha256 should throw error for invalid input', async () => {
             await expect(hmacSha256('', 'key')).rejects.toThrow('Invalid input: message and key are required');
             await expect(hmacSha256('message', '')).rejects.toThrow('Invalid input: message and key are required');
        });
        */
    });

    // No need to test isBase64 as it was removed/not used by the class or script.js
});
