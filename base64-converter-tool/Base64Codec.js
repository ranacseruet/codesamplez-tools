class Base64Codec {
    constructor() {
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder();
    }

    isBase64(str) {
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (str.length % 4 !== 0) return false;
        if (!base64Regex.test(str)) return false;
        
        try {
            return btoa(atob(str)) === str;
        } catch (err) {
            return false;
        }
    }

    encodeText(text, encoding) {
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
                    // Convert string to UTF-16 code units
                    const codeUnits = [];
                    for (let i = 0; i < text.length; i++) {
                        const codePoint = text.codePointAt(i);
                        if (codePoint > 0xFFFF) {
                            // Handle surrogate pairs
                            const high = Math.floor((codePoint - 0x10000) / 0x400) + 0xD800;
                            const low = ((codePoint - 0x10000) % 0x400) + 0xDC00;
                            codeUnits.push(high, low);
                            i++; // Skip the next code unit as it's part of the surrogate pair
                        } else {
                            codeUnits.push(codePoint);
                        }
                    }
                    // Convert to bytes and encode (little endian)
                    const bytes = new Uint8Array(codeUnits.length * 2);
                    for (let i = 0; i < codeUnits.length; i++) {
                        bytes[i * 2] = codeUnits[i] & 0xFF;     // Low byte
                        bytes[i * 2 + 1] = codeUnits[i] >> 8;   // High byte
                    }
                    return btoa(String.fromCharCode(...bytes));
                }
                case 'utf8':
                default:
                    return btoa(unescape(encodeURIComponent(text)));
            }
        } catch (error) {
            throw new Error('Encoding failed');
        }
    }

    decodeText(base64Str, encoding) {
        if (!base64Str) {
            throw new Error('Input base64 string cannot be empty');
        }

        try {
            const decoded = atob(base64Str);
            switch(encoding) {
                case 'ascii':
                    return decoded;
                case 'iso88591':
                    return decoded;
                case 'ucs2': {
                    // Convert base64 to bytes
                    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
                    // Reconstruct code units from bytes (little endian)
                    const codeUnits = [];
                    for (let i = 0; i < bytes.length; i += 2) {
                        codeUnits.push(bytes[i] | (bytes[i + 1] << 8));
                    }
                    // Convert code units to string
                    return String.fromCodePoint(...codeUnits);
                }
                case 'utf8':
                default:
                    return decodeURIComponent(escape(decoded));
            }
        } catch (error) {
            throw new Error('Decoding failed');
        }
    }
}

// Export the class
module.exports = Base64Codec;
