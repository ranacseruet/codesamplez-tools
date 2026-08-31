import Base64Codec from '../common/Base64Codec';

type JWTPayload = Record<string, unknown>;
export type JWTAlgorithm = 'HS256' | 'RS256';

const RSA_PRIVATE_KEY_ERROR = 'Invalid RSA private key. Expected an unencrypted PKCS#8 PEM key.';
const RSA_WEAK_KEY_ERROR = 'RSA private key must be at least 2048 bits.';
const RSA_WEB_CRYPTO_ERROR = 'RS256 signing requires Web Crypto support in a secure browser context.';

export class JWTBuilder {
  codec: Base64Codec;

  constructor() {
    this.codec = new Base64Codec();
  }

  getFormattedDate(date: Date): string {
    return date.toISOString().slice(0, 19) + 'Z';
  }

  parseDateTime(value: string): number | null {
    // If it's already a numeric timestamp, return it.
    const trimmedValue = value.trim();
    const numericValue = Number(trimmedValue);
    if (trimmedValue !== '' && Number.isFinite(numericValue)) {
      if (!/^[+-]?\d+$/.test(trimmedValue) || !Number.isSafeInteger(numericValue)) {
        return null;
      }
      return numericValue;
    }

    try {
      // Try to parse as a datetime string.
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return Math.floor(date.getTime() / 1000);
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }

    return null;
  }

  uint8ArrayToString(array: Uint8Array): string {
    return new TextDecoder().decode(array);
  }

  base64UrlEncode(input: string | ArrayBuffer | Uint8Array): string {
    const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
    return this.codec.encodeBase64Url(data);
  }

  private validateAlgorithm(algorithm: JWTAlgorithm): void {
    if (algorithm !== 'HS256' && algorithm !== 'RS256') {
      throw new Error(`Unsupported JWT algorithm: ${String(algorithm)}`);
    }
  }

  private decodeRS256PrivateKey(key: string): Uint8Array {
    const normalizedKey = key.trim();

    if (
      /-----BEGIN ENCRYPTED PRIVATE KEY-----/i.test(normalizedKey) ||
      /(?:^|\r?\n)(?:Proc-Type:\s*4,ENCRYPTED|DEK-Info:)/i.test(normalizedKey)
    ) {
      throw new Error('Encrypted RSA private keys are not supported. Provide an unencrypted PKCS#8 key.');
    }

    if (/-----BEGIN (?:RSA )?PUBLIC KEY-----/i.test(normalizedKey)) {
      throw new Error('RSA public keys cannot be used for signing. Provide a private key.');
    }

    if (/-----BEGIN RSA PRIVATE KEY-----/i.test(normalizedKey)) {
      throw new Error('PKCS#1 RSA private keys are not supported. Convert the key to unencrypted PKCS#8 format.');
    }

    const pemMatch = normalizedKey.match(
      /^-----BEGIN PRIVATE KEY-----\s*([\s\S]*?)\s*-----END PRIVATE KEY-----$/i
    );
    if (!pemMatch) {
      throw new Error(RSA_PRIVATE_KEY_ERROR);
    }

    const base64 = pemMatch[1].replace(/\s+/g, '');
    if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
      throw new Error(RSA_PRIVATE_KEY_ERROR);
    }

    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(new ArrayBuffer(binary.length));
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    } catch (_error) {
      throw new Error(RSA_PRIVATE_KEY_ERROR);
    }
  }

  private async importRS256PrivateKey(key: string): Promise<CryptoKey> {
    const keyData = this.decodeRS256PrivateKey(key);

    if (
      typeof globalThis.crypto?.subtle?.importKey !== 'function' ||
      typeof globalThis.crypto?.subtle?.sign !== 'function'
    ) {
      throw new Error(RSA_WEB_CRYPTO_ERROR);
    }

    try {
      const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        keyData as BufferSource,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const modulusLength = (cryptoKey.algorithm as RsaHashedKeyAlgorithm | undefined)?.modulusLength;
      if (typeof modulusLength !== 'number') {
        throw new Error(RSA_PRIVATE_KEY_ERROR);
      }
      if (modulusLength < 2048) {
        throw new Error(RSA_WEAK_KEY_ERROR);
      }

      return cryptoKey;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        [RSA_PRIVATE_KEY_ERROR, RSA_WEAK_KEY_ERROR, RSA_WEB_CRYPTO_ERROR].includes(error.message)
      ) {
        throw error;
      }
      throw new Error(RSA_PRIVATE_KEY_ERROR);
    }
  }

  async generateSignature(
    signingInput: string,
    key: string,
    algorithm: JWTAlgorithm = 'HS256'
  ): Promise<string> {
    if (!signingInput || !key) {
      throw new Error('Both signing input and key are required');
    }

    this.validateAlgorithm(algorithm);

    let cryptoKey: CryptoKey;
    let signatureAlgorithm: AlgorithmIdentifier;

    if (algorithm === 'HS256') {
      // Import the key for HMAC-SHA256.
      const keyBytes = new TextEncoder().encode(key);
      cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      signatureAlgorithm = 'HMAC';
    } else {
      cryptoKey = await this.importRS256PrivateKey(key);
      signatureAlgorithm = 'RSASSA-PKCS1-v1_5';
    }

    // Sign the input.
    const messageBytes = new TextEncoder().encode(signingInput);
    const signatureBytes = await crypto.subtle.sign(
      signatureAlgorithm,
      cryptoKey,
      messageBytes
    );

    // Convert the signature bytes to base64url.
    return this.base64UrlEncode(signatureBytes);
  }

  private serializePayload(payload: JWTPayload): string {
    let serializedPayload: string | undefined;

    try {
      serializedPayload = JSON.stringify(payload);
    } catch (_error) {
      throw new Error('Invalid JSON payload.');
    }

    if (serializedPayload === undefined) {
      throw new Error('Invalid JSON payload.');
    }

    return serializedPayload;
  }

  getDefaultPayload(): JWTPayload {
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

    return {
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(sixMonthsFromNow.getTime() / 1000),
      iss: 'your-issuer',
      sub: 'your-subject',
      aud: 'your-audience',
      nbf: Math.floor(now.getTime() / 1000),
      jti: 'your-jti'
    };
  }

  generateRandomSecret(length = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array).substring(0, length);
  }

  async buildJWT(
    payload: JWTPayload | null = null,
    secretKey = '',
    algorithm: JWTAlgorithm = 'HS256'
  ): Promise<string> {
    this.validateAlgorithm(algorithm);

    if (!secretKey?.trim()) {
      throw new Error('Secret key is required for JWT signing');
    }

    const finalPayload = payload || this.getDefaultPayload();
    const payloadJson = this.serializePayload(finalPayload);

    // Create and encode the header for this call without retaining algorithm state between calls.
    const headerB64 = this.base64UrlEncode(JSON.stringify({ alg: algorithm, typ: 'JWT' }));

    // Encode the payload.
    const payloadB64 = this.base64UrlEncode(payloadJson);

    // Create the signing input (encoded header + "." + encoded payload).
    const signingInput = `${headerB64}.${payloadB64}`;

    // Generate the signature.
    const signature = await this.generateSignature(signingInput, secretKey, algorithm);

    // Combine all parts to create the final JWT.
    return `${headerB64}.${payloadB64}.${signature}`;
  }
}
