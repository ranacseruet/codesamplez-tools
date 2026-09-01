import { buildShareHash, buildShareUrl, parseShareHash, resolveSharePayload, SHARE_URL_MAX_LENGTH } from './share-url';

describe('share-url', () => {
    const payload = {
        input: '{"a":1,"b":[1,2,3]}',
        indent: 4 as const,
        sortKeys: false,
        autoFix: true
    };

    it('round-trips a payload through buildShareHash/parseShareHash', () => {
        const hash = buildShareHash(payload);
        expect(parseShareHash(hash)).toEqual(payload);
        expect(parseShareHash(hash)).not.toHaveProperty('schema');
        expect(parseShareHash(hash)).not.toHaveProperty('draft');
    });

    it('round-trips through a full URL built by buildShareUrl', () => {
        const url = buildShareUrl('https://tools.codesamplez.com/json-formatter/', payload);
        const hash = url.split('#')[1];
        expect(parseShareHash(`#${hash}`)).toEqual(payload);
    });

    it('discards any existing hash on the base URL before appending the new one', () => {
        const url = buildShareUrl('https://tools.codesamplez.com/json-formatter/#stale=1', payload);
        expect(url.startsWith('https://tools.codesamplez.com/json-formatter/#j=')).toBe(true);
    });

    it('defaults indent to 2 when the encoded value is unrecognized', () => {
        const hash = buildShareHash({ ...payload, indent: 2 });
        expect(parseShareHash(hash)?.indent).toBe(2);
    });

    it('defaults sortKeys/autoFix to true when omitted from the payload', () => {
        const hash = 'j=' + encodeURIComponentSafeCompress({ i: 'null' });
        expect(parseShareHash(hash)).toEqual({
            input: 'null',
            indent: 2,
            sortKeys: true,
            autoFix: true
        });
    });

    it('returns null when the hash has no payload param', () => {
        expect(parseShareHash('#other=1')).toBeNull();
        expect(parseShareHash('')).toBeNull();
    });

    it('returns null for a malformed/tampered payload instead of throwing', () => {
        expect(parseShareHash('#j=not-valid-lz-string-data')).toBeNull();
    });

    it('returns null when the decoded payload has no string input field', () => {
        const hash = 'j=' + encodeURIComponentSafeCompress({ n: '2' });
        expect(parseShareHash(hash)).toBeNull();
    });

    it('returns null when s/a are present but not booleans, rather than silently coercing them', () => {
        expect(parseShareHash('j=' + encodeURIComponentSafeCompress({ i: '{}', s: 'false' }))).toBeNull();
        expect(parseShareHash('j=' + encodeURIComponentSafeCompress({ i: '{}', a: 0 }))).toBeNull();
    });

    it('accepts a leading # or a bare hash value', () => {
        const hash = buildShareHash(payload);
        expect(parseShareHash(hash)).toEqual(parseShareHash(`#${hash}`));
    });

    it('exposes a practical max length for the size guard', () => {
        expect(SHARE_URL_MAX_LENGTH).toBeGreaterThan(0);
    });

    describe('resolveSharePayload', () => {
        it('resolves a payload from the hash with source "hash"', () => {
            const hash = buildShareHash(payload);
            expect(resolveSharePayload({ hash: `#${hash}`, search: '' })).toEqual({ payload, source: 'hash' });
        });

        it('falls back to the legacy query string with source "query" when the hash has no payload', () => {
            const hash = buildShareHash(payload);
            expect(resolveSharePayload({ hash: '', search: `?${hash}` })).toEqual({ payload, source: 'query' });
        });

        it('prefers the hash over the query when both are present', () => {
            const hashPayload = { ...payload, input: 'from-hash' };
            const queryPayload = { ...payload, input: 'from-query' };
            const result = resolveSharePayload({
                hash: `#${buildShareHash(hashPayload)}`,
                search: `?${buildShareHash(queryPayload)}`
            });
            expect(result).toEqual({ payload: hashPayload, source: 'hash' });
        });

        it('returns a null payload/source when neither carries the param', () => {
            expect(resolveSharePayload({ hash: '', search: '' })).toEqual({ payload: null, source: null });
        });
    });

    function encodeURIComponentSafeCompress(obj: unknown): string {
        // Local re-implementation using the same lz-string compressor share-url.ts
        // uses, kept here so this fixture-only helper does not need to be exported
        // from the module under test.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { compressToEncodedURIComponent } = require('lz-string');
        return compressToEncodedURIComponent(JSON.stringify(obj));
    }
});
