type Base64Encoding = 'utf8' | 'ascii' | 'iso88591' | 'ucs2';
type Base64UrlInput = string | ArrayBuffer | Uint8Array;

class Base64Codec {
    private encoder: TextEncoder;
    private decoder: TextDecoder;

    constructor() {
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder('utf-8', { fatal: true });
    }

    /**
     * Maps the URL-safe alphabet (`-`/`_`) back to standard base64 (`+`/`/`).
     * Every consumer that hands a payload to `atob` (or that embeds it in a
     * `data:` URL) must use this, otherwise a payload `isBase64` accepted can
     * still fail at decode/download/preview time.
     */
    normalizePayload(payload: string): string {
        return payload.replace(/-/g, '+').replace(/_/g, '/');
    }

    isBase64(payload: unknown): boolean { // Expects only the base64 data payload, no prefix
        if (typeof payload !== 'string' || payload === '') {
            return false;
        }

        // Handle URL-safe base64 by converting to standard base64
        let cleanedPayload = this.normalizePayload(payload);

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
                    // Little-endian UTF-16, one code unit per two bytes. Walking
                    // code units (charCodeAt) rather than code points lets astral
                    // characters flow through as their natural surrogate pair, so
                    // every character round-trips — the previous fixed 4-byte
                    // marker collapsed every astral character to the same value
                    // (e.g. '😀' and '🌍' both encoded to '8I+AAA==').
                    const bytes = new Uint8Array(text.length * 2);
                    for (let i = 0; i < text.length; i++) {
                        const codeUnit = text.charCodeAt(i);
                        bytes[i * 2] = codeUnit & 0xFF;
                        bytes[i * 2 + 1] = (codeUnit >> 8) & 0xFF;
                    }
                    return this._encodeBase64Bytes(bytes);
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
            // `isBase64` accepts URL-safe input by normalizing `-`/`_`, so the
            // decode below must apply the same normalization — otherwise
            // auto-detect greenlights a URL-safe payload and `atob` then throws,
            // surfacing a misleading "Invalid base64 input".
            const decoded = atob(this.normalizePayload(base64Str));
            
            switch(encoding) {
                case 'ascii':
                case 'iso88591':
                    return decoded;
                case 'ucs2': {
                    // Inverse of the little-endian UTF-16 encode above: each
                    // pair of bytes is one UTF-16 code unit, so surrogate pairs
                    // reassemble into astral characters on `join`.
                    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
                    if (bytes.length % 2 !== 0) {
                        throw new Error('Invalid UCS-2 byte sequence');
                    }

                    const chars = [];
                    for (let i = 0; i < bytes.length; i += 2) {
                        chars.push(String.fromCharCode(bytes[i] | (bytes[i + 1] << 8)));
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

    // URL-safe Base64 methods adapted from jwt-builder/base64.js
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
