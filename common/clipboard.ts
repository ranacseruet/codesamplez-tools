/**
 * One clipboard strategy for the whole toolset.
 *
 * The tools have to work on the modern Clipboard API and on the older
 * `execCommand('copy')` path (non-secure contexts, and browsers that reject the
 * async API without a permission grant), so every copy affordance ends up
 * needing the same two-step dance. This module owns it once.
 *
 * Rejects rather than returning a boolean: callers already have a toast for the
 * failure and want the message.
 *
 * Note: `common/copy-button/CopyButton.ts`, `text-analyzer`'s Copy Results, and
 * `data-format-converter`'s copy handler still carry their own inline copies of
 * this logic. They predate this module and are worth folding in, but that is a
 * copy-affordance cleanup rather than part of the share-URL work.
 */

/** Copy `text` to the clipboard, falling back to a hidden textarea + execCommand. */
export async function copyTextToClipboard(text: string): Promise<void> {
    if (globalThis.navigator?.clipboard) {
        await globalThis.navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    // Keep the scroll position put while the textarea is focused for selection.
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        if (!document.execCommand('copy')) {
            throw new Error('Copy command failed');
        }
    } finally {
        document.body.removeChild(textarea);
    }
}
