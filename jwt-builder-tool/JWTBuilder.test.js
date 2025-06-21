import { jest } from '@jest/globals';
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Simple polyfills for atob and btoa for the test environment
global.atob = str => Buffer.from(str, 'base64').toString('binary');
global.btoa = str => Buffer.from(str, 'binary').toString('base64');

import { JWTBuilder } from './JWTBuilder.js';

function decodeBase64Url(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}



describe('JWTBuilder', () => {
  let jwtBuilder;
  const mockSignature = new Uint8Array([1, 2, 3, 4, 5]).buffer;
  const originalCrypto = global.crypto;

  beforeAll(() => {
    if (!global.crypto) {
      global.crypto = {};
    }
    if (!global.crypto.subtle) {
      global.crypto.subtle = {};
    }
    
    global.crypto.subtle.importKey = jest.fn().mockResolvedValue('mock-key');
    global.crypto.subtle.sign = jest.fn().mockResolvedValue(mockSignature);
  });

  beforeEach(() => {
    jwtBuilder = new JWTBuilder();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.crypto = originalCrypto;
  });

  describe('getFormattedDate', () => {
    test('formats date correctly', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      const result = jwtBuilder.getFormattedDate(date);
      expect(result).toBe('2024-01-01T12:00:00Z');
    });

    test('handles different timezones', () => {
      const date = new Date('2024-01-01T12:00:00-05:00');
      const result = jwtBuilder.getFormattedDate(date);
      expect(result).toBe('2024-01-01T17:00:00Z');
    });
  });

  describe('parseDateTime', () => {
    test('parses numeric timestamp', () => {
      const timestamp = '1704110400';
      const result = jwtBuilder.parseDateTime(timestamp);
      expect(result).toBe(1704110400);
    });

    test('parses ISO date string', () => {
      const dateStr = '2024-01-01T12:00:00Z';
      const result = jwtBuilder.parseDateTime(dateStr);
      expect(result).toBe(1704110400);
    });

    test('returns null for invalid date', () => {
      const invalid = 'not-a-date';
      const result = jwtBuilder.parseDateTime(invalid);
      expect(result).toBeNull();
    });

    test('returns null for empty string', () => {
      const result = jwtBuilder.parseDateTime('');
      expect(result).toBeNull();
    });
  });

  describe('uint8ArrayToString', () => {
    test('converts Uint8Array to string', () => {
      const array = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result = jwtBuilder.uint8ArrayToString(array);
      expect(result).toBe('Hello');
    });

    test('handles empty array', () => {
      const array = new Uint8Array([]);
      const result = jwtBuilder.uint8ArrayToString(array);
      expect(result).toBe('');
    });

    test('handles large arrays', () => {
      const array = new Uint8Array(10000).fill(65); // 10000 'A' characters
      const result = jwtBuilder.uint8ArrayToString(array);
      expect(result.length).toBe(10000);
      expect(result).toBe('A'.repeat(10000));
    });
  });

  describe('base64UrlEncode', () => {
    test('encodes string input', () => {
      const input = 'Hello, World!';
      const result = jwtBuilder.base64UrlEncode(input);
      expect(result).toBe('SGVsbG8sIFdvcmxkIQ');
    });

    test('encodes ArrayBuffer input', () => {
      const encoder = new TextEncoder();
      const buffer = encoder.encode('Test').buffer;
      const result = jwtBuilder.base64UrlEncode(buffer);
      expect(result).toBe('VGVzdA');
    });

    test('encodes Uint8Array input', () => {
      const array = new Uint8Array([84, 101, 115, 116]); // "Test"
      const result = jwtBuilder.base64UrlEncode(array);
      expect(result).toBe('VGVzdA');
    });

    test('replaces base64 special characters', () => {
      const input = new Uint8Array([251, 239, 255]); // Will produce base64 with +/=
      const result = jwtBuilder.base64UrlEncode(input);
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
      expect(result).not.toContain('=');
    });
  });

  describe('generateSignature', () => {
    test('generates valid signature', async () => {
      const signingInput = 'test.input';
      const key = 'secret-key';
      
      const signature = await jwtBuilder.generateSignature(signingInput, key);
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      
      expect(crypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        new TextEncoder().encode('secret-key'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
    });

    test('throws error for empty signing input', async () => {
      await expect(jwtBuilder.generateSignature('', 'key')).rejects.toThrow();
    });

    test('throws error for empty key', async () => {
      await expect(jwtBuilder.generateSignature('input', '')).rejects.toThrow();
    });

    test('handles crypto.subtle.sign failure', async () => {
      global.crypto.subtle.sign = jest.fn().mockRejectedValue(new Error('Sign failed'));
      await expect(jwtBuilder.generateSignature('test', 'key')).rejects.toThrow('Sign failed');
    });

    test('handles crypto.subtle.sign success', async () => {
      global.crypto.subtle.sign = jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5]));
      const signature = await jwtBuilder.generateSignature('test', 'key');
      expect(signature).toBeDefined();
    });
  });

  describe('generateRandomSecret', () => {
    test('generates a random secret of specified length', () => {
      const secret = jwtBuilder.generateRandomSecret(32);
      expect(secret).toBeDefined();
      expect(secret.length).toBe(32);
    });

    test('generates different secrets on subsequent calls', () => {
      const secret1 = jwtBuilder.generateRandomSecret(32);
      const secret2 = jwtBuilder.generateRandomSecret(32);
      expect(secret1).not.toBe(secret2);
    });

    test('generates base64url encoded secret', () => {
      const secret = jwtBuilder.generateRandomSecret(32);
      // Base64url characters only
      expect(secret).toMatch(/^[A-Za-z0-9\-_]+$/);
    });
  });

  describe('buildJWT', () => {
    test('builds JWT with custom payload', async () => {
      const payload = {
        sub: 'test-user',
        name: 'Test User',
        role: 'admin'
      };
      
      const jwt = await jwtBuilder.buildJWT(payload, 'test-secret');
      expect(jwt).toBeDefined();
      expect(jwt.split('.')).toHaveLength(3);

      // Verify header and payload
      const [headerB64, payloadB64] = jwt.split('.');
      const header = JSON.parse(decodeBase64Url(headerB64));
      const decodedPayload = JSON.parse(decodeBase64Url(payloadB64));

      expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
      expect(decodedPayload).toEqual(payload);
    });

    test('builds JWT with default claims', async () => {
      const jwt = await jwtBuilder.buildJWT(null, 'test-secret');
      expect(jwt).toBeDefined();
      expect(jwt.split('.')).toHaveLength(3);

      const [headerB64, payloadB64] = jwt.split('.');
      const decodedPayload = JSON.parse(decodeBase64Url(payloadB64));

      // Verify standard claims are present
      expect(decodedPayload).toHaveProperty('iat');
      expect(decodedPayload).toHaveProperty('exp');
      expect(decodedPayload).toHaveProperty('iss');
      expect(decodedPayload).toHaveProperty('sub');
      expect(decodedPayload).toHaveProperty('aud');
      expect(decodedPayload).toHaveProperty('nbf');
      expect(decodedPayload).toHaveProperty('jti');
    });

    test('throws error when no secret key provided', async () => {
      await expect(jwtBuilder.buildJWT({ sub: 'test' }, '')).rejects.toThrow('Secret key is required for JWT signing');
    });

    test('throws error for invalid payload', async () => {
      const payload = {
        circular: {}
      };
      payload.circular.self = payload; // Create circular reference

      await expect(jwtBuilder.buildJWT(payload, 'test-secret')).rejects.toThrow();
    });

    test('creates JWT with complex nested payload', async () => {
      const payload = {
        user: {
          id: 123,
          roles: ['admin', 'user'],
          metadata: {
            created: '2024-01-01',
            active: true
          }
        }
      };
      
      const jwt = await jwtBuilder.buildJWT(payload, 'test-secret');
      expect(jwt).toBeDefined();
      
      const [headerB64, payloadB64] = jwt.split('.');
      const decodedPayload = JSON.parse(decodeBase64Url(payloadB64));
      expect(decodedPayload).toEqual(payload);
    });

    test('handles payload with special characters', async () => {
      const payload = {
        message: '!@#$%^&*()_+-=[]{}|;:,.<>?'
      };
      
      const jwt = await jwtBuilder.buildJWT(payload, 'test-secret');
      expect(jwt).toBeDefined();
      
      const [headerB64, payloadB64] = jwt.split('.');
      const decodedPayload = JSON.parse(decodeBase64Url(payloadB64));
      expect(decodedPayload).toEqual(payload);
    });

    test('handles payload with unicode characters', async () => {
      const payload = {
        message: '你好，世界！🌎'
      };
      
      const jwt = await jwtBuilder.buildJWT(payload, 'test-secret');
      expect(jwt).toBeDefined();
      
      const [headerB64, payloadB64] = jwt.split('.');
      const decodedPayload = JSON.parse(decodeBase64Url(payloadB64));
      expect(decodedPayload).toEqual(payload);
    });
  });
});
