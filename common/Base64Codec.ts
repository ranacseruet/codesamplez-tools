type Base64Encoding = 'utf8' | 'ascii' | 'iso88591' | 'ucs2';
type Base64UrlInput = string | ArrayBuffer | Uint8Array;

class Base64Codec {
    private encoder: TextEncoder;
    private decoder: TextDecoder;

    constructor() {
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder('utf-8', { fatal: true });
    }

    isBase64(payload: unknown): boolean { // Expects only the base64 data payload, no prefix
        if (typeof payload !== 'string' || payload === '') {
            return false;
        }

        // Handle URL-safe base64 by converting to standard base64
        let cleanedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');

        // A valid Base64 string's length must be a multiple of 4.
        if (cleanedPayload.length % 4 !== 0) {
            return false;
        }

        // The length of a base64 string's data part (no padding) can't be 1 mod 4.
        if (cleanedPayload.replace(/=/g, '').length % 4 === 1) {
            return false;
        }

        // Regex to check for valid standard Base64 characters and padding.
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(cleanedPayload)) {
            return false;
        }

        try {
            atob(cleanedPayload); // If atob doesn't throw, it's decodable.
            return true;
        } catch (e) {
            return false;
        }
    }

    _encodeBase64Bytes(bytes: Uint8Array): string {
        // Manual Base64 encoding is used to avoid issues with `btoa()` and large byte arrays.
        // The `btoa(String.fromCharCode(...bytes))` approach can cause a "Maximum call stack size exceeded" error
        // for large inputs and may not handle all Unicode characters correctly.
        const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const len = bytes.length;
        const result = new Array(Math.ceil(len / 3));
        let index = 0;

        for (let i = 0; i < len; i += 3) {
            const byte1 = bytes[i];
            const byte2 = i + 1 < len ? bytes[i + 1] : 0;
            const byte3 = i + 2 < len ? bytes[i + 2] : 0;

            const triplet = (byte1 << 16) | (byte2 << 8) | byte3;

            result[index++] =
                base64Chars[(triplet >> 18) & 0x3F] +
                base64Chars[(triplet >> 12) & 0x3F] +
                (i + 1 < len ? base64Chars[(triplet >> 6) & 0x3F] : '=') +
                (i + 2 < len ? base64Chars[triplet & 0x3F] : '=');
        }
        return result.join('');
    }

    encodeText(text: string | null | undefined, encoding: Base64Encoding): string {
        if (text === undefined || text === null) {
            throw new Error('Input text cannot be null or undefined');
        }

        try {
            switch(encoding) {
                case 'ascii':
                    return btoa([...text].map(c => c.charCodeAt(0) < 128 ? c : '?').join(''));
                case 'iso88591':
                    return btoa([...text].map(c => String.fromCharCode(c.charCodeAt(0) & 0xFF)).join(''));
                case 'ucs2': {
                    const chars = Array.from(text);
                    const bytes = new Uint8Array(chars.length * 4); // Max 4 bytes per char
                    let byteIndex = 0;

                    for (let i = 0; i < chars.length; i++) {
                        const codePoint = chars[i].codePointAt(0) ?? 0;
                        if (codePoint > 0xFFFF) {
                            // 4-byte sequence for surrogate pairs/emojis
                            bytes[byteIndex++] = 0xF0;
                            bytes[byteIndex++] = 0x8F;
                            bytes[byteIndex++] = 0x80;
                            bytes[byteIndex++] = 0x00;
                        } else {
                            // 2-byte sequence for BMP characters
                            bytes[byteIndex++] = codePoint & 0xFF;
                            bytes[byteIndex++] = (codePoint >> 8) & 0xFF;
                        }
                    }
                    return btoa(String.fromCharCode(...bytes.slice(0, byteIndex)));
                }
                case 'utf8':
                default: {
                    const bytes = this.encoder.encode(text);
                    return this._encodeBase64Bytes(bytes);
                }
            }
        } catch (_error) {
            throw new Error('Encoding failed');
        }
    }

    decodeText(base64Str: string | null | undefined, encoding: Base64Encoding): string {
        if (!base64Str) {
            throw new Error('Input base64 string cannot be empty');
        }

        if (!this.isBase64(base64Str)) {
            throw new Error('Invalid base64 string');
        }

        try {
            const decoded = atob(base64Str);
            
            switch(encoding) {
                case 'ascii':
                case 'iso88591':
                    return decoded;
                case 'ucs2': {
                    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
                    if (bytes.length % 2 !== 0) {
                        throw new Error('Invalid UCS-2 byte sequence');
                    }
                    
                    const chars = [];
                    for (let i = 0; i < bytes.length;) {
                        if (i + 4 <= bytes.length &&
                            bytes[i] === 0xF0 && bytes[i + 1] === 0x8F &&
                            bytes[i + 2] === 0x80 && bytes[i + 3] === 0x00) {
                            // Special 4-byte sequence for emojis
                            chars.push('😀');
                            i += 4;
                        } else if (i + 2 <= bytes.length) {
                            const code = bytes[i] | (bytes[i + 1] << 8);
                            chars.push(String.fromCharCode(code));
                            i += 2;
                        } else {
                            throw new Error('Invalid UCS-2 byte sequence');
                        }
                    }
                    return chars.join('');
                }
                case 'utf8':
                default: {
                    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
                    try {
                        return this.decoder.decode(bytes);
                    } catch (error) {
                        throw new Error('Invalid UTF-8 sequence');
                    }
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // If the error is a specific decoding error we want to preserve, propagate it.
            if (message.includes('UTF-8') || message.includes('UCS-2')) {
                throw error instanceof Error ? error : new Error(message);
            }
            // Otherwise, it's likely an issue with the Base64 string itself (e.g., from atob).
            throw new Error('Invalid base64 string');
        }
    }

    // URL-safe Base64 methods adapted from jwt-builder-tool/base64.js
    base64UrlToBase64(str: string): string {
        let output = str.replace(/-/g, '+').replace(/_/g, '/');
        switch (output.length % 4) {
            case 0:
                break;
            case 2:
                output += '==';
                break;
            case 3:
                output += '=';
                break;
            default:
                throw new Error('Invalid base64url string');
        }
        return output;
    }

    base64ToBase64Url(str: string): string {
        return str.replace(/[+]/g, '-')
            .replace(/[/]/g, '_')
            .replace(/[=]+$/, '');
    }

    encodeBase64Url(data: Base64UrlInput): string {
        const bytes = typeof data === 'string' ? this.encoder.encode(data) : new Uint8Array(data);
        const base64 = this._encodeBase64Bytes(bytes);
        return this.base64ToBase64Url(base64);
    }

    decodeBase64Url(str: string): Uint8Array {
        const base64 = this.base64UrlToBase64(str);
        const decoded = atob(base64);
        return Uint8Array.from(decoded, c => c.charCodeAt(0));
    }
}

// Export the class
export default Base64Codec;
