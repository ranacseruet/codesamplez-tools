/**
 * JSON Formatter's shareable-URL payload, built on the shared conventions in
 * common/share-url.ts (also used by base64-converter): a value carried in a
 * `location.hash` param (with a legacy `location.search` fallback), never
 * sent to a server. Here the value is the current JSON plus the three
 * settings that affect its rendering, LZ-compressed as JSON.
 */

import {
    buildShareUrl as buildShareUrlWithHash,
    compressJsonPayload,
    decompressJsonPayload,
    readHashOrQueryParam,
    SHARE_URL_MAX_LENGTH
} from '../common/share-url';
import { parseIndentOption, type IndentOption } from './json-format-core';

export { SHARE_URL_MAX_LENGTH };

export interface ShareUrlPayload {
    input: string;
    indent: IndentOption;
    sortKeys: boolean;
    autoFix: boolean;
}

export interface ResolvedSharePayload {
    payload: ShareUrlPayload | null;
    /** Where the payload was read from — 'query' means a legacy link; callers may want to warn. */
    source: 'hash' | 'query' | null;
}

const HASH_PARAM = 'j';

interface CompactPayload {
    i: string;
    n?: unknown;
    s?: unknown;
    a?: unknown;
}

/** Build just the hash-fragment portion (no leading `#`) for a share payload. */
export function buildShareHash(payload: ShareUrlPayload): string {
    const compact: CompactPayload = {
        i: payload.input,
        n: String(payload.indent),
        s: payload.sortKeys,
        a: payload.autoFix
    };

    return `${HASH_PARAM}=${compressJsonPayload(compact)}`;
}

/** Build the full shareable URL: `baseUrl` (any existing hash discarded) + the compressed payload. */
export function buildShareUrl(baseUrl: string, payload: ShareUrlPayload): string {
    return buildShareUrlWithHash(baseUrl, buildShareHash(payload));
}

function decodeCompactPayload(compressed: string): ShareUrlPayload | null {
    const compact = decompressJsonPayload<CompactPayload>(compressed);
    if (!compact || typeof compact.i !== 'string') return null;
    // Reject rather than silently coerce a tampered non-boolean settings field
    // (e.g. `"s":"false"`), matching the "malformed hash → nothing to preload" contract.
    if (typeof compact.s !== 'undefined' && typeof compact.s !== 'boolean') return null;
    if (typeof compact.a !== 'undefined' && typeof compact.a !== 'boolean') return null;

    return {
        input: compact.i,
        indent: parseIndentOption(compact.n),
        sortKeys: compact.s !== false,
        autoFix: compact.a !== false
    };
}

/**
 * Parse a `location.hash`-style string back into a share payload, or `null`
 * when the hash carries no recognizable/decodable payload. Never throws —
 * malformed or tampered hashes are treated as "nothing to preload".
 */
export function parseShareHash(hash: string): ShareUrlPayload | null {
    const compressed = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash).get(HASH_PARAM);
    if (!compressed) return null;
    return decodeCompactPayload(compressed);
}

/**
 * Resolve a share payload from the current location, preferring the hash
 * fragment over the legacy query-string fallback (mirrors base64-converter's
 * `data` param convention). `source: 'query'` signals a legacy link so
 * callers can warn the user, since new share links are always hash-only.
 */
export function resolveSharePayload(locationLike: Pick<Location, 'hash' | 'search'>): ResolvedSharePayload {
    const { value, source } = readHashOrQueryParam(locationLike, HASH_PARAM);
    if (!value) return { payload: null, source: null };

    return { payload: decodeCompactPayload(value), source };
}
