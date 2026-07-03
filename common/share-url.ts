/**
 * Shared conventions for tools that support "shareable state" URLs: a value
 * (raw or LZ-compressed JSON) carried in a named `location.hash` param, with
 * a legacy `location.search` fallback for links generated before a tool
 * adopted the hash form. Hash fragments are never sent to a server, so the
 * hash form is the private one; the query-string form only exists for
 * backward compatibility with already-shared links and should not be used
 * for newly generated links.
 *
 * Originally established by base64-converter's `data` param; extracted here
 * so every tool that wants shareable-state URLs (base64-converter,
 * json-formatter, ...) shares one implementation instead of reinventing it.
 */

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

export interface HashOrQueryParam {
    value: string | null;
    source: 'hash' | 'query' | null;
}

/**
 * Read a named param, preferring the hash fragment over the (legacy) query
 * string when both are present.
 */
export function readHashOrQueryParam(locationLike: Pick<Location, 'hash' | 'search'>, paramName: string): HashOrQueryParam {
    const hashValue = locationLike.hash.startsWith('#') ? locationLike.hash.slice(1) : locationLike.hash;
    const hashParam = new URLSearchParams(hashValue).get(paramName);
    if (hashParam !== null) {
        return { value: hashParam, source: 'hash' };
    }

    const searchParam = new URLSearchParams(locationLike.search).get(paramName);
    if (searchParam !== null) {
        return { value: searchParam, source: 'query' };
    }

    return { value: null, source: null };
}

/**
 * Build a full shareable URL: `baseUrl` (any existing hash *and* query string
 * discarded) + the given hash fragment (no leading `#`). Stripping the query
 * string too matters when `baseUrl` is the current page's URL and the page
 * was itself opened via a legacy `?param=...` share link — otherwise the
 * newly generated link would carry both the old (server-visible) query
 * payload and the new hash payload.
 */
export function buildShareUrl(baseUrl: string, hashFragment: string): string {
    const urlWithoutHashOrQuery = baseUrl.split(/[?#]/)[0];
    return `${urlWithoutHashOrQuery}#${hashFragment}`;
}

/**
 * Practical ceiling for a full share URL. Hash fragments never reach a
 * server, but browsers' address bars, chat apps, and issue trackers still
 * choke on multi-tens-of-KB links, so guard against generating one that will
 * not paste/open cleanly.
 */
export const SHARE_URL_MAX_LENGTH = 8000;

/** JSON-stringify then LZ-compress a payload for use as a hash/query param value. */
export function compressJsonPayload(payload: unknown): string {
    return compressToEncodedURIComponent(JSON.stringify(payload));
}

/**
 * Inverse of `compressJsonPayload`. Returns `null` (never throws) for
 * anything that fails to decompress or parse, so malformed/tampered values
 * are treated as "nothing to preload".
 */
export function decompressJsonPayload<T>(compressed: string): T | null {
    try {
        const decompressed = decompressFromEncodedURIComponent(compressed);
        if (!decompressed) return null;
        return JSON.parse(decompressed) as T;
    } catch {
        return null;
    }
}
