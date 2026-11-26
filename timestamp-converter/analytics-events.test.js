import { jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/dom';
import { clearToolUsedDedupe } from '../common/analytics-events';

jest.mock('../common/notification-manager', () => ({
    NotificationManager: { show: jest.fn() }
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
    mountToolShell: jest.fn()
}));

jest.mock('../common/clear-button/ClearButton', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        updateVisibility: jest.fn(),
        disconnect: jest.fn()
    }))
}));

jest.mock('../common/copy-button/CopyButton', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        updateVisibility: jest.fn(),
        disconnect: jest.fn()
    }))
}));

import { TimestampConverterToolUI } from './script';

const SECRET = '1700000000';
const ZONE = 'America/New_York';

function installGtag() {
    const gtag = jest.fn();
    window.gtag = gtag;
    return gtag;
}

function toolUsedCalls(gtag) {
    return gtag.mock.calls.filter((call) => call[0] === 'event' && call[1] === 'tool_used');
}

const flushEffects = () => new Promise((resolve) => {
    setTimeout(resolve, 50);
});

describe('Unix Timestamp Converter tool_used', () => {
    beforeEach(() => {
        clearToolUsedDedupe();
        delete window.gtag;
        document.body.innerHTML = '<div id="timestamp-converter-app"></div>';
        new TimestampConverterToolUI();
    });

    afterEach(() => {
        clearToolUsedDedupe();
        delete window.gtag;
        document.body.innerHTML = '';
    });

    it('fires one convert-epoch event and omits the timestamp and the zone', async () => {
        const gtag = installGtag();
        fireEvent.input(document.getElementById('tsc-epoch'), { target: { value: SECRET } });
        fireEvent.input(document.getElementById('tsc-zone'), { target: { value: ZONE } });
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-convert'));

        await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
        expect(document.getElementById('tsc-output').value).toContain(SECRET);
        expect(toolUsedCalls(gtag)[0][2]).toEqual({
            tool_id: 'timestamp-converter',
            action: 'convert-epoch',
            trigger: 'user',
            outcome: 'success',
            input_size_bucket: '<1KB'
        });
        expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain(SECRET);
        expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain(ZONE);
        expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('2023-11-14');
    });

    it('does not fire when the timestamp is empty', async () => {
        const gtag = installGtag();
        fireEvent.click(document.getElementById('tsc-convert'));
        await Promise.resolve();
        expect(toolUsedCalls(gtag)).toHaveLength(0);
    });

    it('tags a bad timestamp as convert-epoch error and omits the text', async () => {
        const gtag = installGtag();
        const invalid = 'not-a-time-UNIQUE-94';
        fireEvent.input(document.getElementById('tsc-epoch'), { target: { value: invalid } });
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-convert'));

        await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
        expect(toolUsedCalls(gtag)[0][2]).toEqual({
            tool_id: 'timestamp-converter',
            action: 'convert-epoch',
            trigger: 'user',
            outcome: 'error',
            input_size_bucket: '<1KB'
        });
        expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain(invalid);
    });

    it('tags Load Sample as sample and omits the worked timestamp', async () => {
        const gtag = installGtag();
        fireEvent.click(document.getElementById('tsc-load-sample'));

        await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
        expect(toolUsedCalls(gtag)[0][2]).toEqual(expect.objectContaining({
            tool_id: 'timestamp-converter',
            action: 'convert-epoch',
            trigger: 'sample',
            outcome: 'success'
        }));
        expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain(SECRET);
        expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('1700000000123456789');
    });

    it('tags date and JWT conversions without the typed values', async () => {
        const gtag = installGtag();
        fireEvent.input(document.getElementById('tsc-date'), { target: { value: '2023-11-14' } });
        fireEvent.input(document.getElementById('tsc-time'), { target: { value: '17:13:20' } });
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-convert-date'));
        await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
        expect(toolUsedCalls(gtag)[0][2].action).toBe('convert-date');
        expect(toolUsedCalls(gtag)[0][2].outcome).toBe('success');
        expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('2023-11-14');

        clearToolUsedDedupe();
        fireEvent.input(document.getElementById('tsc-jwt'), { target: { value: '1516239022' } });
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-convert-jwt'));
        await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(2));
        expect(toolUsedCalls(gtag)[1][2].action).toBe('convert-jwt');
        expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('1516239022');
    });
});
