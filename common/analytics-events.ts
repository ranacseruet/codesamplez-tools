/**
 * Custom analytics events for tool activation.
 *
 * `window.gtag` exists only after the production host gate in
 * `scripts/analytics.js` installs it. Dev, tests, and builds with no
 * measurement id leave it undefined. `trackEvent` then does nothing: it never
 * throws, never logs, and never forwards user-provided text.
 *
 * Params are an allowlist. Unknown keys, non-strings, and strings longer than
 * {@link MAX_EVENT_PARAM_LENGTH} are dropped rather than truncated, so a
 * prefix of pasted content cannot leak. `tool_used` is also deduped to one
 * event per 2 seconds per tool and action, which keeps a live or auto-run
 * tool from emitting one event per keystroke.
 */

export const TOOL_USED_EVENT = 'tool_used';

export const INPUT_SIZE_BUCKETS = ['<1KB', '1–10KB', '10–100KB', '>100KB'] as const;

export type InputSizeBucket = (typeof INPUT_SIZE_BUCKETS)[number];

/** GA4 event-parameter values are limited to 100 characters. */
export const MAX_EVENT_PARAM_LENGTH = 100;

const TOOL_USED_DEDUPE_MS = 2000;

const KNOWN_PARAM_KEYS = new Set(['tool_id', 'action', 'input_size_bucket']);

const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const EVENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

type GtagCommand = (command: 'event', eventName: string, params?: Record<string, string>) => void;

const lastToolUsedAt = new Map<string, number>();

/** Clears the `tool_used` dedupe window. Tests call this between cases. */
export function clearToolUsedDedupe(): void {
    lastToolUsedAt.clear();
}

function readGtag(): GtagCommand | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    const candidate = (window as Window & { gtag?: unknown }).gtag;
    return typeof candidate === 'function' ? (candidate as GtagCommand) : undefined;
}

export function utf8ByteLength(value: string): number {
    if (typeof value !== 'string' || value.length === 0) {
        return 0;
    }

    // `TextEncoder` is a host API, not a core-js polyfill, so referencing it
    // does not pull the language polyfill runtime into the tool bundle.
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(value).length;
    }

    return value.length;
}

export function inputSizeBucket(byteLength: number): InputSizeBucket | undefined {
    if (!Number.isFinite(byteLength) || byteLength < 0) {
        return undefined;
    }

    if (byteLength < 1024) {
        return '<1KB';
    }

    if (byteLength < 10 * 1024) {
        return '1–10KB';
    }

    if (byteLength < 100 * 1024) {
        return '10–100KB';
    }

    return '>100KB';
}

function sanitizeParams(params: unknown): Record<string, string> {
    if (!params || typeof params !== 'object') {
        return {};
    }

    const safe: Record<string, string> = {};

    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
        if (!KNOWN_PARAM_KEYS.has(key) || typeof value !== 'string') {
            continue;
        }

        if (value.length === 0 || value.length > MAX_EVENT_PARAM_LENGTH) {
            continue;
        }

        if (key === 'input_size_bucket') {
            // Equality checks, not Array.includes: that method makes Babel inject
            // a core-js polyfill, which breaks scope hoisting in bundles that
            // did not already use it.
            if (value === '<1KB' || value === '1–10KB' || value === '10–100KB' || value === '>100KB') {
                safe[key] = value;
            }
            continue;
        }

        if (!IDENTIFIER_PATTERN.test(value)) {
            continue;
        }

        safe[key] = value;
    }

    return safe;
}

function shouldSendToolUsed(params: Record<string, string>, now: number): boolean {
    const key = `${params.tool_id || ''}\0${params.action || ''}`;
    const previous = lastToolUsedAt.get(key);

    if (previous !== undefined && now - previous < TOOL_USED_DEDUPE_MS) {
        return false;
    }

    lastToolUsedAt.set(key, now);
    return true;
}

/**
 * Forward one analytics event when gtag is installed.
 *
 * No-ops when `window.gtag` is missing. Swallows every failure so a broken
 * analytics snippet cannot take down a tool.
 */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
    try {
        const gtag = readGtag();
        if (!gtag) {
            return;
        }

        if (typeof name !== 'string' || !EVENT_NAME_PATTERN.test(name)) {
            return;
        }

        const safeParams = sanitizeParams(params);

        if (name === TOOL_USED_EVENT && !shouldSendToolUsed(safeParams, Date.now())) {
            return;
        }

        gtag('event', name, safeParams);
    } catch {
        // Never throw, and never console.error: a dev page with no GA id must stay quiet.
    }
}

/**
 * Record one `tool_used` activation.
 *
 * `inputBytes` is turned into a coarse size bucket. The bytes themselves, and
 * any text they came from, are not sent.
 */
export function trackToolUsed(options: {
    toolId: string;
    action: string;
    inputBytes?: number;
}): void {
    const params: Record<string, string> = {
        tool_id: options.toolId,
        action: options.action
    };

    if (typeof options.inputBytes === 'number') {
        const bucket = inputSizeBucket(options.inputBytes);
        if (bucket) {
            params.input_size_bucket = bucket;
        }
    }

    trackEvent(TOOL_USED_EVENT, params);
}
