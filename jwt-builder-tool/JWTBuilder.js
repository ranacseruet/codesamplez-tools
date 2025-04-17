import { base64ToBase64Url, encodeBase64 } from './base64.js';

export class JWTBuilder {
  constructor() {
    this.header = { alg: 'HS256', typ: 'JWT' };
  }

  getFormattedDate(date) {
    return date.toISOString().slice(0, 19) + 'Z';
  }

  parseDateTime(value) {
    // If it's already a numeric timestamp, return it
    if (!isNaN(value) && value.trim() !== '') {
      return parseInt(value, 10);
    }
    
    try {
      // Try to parse as a datetime string
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return Math.floor(date.getTime() / 1000);
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }
    
    return null;
  }

  uint8ArrayToString(array) {
    const CHUNK_SIZE = 8192; // Process in chunks to avoid call stack limits
    let result = '';
    for (let i = 0; i < array.length; i++) {
      const byte = array[i];
      if ((byte & 0x80) === 0) {
        // ASCII character
        result += String.fromCharCode(byte);
      } else if ((byte & 0xe0) === 0xc0) {
        // 2-byte UTF-8 sequence
        const byte2 = array[++i];
        const codePoint = ((byte & 0x1f) << 6) | (byte2 & 0x3f);
        result += String.fromCharCode(codePoint);
      } else if ((byte & 0xf0) === 0xe0) {
        // 3-byte UTF-8 sequence
        const byte2 = array[++i];
        const byte3 = array[++i];
        const codePoint = ((byte & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f);
        result += String.fromCharCode(codePoint);
      } else if ((byte & 0xf8) === 0xf0) {
        // 4-byte UTF-8 sequence
        const byte2 = array[++i];
        const byte3 = array[++i];
        const byte4 = array[++i];
        let codePoint = ((byte & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);
        // Convert to UTF-16 surrogate pairs
        codePoint -= 0x10000;
        result += String.fromCharCode(
          (codePoint >> 10) + 0xd800,
          (codePoint & 0x3ff) + 0xdc00
        );
      }
    }
    return result;
  }

  base64UrlEncode(input) {
    let data;
    if (input instanceof ArrayBuffer) {
      data = new Uint8Array(input);
    } else if (input instanceof Uint8Array) {
      data = input;
    } else {
      // For strings, convert to UTF-8 bytes first
      data = new TextEncoder().encode(input);
    }
    
    const base64 = encodeBase64(data);
    return base64ToBase64Url(base64);
  }

  async generateSignature(signingInput, key) {
    if (!signingInput || !key) {
      throw new Error('Both signing input and key are required');
    }

    try {
      // Import the key for HMAC-SHA256
      const keyBytes = new TextEncoder().encode(key);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      // Sign the input
      const messageBytes = new TextEncoder().encode(signingInput);
      const signatureBytes = await crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        messageBytes
      );
      
      // Convert the signature bytes to base64url
      return this.base64UrlEncode(signatureBytes);
    } catch (error) {
      console.error('Error generating signature:', error);
      throw error;
    }
  }

  getDefaultPayload() {
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

    return {
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(sixMonthsFromNow.getTime() / 1000),
      iss: "your-issuer",
      sub: "your-subject",
      aud: "your-audience",
      nbf: Math.floor(now.getTime() / 1000),
      jti: "your-jti"
    };
  }

  async buildJWT(payload = null, secretKey = '') {
    try {
      if (!secretKey?.trim()) {
        throw new Error('Secret key is required for JWT signing');
      }

      const finalPayload = payload || this.getDefaultPayload();

      // Create and encode the header
      const headerB64 = this.base64UrlEncode(JSON.stringify(this.header));
      
      // Encode the payload
      const payloadB64 = this.base64UrlEncode(JSON.stringify(finalPayload));
      
      // Create the signing input (encoded header + "." + encoded payload)
      const signingInput = `${headerB64}.${payloadB64}`;
      
      // Generate the signature
      const signature = await this.generateSignature(signingInput, secretKey);
      
      // Combine all parts to create the final JWT
      return `${headerB64}.${payloadB64}.${signature}`;
    } catch (error) {
      throw error instanceof SyntaxError ? 
        new Error('Invalid JSON payload.') : 
        error;
    }
  }
}
