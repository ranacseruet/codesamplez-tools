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

    it('retries through execCommand when the Clipboard API rejects', async () => {
        // A rejection is usually something the caller cannot fix (denied
        // permission, unfocused document) and the synchronous path often still
        // works, so giving up here would lose copies that used to succeed.
        const writeText = jest.fn().mockRejectedValue(new Error('denied'));
        setClipboard({ writeText });
        const execCommand = jest.fn(() => true);
        (document as unknown as { execCommand: unknown }).execCommand = execCommand;

        await expect(copyTextToClipboard('x')).resolves.toBeUndefined();

        expect(writeText).toHaveBeenCalled();
        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(document.querySelectorAll('textarea')).toHaveLength(0);
    });

    it('surfaces the Clipboard API error when the fallback also fails', async () => {
        setClipboard({ writeText: jest.fn().mockRejectedValue(new Error('NotAllowedError: denied')) });
        (document as unknown as { execCommand: unknown }).execCommand = jest.fn(() => false);

        // The API's message tells the user something; "Copy command failed"
        // does not, so the root cause wins.
        await expect(copyTextToClipboard('x')).rejects.toThrow('NotAllowedError: denied');
        expect(document.querySelectorAll('textarea')).toHaveLength(0);
    });

    it('skips the Clipboard API outright in an insecure context', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        setClipboard({ writeText });
        Object.defineProperty(globalThis, 'isSecureContext', { value: false, configurable: true });
        const execCommand = jest.fn(() => true);
        (document as unknown as { execCommand: unknown }).execCommand = execCommand;

        await copyTextToClipboard('insecure');

        // Browsers that expose `clipboard` there reject every call, and the
        // rejection can raise a permission prompt the user has to dismiss.
        expect(writeText).not.toHaveBeenCalled();
        expect(execCommand).toHaveBeenCalledWith('copy');

        Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
    });

    it('marks the scratch textarea readonly so mobile keyboards stay shut', async () => {
        setClipboard(undefined);
        let scratch: HTMLTextAreaElement | null = null;
        (document as unknown as { execCommand: unknown }).execCommand = jest.fn(() => {
            scratch = document.querySelector('textarea');
            return true;
        });

        await copyTextToClipboard('readonly check');

        expect(scratch).not.toBeNull();
        expect(scratch!.hasAttribute('readonly')).toBe(true);
        expect(scratch!.style.position).toBe('fixed');
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
