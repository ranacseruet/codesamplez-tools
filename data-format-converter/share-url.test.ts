import { compressToEncodedURIComponent } from 'lz-string';
import {
    buildShareHash,
    buildShareUrl,
    HASH_PARAM,
    parseShareableFormat,
    parseShareHash,
    resolveSharePayload,
    SHARE_URL_MAX_LENGTH
} from './share-url';

const compress = (value: unknown) => compressToEncodedURIComponent(JSON.stringify(value));

describe('data-format-converter share-url', () => {
    const payload = {
        input: '{"name":"Ada","age":36}',
        inputFormat: 'json' as const,
        outputFormat: 'yaml' as const
    };

    it('round-trips a payload through buildShareHash/parseShareHash', () => {
        expect(parseShareHash(buildShareHash(payload))).toEqual(payload);
    });

    it('round-trips through a full URL built by buildShareUrl', () => {
        const url = buildShareUrl('https://tools.codesamplez.com/data-format-converter/', payload);
        expect(parseShareHash(`#${url.split('#')[1]}`)).toEqual(payload);
    });

    it('discards any existing hash and query on the base URL', () => {
        const url = buildShareUrl('https://tools.codesamplez.com/data-format-converter/?c=old#stale=1', payload);
        expect(url.startsWith('https://tools.codesamplez.com/data-format-converter/#c=')).toBe(true);
    });

    it('round-trips every supported format pairing', () => {
        const formats = ['json', 'xml', 'yaml', 'properties'] as const;
        formats.forEach((inputFormat) => {
            formats.forEach((outputFormat) => {
                const roundTripped = parseShareHash(
                    buildShareHash({ input: 'x', inputFormat, outputFormat })
                );
                expect(roundTripped).toEqual({ input: 'x', inputFormat, outputFormat });
            });
        });
    });

    it('returns null when the hash carries no payload', () => {
        expect(parseShareHash('')).toBeNull();
        expect(parseShareHash('#other=1')).toBeNull();
    });

    it('returns null for an undecodable value instead of throwing', () => {
        expect(parseShareHash('#c=not-actually-compressed')).toBeNull();
    });

    it('rejects a payload with no input text', () => {
        expect(parseShareHash(`c=${compress({ i: 'json', o: 'yaml' })}`)).toBeNull();
    });

    it('rejects an unsupported or tampered format rather than defaulting', () => {
        expect(parseShareHash(`c=${compress({ t: 'x', i: 'exe', o: 'yaml' })}`)).toBeNull();
        expect(parseShareHash(`c=${compress({ t: 'x', i: 'json', o: 42 })}`)).toBeNull();
        expect(parseShareHash(`c=${compress({ t: 'x', i: 'json' })}`)).toBeNull();
    });

    it('prefers the hash fragment over a legacy query string', () => {
        const resolved = resolveSharePayload({
            hash: `#${buildShareHash(payload)}`,
            search: `?c=${compress({ t: 'from query', i: 'xml', o: 'json' })}`
        });

        expect(resolved.source).toBe('hash');
        expect(resolved.payload).toEqual(payload);
    });

    it('falls back to the query string and reports it as legacy', () => {
        const resolved = resolveSharePayload({
            hash: '',
            search: `?c=${compress({ t: 'a: 1', i: 'yaml', o: 'json' })}`
        });

        expect(resolved.source).toBe('query');
        expect(resolved.payload).toEqual({ input: 'a: 1', inputFormat: 'yaml', outputFormat: 'json' });
    });

    it('reports no payload when neither hash nor query carries one', () => {
        expect(resolveSharePayload({ hash: '', search: '' })).toEqual({ payload: null, source: null });
    });

    describe('parseShareableFormat', () => {
        it('accepts every supported format', () => {
            ['json', 'xml', 'yaml', 'properties'].forEach((format) => {
                expect(parseShareableFormat(format)).toBe(format);
            });
        });

        it('rejects anything else', () => {
            [null, undefined, 42, 'JSON', 'exe', {}].forEach((value) => {
                expect(parseShareableFormat(value)).toBeNull();
            });
        });
    });

    it('pins the param name that script.tsx probes for without importing this module', () => {
        // script.tsx cannot import HASH_PARAM — that would pull lz-string into
        // the main bundle — so it hard-codes the literal. Renaming the param
        // here without updating that probe would silently stop share links
        // from preloading.
        expect(HASH_PARAM).toBe('c');
    });

    it('re-exports the shared URL length ceiling', () => {
        expect(SHARE_URL_MAX_LENGTH).toBe(8000);
    });
});
