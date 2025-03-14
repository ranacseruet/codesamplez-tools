import { decodeJWTToken } from './script.js';

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
