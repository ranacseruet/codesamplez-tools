// Shared test utilities for Base64 converter tests

// TextEncoder/Decoder polyfills with better Unicode support
const setupPolyfills = () => {
    global.TextEncoder = class {
        encode(str) {
            const chunks = [];
            for (let i = 0; i < str.length; i++) {
                let char = str.codePointAt(i);
                if (char > 0xffff) {
                    i++; // Skip next code unit
                }
                
                if (char <= 0x7f) {
                    chunks.push(char);
                } else if (char <= 0x7ff) {
                    chunks.push(0xc0 | (char >> 6), 0x80 | (char & 0x3f));
                } else if (char <= 0xffff) {
                    chunks.push(
                        0xe0 | (char >> 12),
                        0x80 | ((char >> 6) & 0x3f),
                        0x80 | (char & 0x3f)
                    );
                } else {
                    chunks.push(
                        0xf0 | (char >> 18),
                        0x80 | ((char >> 12) & 0x3f),
                        0x80 | ((char >> 6) & 0x3f),
                        0x80 | (char & 0x3f)
                    );
                }
            }
            return new Uint8Array(chunks);
        }
    };

    global.TextDecoder = class {
        decode(arr) {
            const bytes = new Uint8Array(arr);
            let str = '';
            for (let i = 0; i < bytes.length;) {
                let byte = bytes[i];
                let char;
                
                if ((byte & 0x80) === 0) { // ASCII
                    char = byte;
                    i += 1;
                } else if ((byte & 0xe0) === 0xc0) { // 2-byte sequence
                    if (i + 1 >= bytes.length) throw new Error('Invalid UTF-8 sequence');
                    char = ((byte & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
                    i += 2;
                } else if ((byte & 0xf0) === 0xe0) { // 3-byte sequence
                    if (i + 2 >= bytes.length) throw new Error('Invalid UTF-8 sequence');
                    char = ((byte & 0x0f) << 12) |
                          ((bytes[i + 1] & 0x3f) << 6) |
                          (bytes[i + 2] & 0x3f);
                    i += 3;
                } else if ((byte & 0xf8) === 0xf0) { // 4-byte sequence
                    if (i + 3 >= bytes.length) throw new Error('Invalid UTF-8 sequence');
                    char = ((byte & 0x07) << 18) |
                          ((bytes[i + 1] & 0x3f) << 12) |
                          ((bytes[i + 2] & 0x3f) << 6) |
                          (bytes[i + 3] & 0x3f);
                    i += 4;
                } else {
                    throw new Error('Invalid UTF-8 sequence');
                }
                
                str += String.fromCodePoint(char);
            }
            return str;
        }
    };

    // btoa/atob polyfills
    if (!global.btoa) {
        global.btoa = str => Buffer.from(str, 'binary').toString('base64');
    }
    if (!global.atob) {
        global.atob = function(input) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
            let str = String(input).replace(/=+$/, '');
            if (str.length % 4 === 1) {
                throw new Error('InvalidCharacterError: String contains an invalid character.');
            }
            let output = '';
            for (let bc = 0, bs = 0, idx = 0;
                str.charAt(idx);
                idx++
            ) {
                const c = chars.indexOf(str.charAt(idx));
                if (c < 0) {
                    throw new Error('InvalidCharacterError: String contains an invalid character.');
                }
                bs = (bs << 6) | c;
                bc += 6;
                if (bc >= 8) {
                    output += String.fromCharCode((bs >>> (bc - 8)) & 0xFF);
                    bc -= 8;
                }
            }
            return output;
        };
    }
};

const cleanup = (originalGlobals) => {
    Object.assign(global, originalGlobals);
};

module.exports = {
    setupPolyfills,
    cleanup
};
