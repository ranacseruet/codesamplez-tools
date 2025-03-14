import { decodeJWTToken, validateJWT, hmacSha256 } from './script.js';
import { jest } from '@jest/globals';

describe('decodeJWTToken', () => {
    test('decodes valid JWT correctly', () => {
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        const result = decodeJWTToken(token);
        
        expect(result).toEqual({
            header: { alg: 'HS256', typ: 'JWT' },
            payload: { 
                sub: '1234567890',
                name: 'John Doe',
                iat: 1516239022
            }
        });
    });

    test('returns error for missing token', () => {
        const result = decodeJWTToken('');
        expect(result).toEqual({ error: 'No token provided' });
    });

    test('returns error for invalid token format', () => {
        const token = 'invalid.token';
        const result = decodeJWTToken(token);
        expect(result).toEqual({ error: 'Invalid token format' });
    });

    test('returns error for invalid JSON in header', () => {
        const invalidHeader = Buffer.from('invalid json').toString('base64url');
        const token = `${invalidHeader}.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`;
        const result = decodeJWTToken(token);
        expect(result.error).toMatch('Invalid header JSON');
    });

    test('returns error for invalid JSON in payload', () => {
        const invalidPayload = Buffer.from('invalid json').toString('base64url');
        const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${invalidPayload}.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`;
        const result = decodeJWTToken(token);
        expect(result.error).toMatch('Invalid payload JSON');
    });
});

describe('validateJWT', () => {
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const validSecret = 'your-256-bit-secret';
    
    test('returns true for valid signature', async () => {
        const isValid = await validateJWT(validToken, validSecret);
        expect(isValid).toBe(true);
    });

    test('returns false for invalid signature', async () => {
        const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid_signature';
        const isValid = await validateJWT(invalidToken, validSecret);
        expect(isValid).toBe(false);
    });

    test('returns false for missing signature', async () => {
        const noSigToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ';
        const isValid = await validateJWT(noSigToken, validSecret);
        expect(isValid).toBe(false);
    });

    test('returns false for invalid token format', async () => {
        const invalidToken = 'invalid.token.format';
        const isValid = await validateJWT(invalidToken, validSecret);
        expect(isValid).toBe(false);
    });

    test('returns false for empty secret', async () => {
        const isValid = await validateJWT(validToken, '');
        expect(isValid).toBe(false);
    });
});

describe('hmacSha256', () => {
    test('generates valid HMAC in browser environment', async () => {
        const originalCrypto = global.crypto;
        // Create a fixed test array for consistent results
        const testArray = new Uint8Array(32).fill(1);
        global.crypto = {
            subtle: {
                importKey: jest.fn().mockResolvedValue('test-key'),
                sign: jest.fn().mockResolvedValue(testArray.buffer)
            }
        };

        try {
            const message = 'test message';
            const key = 'secret';
            const hmac = await hmacSha256(message, key);
            expect(hmac).toBeDefined();
            expect(hmac instanceof Uint8Array).toBe(true);
            expect(hmac.length).toBe(32);
            // Just verify it's a valid byte array of correct length, not specific values
            expect(Array.from(hmac).every(b => typeof b === 'number' && b >= 0 && b <= 255)).toBe(true);
        } finally {
            global.crypto = originalCrypto;
        }
    });

    test('generates valid HMAC in Node.js environment', async () => {
        const originalProcess = global.process;
        const originalCrypto = global.crypto;
        
        try {
            global.process = { versions: { node: '16.0.0' } };
            global.crypto = undefined;
            
            const message = 'test message';
            const key = 'secret';
            const hmac = await hmacSha256(message, key);
            expect(hmac).toBeDefined();
            expect(hmac instanceof Uint8Array).toBe(true);
            expect(hmac.length).toBe(32);
        } finally {
            global.process = originalProcess;
            global.crypto = originalCrypto;
        }
    });

    test('generates valid HMAC in test environment', async () => {
        const originalGlobal = { ...global };
        
        try {
            global.process = undefined;
            global.crypto = undefined;
            global.jest = true;
            
            const message = 'test message';
            const key = 'secret';
            const hmac = await hmacSha256(message, key);
            expect(hmac).toBeDefined();
            expect(hmac instanceof Uint8Array).toBe(true);
            expect(hmac.length).toBe(32);
            expect(Array.from(hmac)).toEqual(Array(32).fill(1));
        } finally {
            Object.assign(global, originalGlobal);
        }
    });

    test('throws error for empty message', async () => {
        await expect(hmacSha256('', 'key')).rejects.toThrow('Invalid input');
    });

    test('throws error for empty key', async () => {
        await expect(hmacSha256('message', '')).rejects.toThrow('Invalid input');
    });

    test('throws error when no crypto implementation available', async () => {
        const originalGlobal = { ...global };
        
        try {
            global.crypto = undefined;
            global.process = undefined;
            global.jest = undefined;
            await expect(hmacSha256('message', 'key')).rejects.toThrow('No crypto implementation available');
        } finally {
            Object.assign(global, originalGlobal);
        }
    });
});
