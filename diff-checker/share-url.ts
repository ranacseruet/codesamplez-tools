/**
 * Diff Checker's shareable-URL payload, built on the shared conventions in
 * common/share-url.ts (the same ones json-formatter and base64-converter use):
 * both panes plus the whitespace option, LZ-compressed as JSON into a
 * `location.hash` param so the compared text is never sent to a server.
 *
 * There is no legacy query-string form to honour here — this tool has never
 * had a share link — but `resolveSharePayload` still reads one, because a user
 * who hand-edits `#d=` into `?d=` should get the same result rather than a
 * silent no-op.
 */

import {
    buildShareUrl as buildShareUrlWithHash,
    compressJsonPayload,
    decompressJsonPayload,
    readHashOrQueryParam,
    SHARE_URL_MAX_LENGTH
} from '../common/share-url';

export { SHARE_URL_MAX_LENGTH };

export interface DiffSharePayload {
    original: string;
    modified: string;
    ignoreWhitespace: boolean;
}

export interface ResolvedDiffSharePayload {
    payload: DiffSharePayload | null;
    /** 'query' means a hand-made legacy-style link; callers may want to warn. */
    source: 'hash' | 'query' | null;
}

/**
 * Param name carrying the payload. Exported because `script.tsx` has to probe
 * for it *without* importing this module — pulling it in eagerly would put
 * lz-string in the main bundle for every visitor, when only the few arriving
 * via a share link need it. A unit test pins the two spellings together.
 */
export const HASH_PARAM = 'd';

interface CompactPayload {
    o: string;
    m: string;
    w?: unknown;
}

/** Build just the hash-fragment portion (no leading `#`) for a share payload. */
export function buildShareHash(payload: DiffSharePayload): string {
    const compact: CompactPayload = {
        o: payload.original,
        m: payload.modified,
        w: payload.ignoreWhitespace
    };

    return `${HASH_PARAM}=${compressJsonPayload(compact)}`;
}

/** Build the full shareable URL: `baseUrl` (existing hash/query discarded) + the payload. */
export function buildShareUrl(baseUrl: string, payload: DiffSharePayload): string {
    return buildShareUrlWithHash(baseUrl, buildShareHash(payload));
}

function decodeCompactPayload(compressed: string): DiffSharePayload | null {
    const compact = decompressJsonPayload<CompactPayload>(compressed);
    if (!compact) return null;
    // Both panes must be strings; a link carrying only one side is malformed
    // rather than "one empty pane", since the builder always writes both.
    if (typeof compact.o !== 'string' || typeof compact.m !== 'string') return null;
    // Reject rather than coerce a tampered non-boolean option (e.g. `"w":"false"`),
    // matching the shared "malformed hash -> nothing to preload" contract.
    if (typeof compact.w !== 'undefined' && typeof compact.w !== 'boolean') return null;

    return {
        original: compact.o,
        modified: compact.m,
        // The checkbox ships checked, so an absent flag means the default.
        ignoreWhitespace: compact.w !== false
    };
}

/** Parse a `location.hash`-style string into a payload, or `null`. Never throws. */
export function parseShareHash(hash: string): DiffSharePayload | null {
    const compressed = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash).get(HASH_PARAM);
    if (!compressed) return null;
    return decodeCompactPayload(compressed);
}

/** Resolve a payload from the current location, preferring the hash fragment. */
export function resolveSharePayload(
    locationLike: Pick<Location, 'hash' | 'search'>
): ResolvedDiffSharePayload {
    const { value, source } = readHashOrQueryParam(locationLike, HASH_PARAM);
    if (!value) return { payload: null, source: null };

    return { payload: decodeCompactPayload(value), source };
}
