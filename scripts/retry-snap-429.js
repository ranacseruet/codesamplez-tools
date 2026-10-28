'use strict';

/**
 * Preload for the manual SnapDrift workflow (`NODE_OPTIONS=--require`).
 *
 * The pinned pr-diff action treats HTTP 429 as a final 4xx. Two overlapping
 * manual runs hit that on POST /v1/visual/captures/:id/local-result. This
 * wrapper retries those responses before the action sees them. The pull-request
 * job does not load this file.
 */

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = [1000, 2000];
const MAX_RETRY_AFTER_MS = 5000;

/**
 * @param {unknown} input
 * @returns {string}
 */
function requestUrl(input) {
    if (typeof input === 'string') {
        return input;
    }
    if (input instanceof URL) {
        return input.href;
    }
    if (input && typeof input === 'object' && typeof input.url === 'string') {
        return input.url;
    }
    return '';
}

/**
 * @param {unknown} input
 * @returns {boolean}
 */
function isSnapVisualRequest(input) {
    return requestUrl(input).includes('/v1/visual/');
}

/**
 * @param {RequestInit | undefined} init
 * @returns {boolean}
 */
function canReplay(init) {
    if (!init || init.body == null) {
        return true;
    }
    const body = init.body;
    return typeof body === 'string'
        || Buffer.isBuffer(body)
        || body instanceof Uint8Array;
}

/**
 * @param {Response} response
 * @param {number} attempt
 * @param {number[]} backoffMs
 * @returns {number}
 */
function retryDelayMs(response, attempt, backoffMs) {
    const header = response.headers && typeof response.headers.get === 'function'
        ? response.headers.get('retry-after')
        : null;
    if (header && /^\d+$/.test(header.trim())) {
        return Math.min(Number(header.trim()) * 1000, MAX_RETRY_AFTER_MS);
    }
    const fallback = backoffMs[Math.min(attempt - 1, backoffMs.length - 1)];
    return fallback;
}

/**
 * @param {AbortSignal | undefined} signal
 * @param {number} delayMs
 * @param {(ms: number) => Promise<void>} sleep
 * @returns {Promise<void>}
 */
async function waitForRetry(signal, delayMs, sleep) {
    if (signal && signal.aborted) {
        throw signal.reason instanceof Error ? signal.reason : new Error('The Snap request was aborted.');
    }
    await sleep(delayMs);
    if (signal && signal.aborted) {
        throw signal.reason instanceof Error ? signal.reason : new Error('The Snap request was aborted.');
    }
}

/**
 * @param {Response} response
 */
function releaseBody(response) {
    const body = response && response.body;
    if (body && typeof body.cancel === 'function') {
        body.cancel();
    }
}

/**
 * @param {{
 *   fetch?: typeof fetch,
 *   sleep?: (ms: number) => Promise<void>,
 *   maxAttempts?: number,
 *   backoffMs?: number[],
 *   writeStderr?: (line: string) => void
 * }} [overrides]
 * @returns {typeof fetch}
 */
function installSnap429Retry(overrides) {
    const options = overrides || {};
    const baseFetch = options.fetch || globalThis.fetch;
    const sleep = options.sleep || ((delayMs) => new Promise((resolve) => {
        setTimeout(resolve, delayMs);
    }));
    const maxAttempts = options.maxAttempts || DEFAULT_MAX_ATTEMPTS;
    const backoffMs = options.backoffMs || DEFAULT_BACKOFF_MS;
    const writeStderr = options.writeStderr || ((line) => {
        process.stderr.write(line);
    });

    async function fetchWithSnap429Retry(input, init) {
        let attempt = 0;
        let response = await baseFetch(input, init);
        while (
            response.status === 429
            && isSnapVisualRequest(input)
            && canReplay(init)
            && attempt < maxAttempts - 1
        ) {
            attempt += 1;
            releaseBody(response);
            const delayMs = retryDelayMs(response, attempt, backoffMs);
            writeStderr(`Snap API 429 on a visual request; retrying in ${delayMs}ms (attempt ${attempt} of ${maxAttempts - 1}).\n`);
            await waitForRetry(init && init.signal, delayMs, sleep);
            response = await baseFetch(input, init);
        }
        return response;
    }

    if (!options.fetch) {
        globalThis.fetch = fetchWithSnap429Retry;
    }
    return fetchWithSnap429Retry;
}

function shouldAutoInstall() {
    return (process.env.NODE_OPTIONS || '').includes('retry-snap-429');
}

if (shouldAutoInstall()) {
    installSnap429Retry();
}

module.exports = {
    installSnap429Retry,
    isSnapVisualRequest,
    shouldAutoInstall
};
