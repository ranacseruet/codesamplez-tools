import { jest } from '@jest/globals';
import { webcrypto as nodeWebCrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';
import { privateKey as testPrivateKey, publicKey as testPublicKey } from './test-fixtures/rs256-test-keypair.js';
import { JWTBuilder, type JWTAlgorithm } from './JWTBuilder';

(globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder = TextEncoder;
(globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder = TextDecoder;

// Simple polyfills for atob and btoa for the test environment
(globalThis as unknown as { atob: (str: string) => string }).atob = (str: string) =>
  Buffer.from(str, 'base64').toString('binary');
(globalThis as unknown as { btoa: (str: string) => string }).btoa = (str: string) =>
  Buffer.from(str, 'binary').toString('base64');

function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

const realVerify = nodeWebCrypto.subtle.verify.bind(nodeWebCrypto.subtle);

function pemEncode(buffer: ArrayBuffer | Uint8Array): string {
  const base64 = Buffer.from(buffer as ArrayBuffer).toString('base64');
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`;
}

function pemDecode(pem: string): Uint8Array {
  const buf = Buffer.from(pem.split('\n').slice(1, -1).join(''), 'base64');
  return Uint8Array.from(buf);
}

const originalCrypto = globalThis.crypto;

// `jest.fn<any>()` no longer accepts `mockResolvedValue`/`mockRejectedValue`
// values under jest-mock 30.5.1: its `ResolveType<T>` resolves the mock's return
// type to `never` (via `OverloadedReturnType`), so every value argument fails to
// type-check. Declaring the mock as a promise-returning function keeps those
// helpers permissive while still exposing the async mock methods.
type AsyncMock = jest.Mock<(...args: any[]) => Promise<any>>;

function asyncMock(): AsyncMock {
  return jest.fn<(...args: any[]) => Promise<any>>();
}

const mockCrypto = {
  getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
    if (array) {
      nodeWebCrypto.getRandomValues(array as any);
    }
    return array;
  },
  subtle: {
    importKey: asyncMock(),
    sign: asyncMock()
  }
};

function setGlobalCrypto(value: unknown): void {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    writable: true,
    value
  });
}

async function withRealWebCrypto<T>(callback: () => Promise<T>): Promise<T> {
  const mockedCrypto = globalThis.crypto;
  setGlobalCrypto(nodeWebCrypto);

  try {
    return await callback();
  } finally {
    setGlobalCrypto(mockedCrypto);
  }
}

describe('JWTBuilder', () => {
  let jwtBuilder: JWTBuilder;
  const mockSignature = new Uint8Array([1, 2, 3, 4, 5]).buffer;

  beforeAll(() => {
    setGlobalCrypto(mockCrypto);
  });

  beforeEach(() => {
    mockCrypto.subtle.importKey = asyncMock().mockResolvedValue({ algorithm: { modulusLength: 2048 } });
    mockCrypto.subtle.sign = asyncMock().mockResolvedValue(mockSignature);
    jwtBuilder = new JWTBuilder();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    setGlobalCrypto(originalCrypto);
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

    test('returns null for non-finite numeric timestamps', () => {
      expect(jwtBuilder.parseDateTime('Infinity')).toBeNull();
      expect(jwtBuilder.parseDateTime('-Infinity')).toBeNull();
    });

    test('rejects numeric-looking timestamps that are not decimal integers', () => {
      expect(jwtBuilder.parseDateTime('1e10')).toBeNull();
      expect(jwtBuilder.parseDateTime('1.7e9')).toBeNull();
      expect(jwtBuilder.parseDateTime('0x10')).toBeNull();
    });

    test('returns null for empty string', () => {
      const result = jwtBuilder.parseDateTime('');
      expect(result).toBeNull();
    });

    test('returns null when the datetime constructor fails', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const RealDate = globalThis.Date;
      globalThis.Date = class extends RealDate {
        constructor(...args: any[]) {
          if (args[0] === 'throws') {
            throw new Error('date constructor failed');
          }
          super(...(args as [any]));
        }
      } as unknown as DateConstructor;

      try {
        expect(jwtBuilder.parseDateTime('throws')).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error parsing date:', expect.any(Error));
      } finally {
        globalThis.Date = RealDate;
        consoleErrorSpy.mockRestore();
      }
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

      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
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

    test('rejects unsupported signing algorithms', async () => {
      await expect(jwtBuilder.generateSignature('test', 'key', 'ES256' as JWTAlgorithm))
        .rejects
        .toThrow('Unsupported JWT algorithm: ES256');
    });

    test('handles crypto.subtle.sign failure', async () => {
      mockCrypto.subtle.sign = asyncMock().mockRejectedValue(new Error('Sign failed'));
      await expect(jwtBuilder.generateSignature('test', 'key')).rejects.toThrow('Sign failed');
    });

    test('handles crypto.subtle.sign success', async () => {
      mockCrypto.subtle.sign = asyncMock().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5]));
      const signature = await jwtBuilder.generateSignature('test', 'key');
      expect(signature).toBeDefined();
    });

    test('generates an RS256 signature that Node WebCrypto verifies', async () => {
      await withRealWebCrypto(async () => {
        const publicCryptoKey = await nodeWebCrypto.subtle.importKey(
          'spki',
          pemDecode(testPublicKey) as any,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify']
        );
        const privateKey = testPrivateKey;
        const jwt = await jwtBuilder.buildJWT({ sub: 'test-user' }, privateKey, 'RS256');
        const [headerB64, payloadB64, signatureB64] = jwt.split('.');

        const isValid = await realVerify(
          'RSASSA-PKCS1-v1_5',
          publicCryptoKey,
          jwtBuilder.codec.decodeBase64Url(signatureB64),
          new TextEncoder().encode(`${headerB64}.${payloadB64}`)
        );

        expect(JSON.parse(decodeBase64Url(headerB64))).toEqual({ alg: 'RS256', typ: 'JWT' });
        expect(isValid).toBe(true);
      });
    });

    test('imports RS256 keys as non-extractable sign-only keys', async () => {
      const signature = await jwtBuilder.generateSignature('header.payload', testPrivateKey, 'RS256');

      expect(signature).toBeTruthy();
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'pkcs8',
        expect.any(Uint8Array),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
      );
      expect(mockCrypto.subtle.sign).toHaveBeenCalledWith(
        'RSASSA-PKCS1-v1_5',
        { algorithm: { modulusLength: 2048 } },
        expect.anything()
      );
    });

    test('rejects RSA keys when the browser does not expose a modulus length', async () => {
      mockCrypto.subtle.importKey.mockResolvedValueOnce({ algorithm: { name: 'RSASSA-PKCS1-v1_5' } });

      await expect(jwtBuilder.generateSignature('header.payload', testPrivateKey, 'RS256'))
        .rejects
        .toThrow('Invalid RSA private key');
    });

    test('reports when Web Crypto is unavailable for RS256', async () => {
      const mockedCrypto = globalThis.crypto;
      setGlobalCrypto({});

      try {
        await expect(jwtBuilder.generateSignature('header.payload', testPrivateKey, 'RS256'))
          .rejects
          .toThrow('RS256 signing requires Web Crypto support');
      } finally {
        setGlobalCrypto(mockedCrypto);
      }
    });

    test('accepts CRLF-formatted PKCS#8 PEM keys', async () => {
      await withRealWebCrypto(async () => {
        const crlfPrivateKey = testPrivateKey.replace(/\n/g, '\r\n');
        const signature = await jwtBuilder.generateSignature('header.payload', crlfPrivateKey, 'RS256');

        expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);
      });
    });

    test('rejects RSA public keys for RS256 signing', async () => {
      await expect(
        jwtBuilder.generateSignature(
          'header.payload',
          '-----BEGIN PUBLIC KEY-----\nZm9v\n-----END PUBLIC KEY-----',
          'RS256'
        )
      ).rejects.toThrow('public keys cannot be used');
    });

    test('rejects PKCS#1 RSA public keys for RS256 signing', async () => {
      await expect(
        jwtBuilder.generateSignature(
          'header.payload',
          '-----BEGIN RSA PUBLIC KEY-----\nZm9v\n-----END RSA PUBLIC KEY-----',
          'RS256'
        )
      ).rejects.toThrow('public keys cannot be used');
    });

    test('rejects PKCS#1 RSA private keys for RS256 signing', async () => {
      await expect(
        jwtBuilder.generateSignature(
          'header.payload',
          '-----BEGIN RSA PRIVATE KEY-----\nZm9v\n-----END RSA PRIVATE KEY-----',
          'RS256'
        )
      ).rejects.toThrow('PKCS#1 RSA private keys are not supported');
    });

    test('rejects encrypted RSA private keys for RS256 signing', async () => {
      await expect(
        jwtBuilder.generateSignature(
          'header.payload',
          '-----BEGIN ENCRYPTED PRIVATE KEY-----\nZm9v\n-----END ENCRYPTED PRIVATE KEY-----',
          'RS256'
        )
      ).rejects.toThrow('Encrypted RSA private keys are not supported');
    });

    test('rejects malformed RSA private keys for RS256 signing', async () => {
      await expect(jwtBuilder.generateSignature('header.payload', 'not-a-private-key', 'RS256'))
        .rejects
        .toThrow('Invalid RSA private key');
    });

    test('rejects invalid PKCS#8 base64 content', async () => {
      await expect(
        jwtBuilder.generateSignature(
          'header.payload',
          '-----BEGIN PRIVATE KEY-----\nnot-base64\n-----END PRIVATE KEY-----',
          'RS256'
        )
      ).rejects.toThrow('Invalid RSA private key');
    });

    test('maps PEM decoding failures to a friendly RSA error', async () => {
      const originalAtob = globalThis.atob;
      (globalThis as unknown as { atob: (s: string) => string }).atob = jest.fn(() => {
        throw new Error('decode failed');
      });

      try {
        await expect(jwtBuilder.generateSignature('header.payload', testPrivateKey, 'RS256'))
          .rejects
          .toThrow('Invalid RSA private key');
      } finally {
        (globalThis as unknown as { atob: (s: string) => string }).atob = originalAtob;
      }
    });

    test('maps Web Crypto RSA import failures to a friendly RSA error', async () => {
      mockCrypto.subtle.importKey.mockRejectedValueOnce(new Error('DataError'));

      await expect(jwtBuilder.generateSignature('header.payload', testPrivateKey, 'RS256'))
        .rejects
        .toThrow('Invalid RSA private key');
    });

    test('rejects RSA private keys smaller than 2048 bits', async () => {
      await withRealWebCrypto(async () => {
        const keyPair = await nodeWebCrypto.subtle.generateKey(
          {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 1024,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256'
          },
          true,
          ['sign', 'verify']
        );
        const privateKey = pemEncode(await nodeWebCrypto.subtle.exportKey('pkcs8', keyPair.privateKey));

        await expect(jwtBuilder.generateSignature('header.payload', privateKey, 'RS256'))
          .rejects
          .toThrow('at least 2048 bits');
      });
    });
  });

  describe('generateRandomSecret', () => {
    test('uses default length of 32 when no argument provided', () => {
      const secret = jwtBuilder.generateRandomSecret();
      expect(secret).toBeDefined();
      expect(secret.length).toBe(32);
      expect(secret).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    test('generates a random secret of specified length', () => {
      const secret = jwtBuilder.generateRandomSecret(16);
      expect(secret).toBeDefined();
      expect(secret.length).toBe(16);
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

    test('throws error when buildJWT called with default empty secret key', async () => {
      await expect(jwtBuilder.buildJWT()).rejects.toThrow('Secret key is required for JWT signing');
    });

    test('throws error when no secret key provided', async () => {
      await expect(jwtBuilder.buildJWT({ sub: 'test' }, '')).rejects.toThrow('Secret key is required for JWT signing');
    });

    test('throws error for invalid payload', async () => {
      const payload: Record<string, any> = {
        circular: {}
      };
      payload.circular.self = payload; // Create circular reference

      await expect(jwtBuilder.buildJWT(payload, 'test-secret')).rejects.toThrow();
    });

    test('maps JSON serialization errors to a user-facing payload error', async () => {
      const payload = {
        toJSON() {
          throw new SyntaxError('unexpected syntax');
        }
      };

      await expect(jwtBuilder.buildJWT(payload, 'test-secret'))
        .rejects
        .toThrow('Invalid JSON payload.');
    });

    test('rejects payloads whose JSON serialization is undefined', async () => {
      const payload = {
        toJSON() {
          return undefined;
        }
      };

      await expect(jwtBuilder.buildJWT(payload as any, 'test-secret'))
        .rejects
        .toThrow('Invalid JSON payload.');
    });

    test('does not map signing SyntaxError to a payload error', async () => {
      const signingError = new SyntaxError('unexpected signing syntax');
      jest.spyOn(jwtBuilder, 'generateSignature').mockRejectedValueOnce(signingError);

      await expect(jwtBuilder.buildJWT({ sub: 'test-user' }, 'test-secret'))
        .rejects
        .toThrow('unexpected signing syntax');
    });

    test('uses the requested algorithm only for the current call', async () => {
      jest.spyOn(jwtBuilder, 'generateSignature').mockResolvedValue('signature');

      const rsJwt = await jwtBuilder.buildJWT({ sub: 'test-user' }, 'test-secret', 'RS256');
      const hsJwt = await jwtBuilder.buildJWT({ sub: 'test-user' }, 'test-secret');

      expect(JSON.parse(decodeBase64Url(rsJwt.split('.')[0]))).toEqual({ alg: 'RS256', typ: 'JWT' });
      expect(JSON.parse(decodeBase64Url(hsJwt.split('.')[0]))).toEqual({ alg: 'HS256', typ: 'JWT' });
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
