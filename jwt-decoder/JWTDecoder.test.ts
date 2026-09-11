import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'node:util';
import { JWTDecoder, hmacSha256 } from './JWTDecoder';
import Base64Codec from '../common/Base64Codec';

(globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder = TextEncoder;
(globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder = TextDecoder;

// Helper function needed for comparing results in tests
function base64UrlToUint8Array(base64Url: string): Uint8Array {
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
const mockHmacSha256 = async (message: string, key: string): Promise<Uint8Array> => {
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
    const codec = new Base64Codec();
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const validSecret = 'your-256-bit-secret';
    const invalidSecret = 'wrong-secret';
    const tokenWithInvalidBase64 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid-base64-payload.signature';
    const tokenWithTwoParts = 'header.payload';
    const emptyToken = '';
    const unsupportedAlgToken = [
        codec.encodeBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
        codec.encodeBase64Url(JSON.stringify({ sub: '1234567890', name: 'John Doe', iat: 1516239022 })),
        'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    ].join('.');

    describe('Constructor and Parsing', () => {
        it('should correctly parse a valid JWT token', () => {
            const decoder = new JWTDecoder(validToken);
            expect(decoder.isValidFormat).toBe(true);
            expect(decoder.getParsingError()).toBeNull();
            expect(decoder.getHeader()).toEqual({ alg: 'HS256', typ: 'JWT' });
            expect(decoder.getPayload()).toEqual({ sub: '1234567890', name: 'John Doe', iat: 1516239022 });
            expect(decoder.getSignature()).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
            expect(decoder.getAlgorithm()).toBe('HS256');
        });

        it('should handle tokens with invalid JSON in header or payload', () => {
            const invalidJsonToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aW52YWxpZCBqc29uIHNhbXBsZQ.signature';
            const decoder = new JWTDecoder(invalidJsonToken);
            expect(decoder.isValidFormat).toBe(true);
            expect(decoder.getParsingError()).toMatch(/Failed to parse payload: Unexpected token/);
            expect(decoder.getHeader()).toEqual({ alg: 'HS256', typ: 'JWT' });
            expect(decoder.getPayload()).toBeNull();
            expect(decoder.getSignature()).toBe('signature');
        });

        it('combines errors when both header and payload fail to parse', () => {
            const invalidBothToken = 'aW52YWxpZA.aW52YWxpZA.signature';
            const decoder = new JWTDecoder(invalidBothToken);
            expect(decoder.isValidFormat).toBe(true);
            const error = decoder.getParsingError();
            expect(error).toContain('Failed to parse header:');
            expect(error).toContain('Failed to parse payload:');
            expect(decoder.getHeader()).toBeNull();
            expect(decoder.getPayload()).toBeNull();
        });

        it('returns null algorithm when header alg is not a string or missing', () => {
            const noAlgToken = [
                codec.encodeBase64Url(JSON.stringify({ typ: 'JWT' })),
                codec.encodeBase64Url(JSON.stringify({ sub: '123' })),
                'sig'
            ].join('.');
            const decoderNoAlg = new JWTDecoder(noAlgToken);
            expect(decoderNoAlg.getAlgorithm()).toBeNull();

            const numberAlgToken = [
                codec.encodeBase64Url(JSON.stringify({ alg: 123, typ: 'JWT' })),
                codec.encodeBase64Url(JSON.stringify({ sub: '123' })),
                'sig'
            ].join('.');
            const decoderNumberAlg = new JWTDecoder(numberAlgToken);
            expect(decoderNumberAlg.getAlgorithm()).toBeNull();

            const invalidHeaderToken = 'aW52YWxpZA.eyJuYW1lIjoiSm9obiJ9.signature';
            const decoderInvalidHeader = new JWTDecoder(invalidHeaderToken);
            expect(decoderInvalidHeader.getAlgorithm()).toBeNull();
        });

        it('should handle tokens with invalid base64url encoding', () => {
            const decoder = new JWTDecoder(tokenWithInvalidBase64);
            expect(decoder.isValidFormat).toBe(true);
            expect(decoder.getParsingError()).toMatch(/Failed to parse payload: Unexpected token/);
            expect(decoder.getHeader()).toEqual({ alg: 'HS256', typ: 'JWT' });
            expect(decoder.getPayload()).toBeNull();
            expect(decoder.getSignature()).toBe('signature');
        });

        it('should stringify non-Error header parsing failures', () => {
            const decodeSpy = jest
                .spyOn(Base64Codec.prototype, 'decodeBase64Url')
                .mockImplementationOnce(() => {
                    throw 'header-decode-failure';
                });

            const decoder = new JWTDecoder(validToken);

            expect(decoder.isValidFormat).toBe(true);
            expect(decoder.getHeader()).toBeNull();
            expect(decoder.getParsingError()).toContain('Failed to parse header: header-decode-failure');
            decodeSpy.mockRestore();
        });

        it('should handle tokens with incorrect number of parts', () => {
            const decoder = new JWTDecoder(tokenWithTwoParts);
            expect(decoder.isValidFormat).toBe(false);
            expect(decoder.getParsingError()).toBe('Invalid token format (must have 3 parts)');
            expect(decoder.getHeader()).toBeNull();
            expect(decoder.getPayload()).toBeNull();
            expect(decoder.getSignature()).toBeNull();
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

            const undefinedDecoder = new JWTDecoder(undefined);
            expect(undefinedDecoder.isValidFormat).toBe(false);
            expect(undefinedDecoder.getParsingError()).toBe('No token provided');
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

        it('uses default hmacSha256 when no hmacFunc parameter is passed', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const decoder = new JWTDecoder(validToken);
            const isValid = await decoder.verifySignature(validSecret);
            expect(typeof isValid).toBe('boolean');
            consoleSpy.mockRestore();
        });

        it('should return false if the token format was invalid', async () => {
            const decoder = new JWTDecoder(tokenWithTwoParts);
            const isValid = await decoder.verifySignature(validSecret, mockHmacSha256);
            expect(isValid).toBe(false);
        });

        it('should return false if no secret is provided', async () => {
            const decoder = new JWTDecoder(validToken);
            const isValid = await decoder.verifySignature('', mockHmacSha256);
            expect(isValid).toBe(false);
            const isValidNull = await decoder.verifySignature(null, mockHmacSha256);
            expect(isValidNull).toBe(false);
        });

        it('should return false if header or payload failed to parse', async () => {
            const invalidHeaderToken = 'aW52YWxpZA.eyJuYW1lIjoiSm9obiJ9.signature';
            const decoderBadHeader = new JWTDecoder(invalidHeaderToken);
            expect(await decoderBadHeader.verifySignature(validSecret, mockHmacSha256)).toBe(false);

            const invalidPayloadToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aW52YWxpZA.signature';
            const decoderBadPayload = new JWTDecoder(invalidPayloadToken);
            expect(await decoderBadPayload.verifySignature(validSecret, mockHmacSha256)).toBe(false);
        });

        it('should return false if the signature part is missing (handled by constructor)', async () => {
            const tokenNoSig = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.';
            const decoder = new JWTDecoder(tokenNoSig);
            expect(decoder.isValidFormat).toBe(true);
            expect(decoder.getHeader()).not.toBeNull();
            expect(decoder.getPayload()).not.toBeNull();
            expect(decoder.getSignature()).toBe('');
            const isValid = await decoder.verifySignature(validSecret, mockHmacSha256);
            expect(isValid).toBe(false);
        });

        it('should return false when computed and provided signatures differ in length', async () => {
            const decoder = new JWTDecoder(validToken);
            const shortSignatureHmac = async () => new Uint8Array([1, 2, 3]);

            const isValid = await decoder.verifySignature(validSecret, shortSignatureHmac);
            expect(isValid).toBe(false);
        });

        it('should reject tokens whose declared algorithm is not HS256', async () => {
            const decoder = new JWTDecoder(unsupportedAlgToken);
            const hmacSpy = jest.fn(mockHmacSha256);

            const isValid = await decoder.verifySignature(validSecret, hmacSpy);

            expect(decoder.getAlgorithm()).toBe('RS256');
            expect(isValid).toBe(false);
            expect(hmacSpy).not.toHaveBeenCalled();
        });

        it('should return false when signature verification throws', async () => {
            const decoder = new JWTDecoder(validToken);
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const failingHmac = async () => {
                throw 'verification-runtime-error';
            };

            const isValid = await decoder.verifySignature(validSecret, failingHmac);

            expect(isValid).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error validating JWT signature:', 'verification-runtime-error');
            consoleErrorSpy.mockRestore();
        });
    });

    describe('hmacSha256 mock helper', () => {
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
    });
});
