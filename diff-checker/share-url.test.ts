import { compressToEncodedURIComponent } from 'lz-string';
import {
    buildShareHash,
    buildShareUrl,
    HASH_PARAM,
    parseShareHash,
    resolveSharePayload,
    SHARE_URL_MAX_LENGTH
} from './share-url';

const compress = (value: unknown) => compressToEncodedURIComponent(JSON.stringify(value));

describe('diff-checker share-url', () => {
    const payload = {
        original: 'function greet(name) {\n  return name;\n}',
        modified: 'function greet(name) {\n  return `hi ${name}`;\n}',
        ignoreWhitespace: false
    };

    it('round-trips a payload through buildShareHash/parseShareHash', () => {
        expect(parseShareHash(buildShareHash(payload))).toEqual(payload);
    });

    it('round-trips through a full URL built by buildShareUrl', () => {
        const url = buildShareUrl('https://tools.codesamplez.com/diff-checker/', payload);
        expect(parseShareHash(`#${url.split('#')[1]}`)).toEqual(payload);
    });

    it('discards any existing hash and query on the base URL', () => {
        const url = buildShareUrl('https://tools.codesamplez.com/diff-checker/?d=old#stale=1', payload);
        expect(url.startsWith('https://tools.codesamplez.com/diff-checker/#d=')).toBe(true);
    });

    it('preserves empty panes rather than treating them as missing', () => {
        const oneSided = { original: 'only this side', modified: '', ignoreWhitespace: true };
        expect(parseShareHash(buildShareHash(oneSided))).toEqual(oneSided);
    });

    it('defaults ignoreWhitespace to true when omitted', () => {
        expect(parseShareHash(`d=${compress({ o: 'a', m: 'b' })}`)).toEqual({
            original: 'a',
            modified: 'b',
            ignoreWhitespace: true
        });
    });

    it('accepts a hash with or without the leading #', () => {
        const hash = buildShareHash(payload);
        expect(parseShareHash(`#${hash}`)).toEqual(parseShareHash(hash));
    });

    it('returns null when the hash carries no payload', () => {
        expect(parseShareHash('')).toBeNull();
        expect(parseShareHash('#other=1')).toBeNull();
    });

    it('returns null for an undecodable value instead of throwing', () => {
        expect(parseShareHash('#d=not-actually-compressed')).toBeNull();
    });

    it('rejects a payload missing either pane', () => {
        expect(parseShareHash(`d=${compress({ o: 'a' })}`)).toBeNull();
        expect(parseShareHash(`d=${compress({ m: 'b' })}`)).toBeNull();
    });

    it('rejects a tampered non-boolean whitespace flag rather than coercing it', () => {
        expect(parseShareHash(`d=${compress({ o: 'a', m: 'b', w: 'false' })}`)).toBeNull();
    });

    it('prefers the hash fragment over a legacy query string', () => {
        const resolved = resolveSharePayload({
            hash: `#${buildShareHash(payload)}`,
            search: `?d=${compress({ o: 'query', m: 'query', w: true })}`
        });

        expect(resolved.source).toBe('hash');
        expect(resolved.payload).toEqual(payload);
    });

    it('falls back to the query string and reports it as legacy', () => {
        const resolved = resolveSharePayload({
            hash: '',
            search: `?d=${compress({ o: 'a', m: 'b', w: true })}`
        });

        expect(resolved.source).toBe('query');
        expect(resolved.payload).toEqual({ original: 'a', modified: 'b', ignoreWhitespace: true });
    });

    it('reports no payload when neither hash nor query carries one', () => {
        expect(resolveSharePayload({ hash: '', search: '' })).toEqual({ payload: null, source: null });
    });

    it('pins the param name that script.tsx probes for without importing this module', () => {
        // script.tsx cannot import HASH_PARAM — that would pull lz-string into
        // the main bundle — so it hard-codes the literal. Renaming the param
        // here without updating that probe would silently stop share links
        // from preloading.
        expect(HASH_PARAM).toBe('d');
    });

    it('re-exports the shared URL length ceiling', () => {
        expect(SHARE_URL_MAX_LENGTH).toBe(8000);
    });
});
