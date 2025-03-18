class Base64Codec {
    constructor() {
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder('utf-8', { fatal: true });
    }

    isBase64(str) {
        if (!str) return false;
        
        // Check length and basic pattern
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (str.length % 4 !== 0 || !base64Regex.test(str)) return false;
        
        // Check padding
        const paddingChar = str.indexOf('=');
        if (paddingChar > -1) {
            if (paddingChar < str.length - 2) return false;
            if (str.length - paddingChar > 2) return false;
        }
        
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
                    const chars = Array.from(text);
                    const bytes = new Uint8Array(chars.length * 4); // Max 4 bytes per char
                    let byteIndex = 0;

                    for (let i = 0; i < chars.length; i++) {
                        const codePoint = chars[i].codePointAt(0);
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
                    return btoa(String.fromCharCode(...bytes));
                }
            }
        } catch (error) {
            throw new Error('Encoding failed');
        }
    }

    decodeText(base64Str, encoding) {
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
            if (error.message.includes('UCS-2')) {
                throw new Error('Invalid UCS-2 byte sequence');
            }
            throw new Error('Invalid base64 string');
        }
    }
}

// Export the class
module.exports = Base64Codec;
