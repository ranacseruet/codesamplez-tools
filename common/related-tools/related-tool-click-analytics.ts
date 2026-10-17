import { trackRelatedToolClick } from '../analytics-events';

export const RELATED_TOOL_TARGET_ATTR = 'data-target-tool-id';

const RELATED_TOOL_LINK_SELECTOR = '.c-related-tools__link, .c-related-tools-compact__link';

let clickListenerInstalled = false;

/**
 * Delegated click tracking for prerendered related-tool links. Installed once
 * when the tool shell mounts on a standalone page.
 */
export function registerRelatedToolClickAnalytics(): void {
    if (clickListenerInstalled || typeof document === 'undefined') {
        return;
    }

    clickListenerInstalled = true;

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }

        const link = target.closest(RELATED_TOOL_LINK_SELECTOR);
        if (!(link instanceof HTMLAnchorElement)) {
            return;
        }

        const targetToolId = link.getAttribute(RELATED_TOOL_TARGET_ATTR);
        if (!targetToolId) {
            return;
        }

        trackRelatedToolClick(targetToolId);
    });
}

/** Tests reset registration between cases. */
export function resetRelatedToolClickAnalyticsForTests(): void {
    clickListenerInstalled = false;
}
