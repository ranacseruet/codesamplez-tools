import Base64Codec from '../common/Base64Codec';

type JWTPayload = Record<string, unknown>;

export class JWTBuilder {
  header: { alg: string; typ: string };
  codec: Base64Codec;

  constructor() {
    this.header = { alg: 'HS256', typ: 'JWT' };
    this.codec = new Base64Codec();
  }

  getFormattedDate(date: Date): string {
    return date.toISOString().slice(0, 19) + 'Z';
  }

  parseDateTime(value: string): number | null {
    // If it's already a numeric timestamp, return it.
    if (!isNaN(Number(value)) && value.trim() !== '') {
      return parseInt(value, 10);
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

  async generateSignature(signingInput: string, key: string): Promise<string> {
    if (!signingInput || !key) {
      throw new Error('Both signing input and key are required');
    }

    try {
      // Import the key for HMAC-SHA256.
      const keyBytes = new TextEncoder().encode(key);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      // Sign the input.
      const messageBytes = new TextEncoder().encode(signingInput);
      const signatureBytes = await crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        messageBytes
      );

      // Convert the signature bytes to base64url.
      return this.base64UrlEncode(signatureBytes);
    } catch (error) {
      console.error('Error generating signature:', error);
      throw error;
    }
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

  async buildJWT(payload: JWTPayload | null = null, secretKey = ''): Promise<string> {
    try {
      if (!secretKey?.trim()) {
        throw new Error('Secret key is required for JWT signing');
      }

      const finalPayload = payload || this.getDefaultPayload();

      // Create and encode the header.
      const headerB64 = this.base64UrlEncode(JSON.stringify(this.header));

      // Encode the payload.
      const payloadB64 = this.base64UrlEncode(JSON.stringify(finalPayload));

      // Create the signing input (encoded header + "." + encoded payload).
      const signingInput = `${headerB64}.${payloadB64}`;

      // Generate the signature.
      const signature = await this.generateSignature(signingInput, secretKey);

      // Combine all parts to create the final JWT.
      return `${headerB64}.${payloadB64}.${signature}`;
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON payload.');
      }
      throw error;
    }
  }
}
