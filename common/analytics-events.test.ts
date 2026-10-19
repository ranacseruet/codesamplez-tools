import { clearMountedToolAnalyticsId, setMountedToolAnalyticsId } from './analytics-tool-context';
import {
    COPY_OUTPUT_EVENT,
    DOWNLOAD_OUTPUT_EVENT,
    FILE_LOADED_EVENT,
    INPUT_SIZE_BUCKETS,
    MAX_EVENT_PARAM_LENGTH,
    RELATED_TOOL_CLICK_EVENT,
    SHARE_LINK_CREATED_EVENT,
    clearToolUsedDedupe,
    inputSizeBucket,
    trackCopyOutput,
    trackDownloadOutput,
    trackEvent,
    trackFileLoaded,
    trackRelatedToolClick,
    trackShareLinkCreated,
    trackToolUsed,
    utf8ByteLength
} from './analytics-events';

type GtagMock = jest.Mock;

function installGtag(): GtagMock {
    const gtag = jest.fn();
    (window as unknown as { gtag?: GtagMock }).gtag = gtag;
    return gtag;
}

function removeGtag(): void {
    delete (window as unknown as { gtag?: GtagMock }).gtag;
}

describe('trackEvent', () => {
    beforeEach(() => {
        clearToolUsedDedupe();
        removeGtag();
    });

    afterEach(() => {
        clearToolUsedDedupe();
        removeGtag();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('is a no-op when gtag is missing and does not throw or log', () => {
        const error = jest.spyOn(console, 'error').mockImplementation(() => {});
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

        expect(() => {
            trackEvent('tool_used', {
                tool_id: 'diff-checker',
                action: 'compare',
                note: 'user pasted this'
            });
        }).not.toThrow();

        expect(error).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
        expect((window as unknown as { gtag?: unknown }).gtag).toBeUndefined();
    });

    it('calls gtag(event, name, params) when gtag is present', () => {
        const gtag = installGtag();

        trackEvent('tool_used', {
            tool_id: 'diff-checker',
            action: 'compare',
            input_size_bucket: '<1KB'
        });

        expect(gtag).toHaveBeenCalledTimes(1);
        expect(gtag).toHaveBeenCalledWith('event', 'tool_used', {
            tool_id: 'diff-checker',
            action: 'compare',
            input_size_bucket: '<1KB'
        });
    });

    it('strips unknown keys and long string params', () => {
        const gtag = installGtag();
        const secret = 'SECRET_USER_TEXT_should_not_be_sent';
        const longValue = 'a'.repeat(MAX_EVENT_PARAM_LENGTH + 1);

        trackEvent('tool_used', {
            tool_id: 'json-formatter',
            action: longValue,
            input_size_bucket: '<1KB',
            note: secret,
            payload: longValue,
            count: 42 as unknown as string
        });

        expect(gtag).toHaveBeenCalledTimes(1);
        expect(gtag).toHaveBeenCalledWith('event', 'tool_used', {
            tool_id: 'json-formatter',
            input_size_bucket: '<1KB'
        });
        expect(JSON.stringify(gtag.mock.calls)).not.toContain(secret);
        expect(JSON.stringify(gtag.mock.calls)).not.toContain(longValue);
    });

    it('does not throw when gtag itself throws', () => {
        (window as unknown as { gtag?: () => void }).gtag = () => {
            throw new Error('gtag failed');
        };
        const error = jest.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => trackEvent('tool_used', { tool_id: 'diff-checker', action: 'compare' })).not.toThrow();
        expect(error).not.toHaveBeenCalled();
    });

    it('drops a non-object params bag, an invalid event name, and a non-identifier value', () => {
        const gtag = installGtag();

        trackEvent('tool_used', null as unknown as Record<string, unknown>);
        trackEvent('not a valid name', { tool_id: 'diff-checker', action: 'compare' });
        trackEvent('tool_used', {
            tool_id: 'has spaces',
            action: 'compare',
            input_size_bucket: 'not-a-bucket'
        });

        expect(gtag).toHaveBeenCalledTimes(2);
        expect(gtag).toHaveBeenNthCalledWith(1, 'event', 'tool_used', {});
        expect(gtag).toHaveBeenNthCalledWith(2, 'event', 'tool_used', { action: 'compare' });
    });

    it('no-ops when window is missing', () => {
        const view = globalThis as { window?: Window };
        const saved = view.window;
        delete view.window;

        expect(() => trackEvent('tool_used', { tool_id: 'diff-checker', action: 'compare' })).not.toThrow();

        view.window = saved;
    });

    it('sends at most one tool_used per 2s for the same tool and action', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
        const gtag = installGtag();

        trackEvent('tool_used', { tool_id: 'diff-checker', action: 'compare', input_size_bucket: '<1KB' });
        trackEvent('tool_used', { tool_id: 'diff-checker', action: 'compare', input_size_bucket: '<1KB' });
        expect(gtag).toHaveBeenCalledTimes(1);

        trackEvent('tool_used', { tool_id: 'json-formatter', action: 'compare', input_size_bucket: '<1KB' });
        trackEvent('tool_used', { tool_id: 'diff-checker', action: 'format', input_size_bucket: '<1KB' });
        expect(gtag).toHaveBeenCalledTimes(3);

        jest.setSystemTime(new Date('2026-01-01T00:00:02.000Z'));
        trackEvent('tool_used', { tool_id: 'diff-checker', action: 'compare', input_size_bucket: '<1KB' });
        expect(gtag).toHaveBeenCalledTimes(4);
    });
});

describe('trackToolUsed', () => {
    beforeEach(() => {
        clearToolUsedDedupe();
        removeGtag();
    });

    afterEach(() => {
        clearToolUsedDedupe();
        removeGtag();
    });

    it('sends tool_used with a coarse size bucket and no raw byte count', () => {
        const gtag = installGtag();

        trackToolUsed({
            toolId: 'base64-converter',
            action: 'encode',
            inputBytes: 2048,
            trigger: 'user',
            outcome: 'success'
        });

        expect(gtag).toHaveBeenCalledWith('event', 'tool_used', {
            tool_id: 'base64-converter',
            action: 'encode',
            trigger: 'user',
            outcome: 'success',
            input_size_bucket: '1–10KB'
        });
    });

    it('keeps sample and share triggers and drops an unknown trigger or outcome', () => {
        const gtag = installGtag();

        trackToolUsed({ toolId: 'diff-checker', action: 'compare', trigger: 'sample', outcome: 'error' });
        trackEvent('tool_used', {
            tool_id: 'json-formatter',
            action: 'format',
            trigger: 'paste',
            outcome: 'failed'
        });

        expect(gtag).toHaveBeenNthCalledWith(1, 'event', 'tool_used', {
            tool_id: 'diff-checker',
            action: 'compare',
            trigger: 'sample',
            outcome: 'error'
        });
        expect(gtag).toHaveBeenNthCalledWith(2, 'event', 'tool_used', {
            tool_id: 'json-formatter',
            action: 'format'
        });
    });
});

describe('inputSizeBucket', () => {
    it('uses the documented boundaries', () => {
        expect(inputSizeBucket(0)).toBe('<1KB');
        expect(inputSizeBucket(1023)).toBe('<1KB');
        expect(inputSizeBucket(1024)).toBe('1–10KB');
        expect(inputSizeBucket(10 * 1024 - 1)).toBe('1–10KB');
        expect(inputSizeBucket(10 * 1024)).toBe('10–100KB');
        expect(inputSizeBucket(100 * 1024 - 1)).toBe('10–100KB');
        expect(inputSizeBucket(100 * 1024)).toBe('>100KB');
        expect(inputSizeBucket(-1)).toBeUndefined();
        expect(inputSizeBucket(Number.NaN)).toBeUndefined();
        expect(INPUT_SIZE_BUCKETS).toEqual(['<1KB', '1–10KB', '10–100KB', '>100KB']);
    });
});

describe('shared output events', () => {
    beforeEach(() => {
        clearMountedToolAnalyticsId();
        removeGtag();
    });

    afterEach(() => {
        clearMountedToolAnalyticsId();
        removeGtag();
    });

    it('no-ops when no tool shell id is mounted', () => {
        const gtag = installGtag();
        trackCopyOutput();
        trackDownloadOutput('output.json');
        trackShareLinkCreated();
        trackFileLoaded(new File(['a'], 'a.txt'), 'drop');
        trackRelatedToolClick('json-formatter');
        expect(gtag).not.toHaveBeenCalled();
    });

    it('sends documented payloads once per helper call', () => {
        const gtag = installGtag();
        setMountedToolAnalyticsId('diff-checker');

        trackCopyOutput();
        trackDownloadOutput('patch.diff');
        trackShareLinkCreated();
        trackFileLoaded(new File(['{}'], 'data.json', { type: 'application/json' }), 'picker');
        trackRelatedToolClick('json-formatter');

        expect(gtag).toHaveBeenNthCalledWith(1, 'event', COPY_OUTPUT_EVENT, { tool_id: 'diff-checker' });
        expect(gtag).toHaveBeenNthCalledWith(2, 'event', DOWNLOAD_OUTPUT_EVENT, {
            tool_id: 'diff-checker',
            file_type: 'diff'
        });
        expect(gtag).toHaveBeenNthCalledWith(3, 'event', SHARE_LINK_CREATED_EVENT, { tool_id: 'diff-checker' });
        expect(gtag).toHaveBeenNthCalledWith(4, 'event', FILE_LOADED_EVENT, {
            tool_id: 'diff-checker',
            method: 'picker',
            file_type: 'json'
        });
        expect(gtag).toHaveBeenNthCalledWith(5, 'event', RELATED_TOOL_CLICK_EVENT, {
            tool_id: 'diff-checker',
            target_tool_id: 'json-formatter'
        });
        expect(JSON.stringify(gtag.mock.calls)).not.toContain('patch.diff');
        expect(JSON.stringify(gtag.mock.calls)).not.toContain('data.json');
    });

    it('drops an invalid file_loaded method', () => {
        const gtag = installGtag();
        setMountedToolAnalyticsId('diff-checker');

        trackEvent(FILE_LOADED_EVENT, {
            tool_id: 'diff-checker',
            method: 'upload',
            file_type: 'json'
        });

        expect(gtag).toHaveBeenCalledWith('event', FILE_LOADED_EVENT, {
            tool_id: 'diff-checker',
            file_type: 'json'
        });
    });
});

describe('utf8ByteLength', () => {
    it('counts UTF-8 bytes and treats an empty string as zero', () => {
        expect(utf8ByteLength('')).toBe(0);
        expect(utf8ByteLength(undefined as unknown as string)).toBe(0);
        expect(utf8ByteLength('é')).toBe(2);
    });

    it('counts a surrogate pair as four UTF-8 bytes', () => {
        expect(utf8ByteLength('😀')).toBe(4);
    });

    it('falls back to string length when TextEncoder is missing', () => {
        const saved = globalThis.TextEncoder;
        delete (globalThis as { TextEncoder?: typeof TextEncoder }).TextEncoder;

        expect(utf8ByteLength('ab')).toBe(2);

        globalThis.TextEncoder = saved;
    });
});
