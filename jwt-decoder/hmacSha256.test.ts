import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'node:util';
import { hmacSha256 } from './JWTDecoder';

(globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder = TextEncoder;
(globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder = TextDecoder;

describe('hmacSha256', () => {
    // `jest.fn<any>()` no longer accepts `mockResolvedValue` values under
    // jest-mock 30.5.1 (its `ResolveType<T>` resolves to `never`), so the fake
    // Web Crypto methods are declared as promise-returning mocks instead.
    const asyncMock = () => jest.fn<(...args: any[]) => Promise<any>>();

    beforeAll(() => {
        if (!globalThis.crypto) {
            (globalThis as any).crypto = {};
        }
        if (!globalThis.crypto.subtle) {
            (globalThis.crypto as any).subtle = {
                importKey: asyncMock().mockResolvedValue('mockKey' as any),
                sign: asyncMock().mockResolvedValue(new ArrayBuffer(32))
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

    it('should throw if crypto is undefined, leaving logging to the caller', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const originalCrypto = globalThis.crypto;
        delete (globalThis as { crypto?: unknown }).crypto;

        try {
            await expect(hmacSha256('message', 'key')).rejects.toThrow('Web Crypto API');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        } finally {
            globalThis.crypto = originalCrypto;
            consoleErrorSpy.mockRestore();
        }
    });
});
