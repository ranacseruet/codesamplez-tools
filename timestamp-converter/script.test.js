import { jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/dom';
import { render as preactRender } from 'preact';

const clearButtonInstances = [];

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

import { NotificationManager } from '../common/notification-manager';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import ClearButton from '../common/clear-button/ClearButton';
import { TimestampConverterToolUI } from './script';

const flushEffects = () => new Promise((resolve) => {
    setTimeout(resolve, 50);
});

function mount() {
    document.body.innerHTML = '<div id="timestamp-converter-app"></div>';
    new TimestampConverterToolUI();
}

function installClipboard(writeText) {
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText }
    });
}

function resultText() {
    return document.getElementById('tsc-result')?.textContent || '';
}

function modeGroup() {
    return document.querySelector('[aria-label="Conversion mode"]');
}

function unitGroup() {
    return document.querySelector('[aria-label="Timestamp unit"]');
}

describe('Unix Timestamp Converter runtime', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearButtonInstances.length = 0;
        installClipboard(jest.fn().mockResolvedValue(undefined));
        mount();
    });

    afterEach(() => {
        const root = document.getElementById('timestamp-converter-app');
        if (root) {
            preactRender(null, root);
        }
        document.body.innerHTML = '';
    });

    it('opens on the workbench with an empty state, auto unit, and the live clock', async () => {
        await flushEffects();
        const workbench = document.querySelector('.c-workbench.c-workbench--two-col');
        const toolbar = document.querySelector('.tsc-toolbar.c-toolbar');

        expect(workbench).not.toBeNull();
        expect(toolbar.classList.contains('c-action-strip')).toBe(true);
        expect(workbench.contains(document.querySelector('.tsc-form-panel'))).toBe(true);
        expect(workbench.contains(document.querySelector('.tsc-result-panel'))).toBe(true);
        expect(modeGroup().getAttribute('aria-label')).toBe('Conversion mode');
        expect(document.getElementById('tsc-mode-epoch').classList.contains('c-tab-button')).toBe(true);
        expect(document.getElementById('tsc-mode-epoch').classList.contains('active')).toBe(true);
        expect(document.getElementById('tsc-mode-epoch').getAttribute('aria-checked')).toBe('true');
        expect(document.getElementById('tsc-mode-date').getAttribute('aria-checked')).toBe('false');
        expect(document.getElementById('tsc-mode-date').tabIndex).toBe(-1);
        expect(unitGroup().getAttribute('aria-label')).toBe('Timestamp unit');
        expect(document.getElementById('tsc-unit-auto').getAttribute('aria-checked')).toBe('true');
        expect(document.getElementById('tsc-unit-auto').classList.contains('active')).toBe(true);
        expect(document.querySelector('select')).toBeNull();
        expect(document.getElementById('tsc-zone').value).toBe('UTC');
        expect(document.getElementById('tsc-epoch').value).toBe('');
        expect(document.getElementById('tsc-date')).toBeNull();
        expect(document.getElementById('tsc-jwt')).toBeNull();
        expect(document.getElementById('tsc-result')).toBeNull();
        expect(document.getElementById('tsc-empty-state')).not.toBeNull();
        expect(document.querySelector('.c-empty-state__icon')).not.toBeNull();
        expect(document.querySelector('.c-empty-state__message').textContent).toBe('Converted time will appear here');
        expect(document.querySelector('.c-empty-state__hint').textContent).toContain('converts as you type');
        expect(document.getElementById('tsc-now-seconds').textContent).toMatch(/^\d{10}$/);
        expect(document.getElementById('tsc-now-iso').textContent).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(document.getElementById('tsc-copy-seconds').getAttribute('aria-label')).toBe('Copy current Unix seconds');
        expect(document.getElementById('tsc-copy-iso').getAttribute('aria-label')).toBe('Copy current ISO-8601 time');
        expect(document.getElementById('tsc-copy-all').disabled).toBe(true);
    });

    it('moves the mode with the keyboard and shows only the active form', async () => {
        await flushEffects();
        const group = modeGroup();

        fireEvent.keyDown(group, { key: 'ArrowRight' });
        await flushEffects();
        expect(document.activeElement.id).toBe('tsc-mode-date');
        expect(document.getElementById('tsc-mode-date').getAttribute('aria-checked')).toBe('true');
        expect(document.getElementById('tsc-date')).not.toBeNull();
        expect(document.getElementById('tsc-epoch')).toBeNull();
        expect(unitGroup()).toBeNull();

        fireEvent.keyDown(group, { key: 'ArrowDown' });
        await flushEffects();
        expect(document.activeElement.id).toBe('tsc-mode-jwt');
        expect(document.getElementById('tsc-jwt')).not.toBeNull();
        expect(document.querySelector('.tsc-jwt-note').textContent).toContain('Unix seconds');
        expect(document.querySelector('a[href*="/jwt-decoder/"]')).not.toBeNull();

        fireEvent.keyDown(group, { key: 'End' });
        expect(document.getElementById('tsc-mode-jwt').getAttribute('aria-checked')).toBe('true');
        fireEvent.keyDown(group, { key: 'ArrowLeft' });
        await flushEffects();
        expect(document.getElementById('tsc-mode-date').getAttribute('aria-checked')).toBe('true');
        fireEvent.keyDown(group, { key: 'ArrowUp' });
        await flushEffects();
        expect(document.getElementById('tsc-mode-epoch').getAttribute('aria-checked')).toBe('true');
        fireEvent.keyDown(group, { key: 'Home' });
        expect(document.getElementById('tsc-mode-epoch').getAttribute('aria-checked')).toBe('true');
        fireEvent.keyDown(group, { key: 'a' });
        expect(document.getElementById('tsc-mode-epoch').getAttribute('aria-checked')).toBe('true');
        expect(document.getElementById('tsc-epoch')).not.toBeNull();
    });

    it('converts as the epoch, unit, and zone change, and Load Sample still fills the example', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-load-sample'));
        await flushEffects();

        expect(resultText()).toContain('2023-11-14T22:13:20.000Z');
        expect(resultText()).toContain('Time zone (America/New_York)');
        expect(resultText()).toContain('Tue, 14 Nov 2023 22:13:20 GMT');
        expect(resultText()).toContain('1700000000');
        expect(document.getElementById('tsc-zone').value).toBe('America/New_York');
        expect(document.getElementById('tsc-unit-chip').textContent).toBe('Auto · Seconds');
        expect(document.getElementById('tsc-unit-chip').classList.contains('c-status-chip')).toBe(true);
        expect(document.querySelector('.c-stats-panel')).not.toBeNull();
        expect(document.querySelector('.c-stat-row')).not.toBeNull();
        expect(document.getElementById('tsc-empty-state')).toBeNull();
        expect(NotificationManager.show).toHaveBeenCalledWith('Converted', 2000, { type: 'success' });

        NotificationManager.show.mockClear();
        fireEvent.input(document.getElementById('tsc-epoch'), { target: { value: '1700000000123' } });
        await flushEffects();
        expect(resultText()).toContain('2023-11-14T22:13:20.123Z');
        expect(document.getElementById('tsc-unit-chip').textContent).toBe('Auto · Milliseconds');
        expect(NotificationManager.show).not.toHaveBeenCalled();

        NotificationManager.show.mockClear();
        fireEvent.click(document.getElementById('tsc-unit-seconds'));
        await flushEffects();
        expect(document.getElementById('tsc-unit-seconds').getAttribute('aria-checked')).toBe('true');
        expect(document.getElementById('tsc-unit-chip').textContent).toBe('Seconds');
        expect(resultText()).not.toContain('2023-11-14T22:13:20.123Z');

        fireEvent.input(document.getElementById('tsc-epoch'), { target: { value: '1700000000123' } });
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-unit-milliseconds'));
        await flushEffects();
        fireEvent.input(document.getElementById('tsc-zone'), { target: { value: 'UTC' } });
        await flushEffects();
        expect(resultText()).toContain('2023-11-14T22:13:20.123Z');
        expect(resultText()).toContain('Time zone (UTC)');
        expect(document.getElementById('tsc-result').querySelector('textarea')).toBeNull();
    });

    it('converts a date and a JWT value as their fields change', async () => {
        await flushEffects();
        fireEvent.input(document.getElementById('tsc-zone'), { target: { value: 'America/New_York' } });
        fireEvent.click(document.getElementById('tsc-mode-date'));
        await flushEffects();
        fireEvent.input(document.getElementById('tsc-date'), { target: { value: '2023-11-14' } });
        await flushEffects();
        expect(document.getElementById('tsc-error').textContent).toBe('Enter a date and time.');
        expect(document.getElementById('tsc-error').classList.contains('c-input-status')).toBe(true);
        expect(document.getElementById('tsc-error').classList.contains('c-status-banner')).toBe(true);
        expect(document.getElementById('tsc-date').getAttribute('aria-invalid')).toBe('true');
        expect(document.getElementById('tsc-date').getAttribute('aria-describedby')).toBe('tsc-error');
        expect(document.getElementById('tsc-time').getAttribute('aria-describedby')).toBe('tsc-error');

        fireEvent.input(document.getElementById('tsc-time'), { target: { value: '17:13:20' } });
        await flushEffects();
        fireEvent.input(document.getElementById('tsc-millisecond'), { target: { value: '0' } });
        await flushEffects();
        expect(resultText()).toContain('1700000000');
        expect(document.getElementById('tsc-error')).toBeNull();

        fireEvent.input(document.getElementById('tsc-millisecond'), { target: { value: 'nope' } });
        await flushEffects();
        expect(document.getElementById('tsc-millisecond').getAttribute('aria-invalid')).toBe('true');
        expect(document.getElementById('tsc-millisecond').getAttribute('aria-describedby')).toBe('tsc-error');
        expect(document.getElementById('tsc-error').textContent).toContain('00:00:00');

        fireEvent.click(document.getElementById('tsc-mode-jwt'));
        await flushEffects();
        fireEvent.input(document.getElementById('tsc-jwt'), { target: { value: '1700000000123' } });
        await flushEffects();
        expect(document.getElementById('tsc-unit-chip').textContent).toBe('Seconds');
        expect(resultText()).not.toContain('2023-11-14T22:13:20.123Z');
    });

    it('shows inline errors on the active field and converts again from the primary button', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-convert'));
        await flushEffects();
        expect(document.getElementById('tsc-error').textContent).toBe('Enter a timestamp.');
        expect(document.getElementById('tsc-epoch').getAttribute('aria-invalid')).toBe('true');
        expect(document.getElementById('tsc-epoch').getAttribute('aria-describedby')).toBe('tsc-error');
        expect(document.getElementById('tsc-zone').getAttribute('aria-invalid')).toBe('false');
        expect(document.querySelector('.tsc-form-panel').contains(document.getElementById('tsc-error'))).toBe(true);

        fireEvent.click(document.getElementById('tsc-mode-date'));
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-convert'));
        await flushEffects();
        expect(document.getElementById('tsc-error').textContent).toBe('Enter a date and time.');

        fireEvent.click(document.getElementById('tsc-mode-jwt'));
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-convert'));
        await flushEffects();
        expect(document.getElementById('tsc-error').textContent).toBe('Enter a JWT exp, iat, or nbf value in seconds.');
        expect(document.getElementById('tsc-jwt').getAttribute('aria-describedby')).toBe('tsc-error');

        fireEvent.click(document.getElementById('tsc-mode-epoch'));
        await flushEffects();
        fireEvent.input(document.getElementById('tsc-epoch'), { target: { value: 'not-a-time' } });
        await flushEffects();
        expect(document.getElementById('tsc-error').textContent).toContain('Enter a Unix timestamp');
        expect(document.getElementById('tsc-result')).toBeNull();
        expect(document.getElementById('tsc-empty-state')).not.toBeNull();

        fireEvent.input(document.getElementById('tsc-epoch'), { target: { value: '1700000000' } });
        await flushEffects();
        fireEvent.input(document.getElementById('tsc-zone'), { target: { value: 'Not/AZone' } });
        await flushEffects();
        expect(document.getElementById('tsc-error').textContent).toContain('IANA time zone');
        expect(document.getElementById('tsc-zone').getAttribute('aria-invalid')).toBe('true');
        expect(document.getElementById('tsc-zone').getAttribute('aria-describedby')).toBe('tsc-error');
        expect(document.querySelector('.tsc-toolbar').contains(document.getElementById('tsc-error'))).toBe(true);
        expect(document.getElementById('tsc-epoch').getAttribute('aria-invalid')).toBe('false');

        fireEvent.input(document.getElementById('tsc-zone'), { target: { value: 'UTC' } });
        await flushEffects();
        NotificationManager.show.mockClear();
        fireEvent.click(document.getElementById('tsc-convert'));
        await flushEffects();
        expect(resultText()).toContain('2023-11-14T22:13:20.000Z');
        expect(NotificationManager.show).toHaveBeenCalledWith('Converted', 2000, { type: 'success' });
    });

    it('copies the live clock, each result value, and the whole result', async () => {
        fireEvent.click(document.getElementById('tsc-copy-seconds'));
        fireEvent.click(document.getElementById('tsc-copy-iso'));
        fireEvent.click(document.getElementById('tsc-copy-all'));
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();

        await flushEffects();
        const seconds = document.getElementById('tsc-now-seconds').textContent;
        const iso = document.getElementById('tsc-now-iso').textContent;
        fireEvent.click(document.getElementById('tsc-copy-seconds'));
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(seconds);
            expect(NotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', 2000, { type: 'success' });
        });
        fireEvent.click(document.getElementById('tsc-copy-iso'));
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(iso));

        fireEvent.click(document.getElementById('tsc-load-sample'));
        await flushEffects();
        fireEvent.click(document.querySelector('[aria-label="Copy ISO 8601"]'));
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('2023-11-14T22:13:20.000Z'));
        fireEvent.click(document.querySelector('[aria-label="Copy Unix seconds"]'));
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('1700000000'));
        fireEvent.click(document.getElementById('tsc-copy-all'));
        await waitFor(() => {
            const payload = navigator.clipboard.writeText.mock.calls.at(-1)[0];
            expect(payload).toContain('Detected unit: seconds');
            expect(payload).toContain('ISO 8601: 2023-11-14T22:13:20.000Z');
            expect(payload).toContain('RFC 2822: Tue, 14 Nov 2023 22:13:20 GMT');
        });
    });

    it('uses UTC when the browser time zone cannot be read', async () => {
        await flushEffects();
        const realDateTimeFormat = Intl.DateTimeFormat;
        function DateTimeFormatStub(...args) {
            if (args.length === 0) {
                return { resolvedOptions: () => ({ timeZone: '' }) };
            }
            return new realDateTimeFormat(...args);
        }
        DateTimeFormatStub.prototype = realDateTimeFormat.prototype;
        Intl.DateTimeFormat = DateTimeFormatStub;

        try {
            fireEvent.input(document.getElementById('tsc-epoch'), { target: { value: '1700000000' } });
            await flushEffects();
            expect(resultText()).toContain('Local (UTC)');
            Intl.DateTimeFormat = function ThrowingDateTimeFormat(...args) {
                if (args.length === 0) {
                    throw new Error('unavailable');
                }
                return new realDateTimeFormat(...args);
            };
            fireEvent.input(document.getElementById('tsc-epoch'), { target: { value: '1700000001' } });
            await flushEffects();
            expect(resultText()).toContain('Local (UTC)');
        } finally {
            Intl.DateTimeFormat = realDateTimeFormat;
        }
    });

    it('reports a copy failure without throwing', async () => {
        await flushEffects();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        installClipboard(jest.fn().mockRejectedValue(new Error('denied')));
        document.execCommand = jest.fn().mockReturnValue(false);
        fireEvent.click(document.getElementById('tsc-copy-seconds'));
        await waitFor(() => {
            expect(NotificationManager.show).toHaveBeenCalledWith('Could not copy', 2000, { type: 'error' });
        });
    });

    it('fills the epoch from the live clock and offers the local zone as a chip', async () => {
        jest.spyOn(Date, 'now').mockReturnValue(1700000000500);
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-mode-date'));
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-use-now'));
        await flushEffects();
        expect(document.getElementById('tsc-mode-epoch').getAttribute('aria-checked')).toBe('true');
        expect(document.getElementById('tsc-epoch').value).toBe('1700000000');
        expect(document.getElementById('tsc-unit-seconds').getAttribute('aria-checked')).toBe('true');
        expect(resultText()).toContain('2023-11-14T22:13:20.000Z');
        jest.restoreAllMocks();

        await flushEffects();
        const localZone = document.getElementById('tsc-local-zone').textContent;
        expect(document.getElementById('tsc-local-zone').classList.contains('c-status-chip')).toBe(true);
        expect(document.getElementById('tsc-local-zone').getAttribute('aria-label')).toBe(`Use local time zone ${localZone}`);
        fireEvent.input(document.getElementById('tsc-zone'), { target: { value: 'Europe/Paris' } });
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-local-zone'));
        await flushEffects();
        expect(document.getElementById('tsc-zone').value).toBe(localZone);
    });

    it('moves the unit with the keyboard and clears the timestamp from the clear button', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-load-sample'));
        await flushEffects();
        fireEvent.keyDown(unitGroup(), { key: 'ArrowRight' });
        await flushEffects();
        expect(document.activeElement.id).toBe('tsc-unit-seconds');
        expect(document.getElementById('tsc-unit-seconds').getAttribute('aria-checked')).toBe('true');
        fireEvent.keyDown(unitGroup(), { key: 'End' });
        await flushEffects();
        expect(document.getElementById('tsc-unit-nanoseconds').getAttribute('aria-checked')).toBe('true');

        document.getElementById('tsc-epoch').dispatchEvent(new Event('textCleared'));
        await flushEffects();
        expect(document.getElementById('tsc-epoch').value).toBe('');
        expect(document.getElementById('tsc-result')).toBeNull();
        expect(document.getElementById('tsc-empty-state')).not.toBeNull();
        expect(NotificationManager.show).toHaveBeenCalledWith('Input cleared', 2000, { type: 'success' });
        expect(clearButtonInstances.at(-1).updateVisibility).toHaveBeenCalled();
    });

    it('shows the calendar note when the instant has no JavaScript date', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('tsc-unit-seconds'));
        await flushEffects();
        fireEvent.input(document.getElementById('tsc-epoch'), { target: { value: '9000000000000' } });
        await flushEffects();
        expect(document.querySelector('#tsc-result .tsc-note').textContent).toContain('outside the range');
        expect(resultText()).toContain('9000000000000');
        expect(resultText()).not.toContain('ISO 8601');
    });

    it('runs Convert from the primary shortcut', async () => {
        await flushEffects();
        fireEvent.input(document.getElementById('tsc-epoch'), { target: { value: '1700000000' } });
        await flushEffects();
        NotificationManager.show.mockClear();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
        await waitFor(() => expect(NotificationManager.show).toHaveBeenCalledWith('Converted', 2000, { type: 'success' }));
        expect(resultText()).toContain('2023-11-14T22:13:20.000Z');
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

    it('disconnects the clear button on unmount and when the epoch field leaves', async () => {
        await flushEffects();
        expect(ClearButton).toHaveBeenCalled();

        fireEvent.click(document.getElementById('tsc-mode-date'));
        await flushEffects();
        expect(clearButtonInstances.at(-1).disconnect).toHaveBeenCalled();

        fireEvent.click(document.getElementById('tsc-mode-epoch'));
        await flushEffects();
        preactRender(null, document.getElementById('timestamp-converter-app'));
        await flushEffects();
        expect(clearButtonInstances.at(-1).disconnect).toHaveBeenCalled();
    });
});
