import { compressToEncodedURIComponent } from 'lz-string';
import {
    buildShareUrl,
    compressJsonPayload,
    decompressJsonPayload,
    readHashOrQueryParam,
    SHARE_URL_MAX_LENGTH
} from './share-url';

describe('share-url', () => {
    describe('readHashOrQueryParam', () => {
        it('reads a hash param when present', () => {
            expect(readHashOrQueryParam({ hash: '#data=abc', search: '' }, 'data')).toEqual({ value: 'abc', source: 'hash' });
        });

        it('falls back to a query param when the hash has none', () => {
            expect(readHashOrQueryParam({ hash: '', search: '?data=abc' }, 'data')).toEqual({ value: 'abc', source: 'query' });
        });

        it('prefers the hash over the query when both are present', () => {
            expect(readHashOrQueryParam({ hash: '#data=fromHash', search: '?data=fromQuery' }, 'data'))
                .toEqual({ value: 'fromHash', source: 'hash' });
        });

        it('returns a null value/source when neither carries the param', () => {
            expect(readHashOrQueryParam({ hash: '#other=1', search: '?other=1' }, 'data')).toEqual({ value: null, source: null });
        });

        it('accepts a bare hash value without a leading #', () => {
            expect(readHashOrQueryParam({ hash: 'data=abc', search: '' }, 'data')).toEqual({ value: 'abc', source: 'hash' });
        });
    });

    describe('buildShareUrl', () => {
        it('appends the hash fragment to a URL with no existing hash', () => {
            expect(buildShareUrl('https://tools.codesamplez.com/json-formatter/', 'j=abc')).toBe('https://tools.codesamplez.com/json-formatter/#j=abc');
        });

        it('discards any existing hash before appending the new one', () => {
            expect(buildShareUrl('https://tools.codesamplez.com/json-formatter/#stale=1', 'j=abc')).toBe('https://tools.codesamplez.com/json-formatter/#j=abc');
        });

        it('discards any existing query string before appending the new hash', () => {
            // Guards against a legacy `?j=<old>` link (opened via the query-string
            // fallback) getting a fresh `#j=<new>` link that still carries the old,
            // server-visible query payload alongside it.
            expect(buildShareUrl('https://tools.codesamplez.com/json-formatter/?j=stale-legacy-payload', 'j=abc'))
                .toBe('https://tools.codesamplez.com/json-formatter/#j=abc');
        });

        it('discards both an existing query string and hash before appending the new hash', () => {
            expect(buildShareUrl('https://tools.codesamplez.com/json-formatter/?j=stale-query#j=stale-hash', 'j=abc'))
                .toBe('https://tools.codesamplez.com/json-formatter/#j=abc');
        });
    });

    describe('compressJsonPayload / decompressJsonPayload', () => {
        it('round-trips an arbitrary JSON-serializable payload', () => {
            const payload = { i: '{"a":1}', n: '2', s: true, a: false };
            const compressed = compressJsonPayload(payload);
            expect(decompressJsonPayload(compressed)).toEqual(payload);
        });

        it('returns null for a malformed/tampered compressed value instead of throwing', () => {
            expect(decompressJsonPayload('not-a-valid-lz-string-value')).toBeNull();
        });

        it('returns null when the decompressed value is valid but not parseable JSON', () => {
            // Successfully decompresses (unlike the malformed-input case above) but
            // JSON.parse throws — exercises the catch branch, not the `!decompressed` guard.
            const compressed = compressToEncodedURIComponent('not json');
            expect(decompressJsonPayload(compressed)).toBeNull();
        });
    });

    it('exposes a practical max length for the size guard', () => {
        expect(SHARE_URL_MAX_LENGTH).toBeGreaterThan(0);
    });
});
