/**
 * Data Format Converter's shareable-URL payload, built on the shared
 * conventions in common/share-url.ts (the same ones json-formatter,
 * base64-converter, and diff-checker use): the input plus both format
 * selections, LZ-compressed as JSON into a `location.hash` param so the shared
 * data is never sent to a server.
 *
 * The format strings are validated on the way back in rather than trusted:
 * a tampered `#c=` carrying `"i":"exe"` must not put the converter into a
 * state its own UI cannot represent.
 */

import {
    buildShareUrl as buildShareUrlWithHash,
    compressJsonPayload,
    decompressJsonPayload,
    readHashOrQueryParam,
    SHARE_URL_MAX_LENGTH
} from '../common/share-url';

export { SHARE_URL_MAX_LENGTH };

// Structurally identical to the local aliases in script.tsx and
// DataFormatConverter.ts; kept local so this module has no runtime import of
// either (the SSR/prerender graph pulls this in through script.tsx).
export type ShareableFormat = 'json' | 'xml' | 'yaml' | 'properties';

const SUPPORTED_FORMATS: readonly ShareableFormat[] = ['json', 'xml', 'yaml', 'properties'];

export interface ConverterSharePayload {
    input: string;
    inputFormat: ShareableFormat;
    outputFormat: ShareableFormat;
}

export interface ResolvedConverterSharePayload {
    payload: ConverterSharePayload | null;
    /** 'query' means a hand-made legacy-style link; callers may want to warn. */
    source: 'hash' | 'query' | null;
}

/**
 * Param name carrying the payload. Exported because `script.tsx` has to probe
 * for it *without* importing this module — pulling it in eagerly would put
 * lz-string in the main bundle for every visitor, when only the few arriving
 * via a share link need it. A unit test pins the two spellings together.
 */
export const HASH_PARAM = 'c';

interface CompactPayload {
    t: string;
    i?: unknown;
    o?: unknown;
}

/** Narrow an untrusted value to a supported format, or `null`. */
export function parseShareableFormat(value: unknown): ShareableFormat | null {
    // Index loop rather than `includes`: this module lands in the tool's main
    // bundle, and `Array#includes` pulls a core-js polyfill (see the note on
    // `dragCarriesFiles` in common/drop-zone.ts).
    for (let index = 0; index < SUPPORTED_FORMATS.length; index += 1) {
        if (SUPPORTED_FORMATS[index] === value) return SUPPORTED_FORMATS[index];
    }
    return null;
}

/** Build just the hash-fragment portion (no leading `#`) for a share payload. */
export function buildShareHash(payload: ConverterSharePayload): string {
    const compact: CompactPayload = {
        t: payload.input,
        i: payload.inputFormat,
        o: payload.outputFormat
    };

    return `${HASH_PARAM}=${compressJsonPayload(compact)}`;
}

/** Build the full shareable URL: `baseUrl` (existing hash/query discarded) + the payload. */
export function buildShareUrl(baseUrl: string, payload: ConverterSharePayload): string {
    return buildShareUrlWithHash(baseUrl, buildShareHash(payload));
}

function decodeCompactPayload(compressed: string): ConverterSharePayload | null {
    const compact = decompressJsonPayload<CompactPayload>(compressed);
    if (!compact || typeof compact.t !== 'string') return null;

    const inputFormat = parseShareableFormat(compact.i);
    const outputFormat = parseShareableFormat(compact.o);
    if (!inputFormat || !outputFormat) return null;

    return { input: compact.t, inputFormat, outputFormat };
}

/** Parse a `location.hash`-style string into a payload, or `null`. Never throws. */
export function parseShareHash(hash: string): ConverterSharePayload | null {
    const compressed = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash).get(HASH_PARAM);
    if (!compressed) return null;
    return decodeCompactPayload(compressed);
}

/** Resolve a payload from the current location, preferring the hash fragment. */
export function resolveSharePayload(
    locationLike: Pick<Location, 'hash' | 'search'>
): ResolvedConverterSharePayload {
    const { value, source } = readHashOrQueryParam(locationLike, HASH_PARAM);
    if (!value) return { payload: null, source: null };

    return { payload: decodeCompactPayload(value), source };
}
