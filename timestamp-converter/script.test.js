import { jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/dom';
import { render as preactRender } from 'preact';

const clearButtonInstances = [];
const copyButtonInstances = [];

jest.mock('../common/notification-manager', () => ({
    NotificationManager: { show: jest.fn() }
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
    mountToolShell: jest.fn()
}));

jest.mock('../common/clear-button/ClearButton', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
        const instance = {
            updateVisibility: jest.fn(),
            disconnect: jest.fn()
        };
        clearButtonInstances.push(instance);
        return instance;
    })
}));

jest.mock('../common/copy-button/CopyButton', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
        const instance = {
            updateVisibility: jest.fn(),
            disconnect: jest.fn()
        };
        copyButtonInstances.push(instance);
        return instance;
    })
}));

import { NotificationManager } from '../common/notification-manager';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import ClearButton from '../common/clear-button/ClearButton';
import CopyButton from '../common/copy-button/CopyButton';
import { TimestampConverterToolUI } from './script';

const flushEffects = () => new Promise((resolve) => {
    setTimeout(resolve, 50);
});

function mount() {
    document.body.innerHTML = '<div id="timestamp-converter-app"></div>';
    new TimestampConverterToolUI();
}

describe('Unix Timestamp Converter runtime', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearButtonInstances.length = 0;
        copyButtonInstances.length = 0;
        mount();
    });

    afterEach(() => {
        const root = document.getElementById('timestamp-converter-app');
        if (root) {
            preactRender(null, root);
        }
        document.body.innerHTML = '';
    });

    it('renders an empty timestamp, auto unit, and the current epoch', async () => {
        await flushEffects();
        expect(document.getElementById('tsc-unit').value).toBe('auto');
        expect(document.getElementById('tsc-zone').value).toBe('UTC');
        expect(document.getElementById('tsc-epoch').value).toBe('');
        expect(document.getElementById('tsc-output').value).toBe('');
        expect(document.getElementById('tsc-result')).toBeNull();
        expect(document.getElementById('tsc-now').textContent).toMatch(/^\d{10} · \d{4}-\d{2}-\d{2}T/);
        expect(document.querySelector('a[href*="/jwt-decoder/"]')).not.toBeNull();
    });

    it('converts the sample and a typed millisecond value', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-load-sample'));
        await flushEffects();

        const output = document.getElementById('tsc-output').value;
        expect(output).toContain('ISO 8601: 2023-11-14T22:13:20.000Z');
        expect(output).toContain('Time zone (America/New_York): 2023-11-14 17:13:20.000 UTC-05:00');
        expect(output).toContain('RFC 2822: Tue, 14 Nov 2023 22:13:20 GMT');
        expect(document.getElementById('tsc-zone').value).toBe('America/New_York');
        expect(document.getElementById('tsc-result').textContent).toContain('1700000000');
        expect(NotificationManager.show).toHaveBeenCalledWith('Converted', 2000, { type: 'success' });

        fireEvent.input(document.getElementById('tsc-epoch'), { target: { value: '1700000000123' } });
        fireEvent.change(document.getElementById('tsc-unit'), { target: { value: 'auto' } });
        fireEvent.input(document.getElementById('tsc-zone'), { target: { value: 'UTC' } });
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-convert'));
        await flushEffects();
        expect(document.getElementById('tsc-output').value).toContain('2023-11-14T22:13:20.123Z');
        expect(document.getElementById('tsc-output').value).toContain('Detected unit: milliseconds');
    });

    it('converts a date in the chosen zone and a JWT value as seconds', async () => {
        await flushEffects();
        fireEvent.input(document.getElementById('tsc-zone'), { target: { value: 'America/New_York' } });
        fireEvent.input(document.getElementById('tsc-date'), { target: { value: '2023-11-14' } });
        fireEvent.input(document.getElementById('tsc-time'), { target: { value: '17:13:20' } });
        fireEvent.input(document.getElementById('tsc-millisecond'), { target: { value: '0' } });
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-convert-date'));
        await flushEffects();
        expect(document.getElementById('tsc-output').value).toContain('Unix seconds: 1700000000');

        fireEvent.input(document.getElementById('tsc-jwt'), { target: { value: '1700000000123' } });
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-convert-jwt'));
        await flushEffects();
        expect(document.getElementById('tsc-output').value).toContain('Detected unit: seconds');
        expect(document.getElementById('tsc-output').value).not.toContain('2023-11-14T22:13:20.123Z');
    });

    it('shows an error for an empty field, a bad timestamp, and a bad zone', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-convert'));
        await flushEffects();
        expect(document.getElementById('tsc-error').textContent).toBe('Enter a timestamp.');

        fireEvent.click(document.getElementById('tsc-convert-date'));
        await flushEffects();
        expect(document.getElementById('tsc-error').textContent).toBe('Enter a date and time.');

        fireEvent.click(document.getElementById('tsc-convert-jwt'));
        await flushEffects();
        expect(document.getElementById('tsc-error').textContent).toBe('Enter a JWT exp, iat, or nbf value in seconds.');

        fireEvent.input(document.getElementById('tsc-epoch'), { target: { value: 'not-a-time' } });
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-convert'));
        await flushEffects();
        expect(document.getElementById('tsc-error').textContent).toContain('Enter a Unix timestamp');
        expect(document.getElementById('tsc-output').value).toBe('');

        fireEvent.input(document.getElementById('tsc-epoch'), { target: { value: '1700000000' } });
        fireEvent.input(document.getElementById('tsc-zone'), { target: { value: 'Not/AZone' } });
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-convert'));
        await flushEffects();
        expect(document.getElementById('tsc-error').textContent).toContain('IANA time zone');
    });

    it('copies the current seconds into the timestamp field', async () => {
        jest.spyOn(Date, 'now').mockReturnValue(1700000000500);
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-use-now'));
        await flushEffects();
        expect(document.getElementById('tsc-epoch').value).toBe('1700000000');
        expect(document.getElementById('tsc-unit').value).toBe('seconds');
        expect(document.getElementById('tsc-output').value).toContain('2023-11-14T22:13:20.000Z');
        jest.restoreAllMocks();
    });

    it('clears the timestamp from the clear button and copies the result', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-load-sample'));
        await flushEffects();

        document.getElementById('tsc-epoch').dispatchEvent(new Event('textCleared'));
        await flushEffects();
        expect(document.getElementById('tsc-epoch').value).toBe('');
        expect(document.getElementById('tsc-output').value).toBe('');
        expect(NotificationManager.show).toHaveBeenCalledWith('Input cleared', 2000, { type: 'success' });

        fireEvent.click(document.getElementById('tsc-load-sample'));
        await flushEffects();
        document.getElementById('tsc-output').dispatchEvent(new Event('contentCopied'));
        expect(NotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', 2000, { type: 'success' });
        expect(copyButtonInstances.at(-1).updateVisibility).toHaveBeenCalled();
        expect(clearButtonInstances.at(-1).updateVisibility).toHaveBeenCalled();
    });

    it('shows the calendar note when the instant has no JavaScript date', async () => {
        await flushEffects();
        fireEvent.input(document.getElementById('tsc-epoch'), { target: { value: '9000000000000' } });
        fireEvent.change(document.getElementById('tsc-unit'), { target: { value: 'seconds' } });
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-convert'));
        await flushEffects();
        expect(document.querySelector('#tsc-result .tsc-note').textContent).toContain('outside the range');
        expect(document.getElementById('tsc-output').value).toContain('Unix seconds: 9000000000000');
        expect(document.getElementById('tsc-output').value).not.toContain('ISO 8601:');
    });

    it('runs Convert timestamp from the primary shortcut', async () => {
        await flushEffects();
        fireEvent.input(document.getElementById('tsc-epoch'), { target: { value: '1700000000' } });
        await flushEffects();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
        await waitFor(() => expect(document.getElementById('tsc-output').value).toContain('2023-11-14T22:13:20.000Z'));
    });

    it('uses the prerendered root fallback and throws when no root exists', async () => {
        document.body.innerHTML = '<div id="timestamp-converter-tool"><span id="stale-prerender"></span></div>';
        new TimestampConverterToolUI('#missing-root');
        await flushEffects();
        expect(document.getElementById('timestamp-converter-tool').querySelector('#tsc-convert')).not.toBeNull();

        const toolRoot = document.getElementById('timestamp-converter-tool');
        preactRender(null, toolRoot);
        document.body.innerHTML = '';
        expect(() => new TimestampConverterToolUI()).toThrow('Unix Timestamp Converter root element not found');
    });

    it('bootstraps the shell on DOMContentLoaded', async () => {
        document.body.innerHTML = `
          <div id="app-shell-header"></div>
          <div id="timestamp-converter-app"></div>
          <div id="app-shell-footer"></div>
        `;
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await flushEffects();

        expect(mountToolShell).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Unix Timestamp Converter',
            description: expect.stringContaining('Convert Unix seconds')
        }));
        expect(document.getElementById('tsc-convert')).not.toBeNull();
    });

    it('disconnects the clear and copy buttons on unmount', async () => {
        await flushEffects();
        expect(ClearButton).toHaveBeenCalled();
        expect(CopyButton).toHaveBeenCalled();

        preactRender(null, document.getElementById('timestamp-converter-app'));
        await flushEffects();
        expect(clearButtonInstances.at(-1).disconnect).toHaveBeenCalled();
        expect(copyButtonInstances.at(-1).disconnect).toHaveBeenCalled();
    });
});
