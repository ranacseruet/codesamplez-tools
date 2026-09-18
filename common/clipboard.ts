/**
 * One clipboard strategy for the whole toolset.
 *
 * The tools have to work on the modern Clipboard API and on the older
 * `execCommand('copy')` path (non-secure contexts, and browsers that reject the
 * async API without a permission grant), so every copy affordance ends up
 * needing the same two-step dance. This module owns it once — every copy
 * affordance in the repo routes through `copyTextToClipboard`.
 *
 * Rejects rather than returning a boolean: callers already have a toast (or a
 * button animation) for the failure and want the message.
 */

/**
 * Copy `text` to the clipboard.
 *
 * Order of attempts, and why:
 *
 * 1. **Clipboard API**, when it exists and the context is secure. Insecure
 *    contexts are skipped outright because browsers that expose `clipboard`
 *    there reject every call, and the rejection can surface a permission
 *    prompt the user then has to dismiss.
 * 2. **`execCommand('copy')`**, both when the API is unavailable *and* when it
 *    rejected. A rejection is usually something the caller cannot fix — denied
 *    permission, an unfocused document — and the synchronous path frequently
 *    still works, so giving up at step 1 would lose copies that used to work.
 *
 * If both fail it rejects with the Clipboard API's error when there was one:
 * "NotAllowedError: Write permission denied" tells a user something, while
 * "Copy command failed" does not.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
    const clipboard = globalThis.navigator?.clipboard;
    let clipboardApiError: unknown;

    // `isSecureContext !== false` rather than a truthy check: environments that
    // don't define it at all (older test doubles) should still try the API.
    if (clipboard?.writeText && globalThis.isSecureContext !== false) {
        try {
            await clipboard.writeText(text);
            return;
        } catch (error) {
            clipboardApiError = error;
        }
    }

    try {
        copyWithExecCommand(text);
    } catch (fallbackError) {
        throw clipboardApiError ?? fallbackError;
    }
}

/**
 * Selection-based copy through a scratch textarea. `readonly` keeps mobile
 * keyboards from opening, and the off-screen fixed position keeps the page from
 * scrolling while the textarea holds focus.
 */
function copyWithExecCommand(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-999999px';
    textarea.style.left = '-999999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
        if (!document.execCommand('copy')) {
            throw new Error('Copy command failed');
        }
    } finally {
        // Always remove the scratch element, including when the copy failed.
        document.body.removeChild(textarea);
    }
}
