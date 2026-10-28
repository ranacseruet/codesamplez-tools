import { getMountedToolAnalyticsId } from '../analytics-tool-context';
import {
    TUTORIAL_LINK_CLASS,
    TUTORIAL_LINK_PATH_ATTR,
    isMappedTutorialPath
} from './tutorial-links';

export const TUTORIAL_LINK_CLICK_EVENT = 'tutorial_link_click';

const TUTORIAL_LINK_SELECTOR = `.${TUTORIAL_LINK_CLASS}`;
const MAX_EVENT_PARAM_LENGTH = 100;
const TOOL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

let clickListenerInstalled = false;

type GtagCommand = (command: 'event', eventName: string, params?: Record<string, string>) => void;

function readGtag(): GtagCommand | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    const candidate = (window as Window & { gtag?: unknown }).gtag;
    return typeof candidate === 'function' ? (candidate as GtagCommand) : undefined;
}

/**
 * Sends `tutorial_link_click` with `tool_id` and `target_path` only.
 *
 * This does not go through `trackEvent`. That allowlist keeps param values to
 * identifier slugs, and a tutorial path contains slashes. The checks here are
 * the same kind of allowlist: known event, known keys, length cap, a slug
 * `tool_id`, and a path that exists in the shared tutorial map. Anything else
 * is dropped. Tool input is never read.
 */
export function trackTutorialLinkClick(targetPath: string): void {
    try {
        const gtag = readGtag();
        if (!gtag) {
            return;
        }

        const toolId = getMountedToolAnalyticsId();
        if (!toolId || !TOOL_ID_PATTERN.test(toolId) || toolId.length > MAX_EVENT_PARAM_LENGTH) {
            return;
        }

        if (typeof targetPath !== 'string'
            || targetPath.length === 0
            || targetPath.length > MAX_EVENT_PARAM_LENGTH
            || !isMappedTutorialPath(targetPath)) {
            return;
        }

        gtag('event', TUTORIAL_LINK_CLICK_EVENT, {
            tool_id: toolId,
            target_path: targetPath
        });
    } catch {
        // Never throw: a broken analytics snippet must not take down the tool.
    }
}

/**
 * Delegated click tracking for prerendered Learn more links. Call once after
 * the tool shell mounts on a page that renders those links.
 */
export function registerTutorialLinkClickAnalytics(): void {
    if (clickListenerInstalled || typeof document === 'undefined') {
        return;
    }

    clickListenerInstalled = true;

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }

        const link = target.closest(TUTORIAL_LINK_SELECTOR);
        if (!(link instanceof HTMLAnchorElement)) {
            return;
        }

        const targetPath = link.getAttribute(TUTORIAL_LINK_PATH_ATTR);
        if (!targetPath) {
            return;
        }

        trackTutorialLinkClick(targetPath);
    });
}

/** Tests reset registration between cases. */
export function resetTutorialLinkClickAnalyticsForTests(): void {
    clickListenerInstalled = false;
}
