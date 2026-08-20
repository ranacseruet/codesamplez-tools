import { copyTextToClipboard } from './clipboard';

describe('copyTextToClipboard', () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');

    const setClipboard = (value: unknown) => {
        Object.defineProperty(globalThis.navigator, 'clipboard', {
            value,
            configurable: true,
            writable: true
        });
    };

    afterEach(() => {
        if (originalClipboard) {
            Object.defineProperty(globalThis.navigator, 'clipboard', originalClipboard);
        } else {
            setClipboard(undefined);
        }
        jest.restoreAllMocks();
    });

    it('uses the Clipboard API when available', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        setClipboard({ writeText });

        await copyTextToClipboard('https://example.test/#d=abc');

        expect(writeText).toHaveBeenCalledWith('https://example.test/#d=abc');
    });

    it('propagates a Clipboard API rejection', async () => {
        setClipboard({ writeText: jest.fn().mockRejectedValue(new Error('denied')) });

        await expect(copyTextToClipboard('x')).rejects.toThrow('denied');
    });

    it('falls back to execCommand when the Clipboard API is unavailable', async () => {
        setClipboard(undefined);
        const execCommand = jest.fn(() => true);
        (document as unknown as { execCommand: unknown }).execCommand = execCommand;

        await copyTextToClipboard('fallback text');

        expect(execCommand).toHaveBeenCalledWith('copy');
        // The scratch textarea must not be left behind in the document.
        expect(document.querySelectorAll('textarea')).toHaveLength(0);
    });

    it('throws and still cleans up when execCommand reports failure', async () => {
        setClipboard(undefined);
        (document as unknown as { execCommand: unknown }).execCommand = jest.fn(() => false);

        await expect(copyTextToClipboard('nope')).rejects.toThrow('Copy command failed');
        expect(document.querySelectorAll('textarea')).toHaveLength(0);
    });
});
