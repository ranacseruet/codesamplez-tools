const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import { hmacSha256 } from './JWTDecoder';

describe('hmacSha256', () => {
    beforeAll(() => {
        // Mock crypto.subtle if it doesn't exist (it usually doesn't in older JSDOM or requires setup)
        if (!global.crypto) {
            global.crypto = {};
        }
        if (!global.crypto.subtle) {
            global.crypto.subtle = {
                importKey: jest.fn().mockResolvedValue('mockKey'),
                sign: jest.fn().mockResolvedValue(new ArrayBuffer(32))
            };
        }
    });

    it('should throw error if message or key is missing', async () => {
        await expect(hmacSha256('', 'key')).rejects.toThrow('Invalid input');
        await expect(hmacSha256('msg', '')).rejects.toThrow('Invalid input');
    });

    it('should generate signature', async () => {
        const sig = await hmacSha256('message', 'key');
        expect(sig).toBeInstanceOf(Uint8Array);
    });

    it('should throw if crypto is undefined', async () => {
        const originalCrypto = global.crypto;
        delete global.crypto;

        await expect(hmacSha256('message', 'key')).rejects.toThrow('Web Crypto API');

        global.crypto = originalCrypto;
    });
});
