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

jest.mock('../common/DownloadManager', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        downloadFile: jest.fn()
    }))
}));

import { NotificationManager } from '../common/notification-manager';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import ClearButton from '../common/clear-button/ClearButton';
import DownloadManager from '../common/DownloadManager';
import { UuidGeneratorToolUI } from './script';
import { WORKED_EXAMPLE_V4, parseUuid } from './uuid';

const flushEffects = () => new Promise((resolve) => {
    setTimeout(resolve, 50);
});

function mount() {
    document.body.innerHTML = '<div id="uuid-generator-app"></div>';
    new UuidGeneratorToolUI();
}

function generatedLines() {
    return Array.from(document.querySelectorAll('.uuidg-line code')).map((node) => node.textContent);
}

function installClipboard(writeText) {
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText }
    });
}

describe('UUID Generator runtime', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearButtonInstances.length = 0;
        installClipboard(jest.fn().mockResolvedValue(undefined));
        mount();
    });

    afterEach(() => {
        const root = document.getElementById('uuid-generator-app');
        if (root) {
            preactRender(null, root);
        }
        document.body.innerHTML = '';
    });

    it('uses the workbench, toolbar, and segmented version control', () => {
        const toolbar = document.querySelector('.c-toolbar');
        const workbench = document.querySelector('.c-workbench.c-workbench--two-col');

        expect(toolbar).not.toBeNull();
        expect(workbench).not.toBeNull();
        expect(toolbar.classList.contains('c-action-strip')).toBe(true);
        expect(toolbar.contains(document.getElementById('uuid-generate'))).toBe(true);
        expect(toolbar.contains(document.getElementById('uuid-version-v4'))).toBe(true);
        expect(toolbar.contains(document.getElementById('uuid-count'))).toBe(true);
        expect(toolbar.contains(document.getElementById('uuid-uppercase'))).toBe(true);
        expect(toolbar.querySelector('.c-tab-list').getAttribute('aria-label')).toBe('UUID version');
        expect(workbench.contains(document.getElementById('uuid-output'))).toBe(true);
        expect(workbench.contains(document.getElementById('uuid-validate'))).toBe(true);
        expect(document.getElementById('uuid-version-v4').classList.contains('c-tab-button')).toBe(true);
        expect(document.getElementById('uuid-version-v7').classList.contains('c-tab-button')).toBe(true);
        expect(document.querySelector('.c-empty-state__message').textContent).toBe('Generated UUIDs will appear here');
        expect(document.querySelector('.c-empty-state__hint').textContent).toContain('run Generate');
    });

    it('renders version 4, count 1, and one UUID on first paint', async () => {
        await flushEffects();

        const version4 = document.getElementById('uuid-version-v4');
        const version7 = document.getElementById('uuid-version-v7');
        expect(version4.getAttribute('aria-checked')).toBe('true');
        expect(version4.classList.contains('active')).toBe(true);
        expect(version4.getAttribute('role')).toBe('radio');
        expect(version7.getAttribute('aria-checked')).toBe('false');
        expect(version7.tabIndex).toBe(-1);
        expect(document.getElementById('uuid-count').value).toBe('1');
        expect(document.getElementById('uuid-uppercase').checked).toBe(false);
        expect(document.getElementById('uuid-no-hyphens').checked).toBe(false);
        expect(document.querySelector('.c-empty-state')).toBeNull();
        expect(generatedLines()).toHaveLength(1);
        expect(parseUuid(generatedLines()[0]).version).toBe(4);
        expect(document.getElementById('uuid-output-chip').textContent).toBe('1 · Version 4');
        expect(document.getElementById('uuid-output').querySelector('.c-code-output')).not.toBeNull();
        expect(document.getElementById('uuid-download').disabled).toBe(false);
        expect(document.getElementById('uuid-generate').textContent).toContain('Generate');
        expect(NotificationManager.show).not.toHaveBeenCalledWith('Generated 1 UUID', 2000, { type: 'success' });
    });

    it('moves the version with arrow keys and replaces the list only on Generate', async () => {
        await flushEffects();
        const first = generatedLines()[0];
        const version4 = document.getElementById('uuid-version-v4');
        version4.focus();
        fireEvent.keyDown(version4.parentElement, { key: 'ArrowRight' });
        await flushEffects();

        const version7 = document.getElementById('uuid-version-v7');
        expect(version7.getAttribute('aria-checked')).toBe('true');
        expect(version7.classList.contains('active')).toBe(true);
        expect(document.activeElement).toBe(version7);
        expect(generatedLines()[0]).toBe(first);

        fireEvent.keyDown(version7.parentElement, { key: 'End' });
        expect(document.getElementById('uuid-version-v7').getAttribute('aria-checked')).toBe('true');
        fireEvent.keyDown(document.getElementById('uuid-version-v7').parentElement, { key: 'ArrowRight' });
        await flushEffects();
        expect(document.getElementById('uuid-version-v4').getAttribute('aria-checked')).toBe('true');
        fireEvent.keyDown(document.getElementById('uuid-version-v4').parentElement, { key: 'ArrowDown' });
        await flushEffects();
        expect(document.getElementById('uuid-version-v7').getAttribute('aria-checked')).toBe('true');
        fireEvent.keyDown(document.getElementById('uuid-version-v7').parentElement, { key: 'ArrowUp' });
        await flushEffects();
        expect(document.getElementById('uuid-version-v4').getAttribute('aria-checked')).toBe('true');
        fireEvent.keyDown(document.getElementById('uuid-version-v4').parentElement, { key: 'ArrowLeft' });
        await flushEffects();
        expect(document.getElementById('uuid-version-v7').getAttribute('aria-checked')).toBe('true');
        fireEvent.keyDown(document.getElementById('uuid-version-v7').parentElement, { key: 'ArrowLeft' });
        await flushEffects();
        expect(document.getElementById('uuid-version-v4').getAttribute('aria-checked')).toBe('true');
        fireEvent.keyDown(document.getElementById('uuid-version-v4').parentElement, { key: 'Home' });
        expect(document.getElementById('uuid-version-v4').getAttribute('aria-checked')).toBe('true');
        fireEvent.keyDown(document.getElementById('uuid-version-v4').parentElement, { key: 'Tab' });
        expect(document.getElementById('uuid-version-v4').getAttribute('aria-checked')).toBe('true');

        fireEvent.click(document.getElementById('uuid-version-v7'));
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-generate'));
        await flushEffects();
        expect(parseUuid(generatedLines()[0]).version).toBe(7);
        expect(document.getElementById('uuid-output-chip').textContent).toBe('1 · Version 7');
    });

    it('generates a version 4 UUID and downloads it under a fixed filename', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-generate'));
        await flushEffects();

        const output = generatedLines().join('\n');
        const parsed = parseUuid(output);
        expect(parsed.valid).toBe(true);
        expect(parsed.version).toBe(4);
        expect(parsed.variant).toBe('rfc4122');
        expect(NotificationManager.show).toHaveBeenCalledWith('Generated 1 UUID', 2000, { type: 'success' });

        fireEvent.click(document.getElementById('uuid-download'));
        const downloadManager = DownloadManager.mock.results.at(-1).value;
        expect(downloadManager.downloadFile).toHaveBeenCalledWith(output, 'uuids.txt', 'text/plain');
        expect(downloadManager.downloadFile.mock.calls[0][1]).toBe('uuids.txt');
    });

    it('copies one UUID and the whole list', async () => {
        await flushEffects();
        fireEvent.input(document.getElementById('uuid-count'), { target: { value: '2' } });
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-generate'));
        await flushEffects();

        const lines = generatedLines();
        expect(lines).toHaveLength(2);
        fireEvent.click(document.querySelector(`[aria-label="Copy UUID ${lines[0]}"]`));
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(lines[0]);
            expect(NotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', 2000, { type: 'success' });
        });

        fireEvent.click(document.getElementById('uuid-copy-all'));
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(lines.join('\n'));
        });
    });

    it('reports a copy failure without throwing', async () => {
        await flushEffects();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        installClipboard(jest.fn().mockRejectedValue(new Error('denied')));
        document.execCommand = jest.fn().mockReturnValue(false);
        const line = generatedLines()[0];
        fireEvent.click(document.querySelector(`[aria-label="Copy UUID ${line}"]`));
        await waitFor(() => {
            expect(NotificationManager.show).toHaveBeenCalledWith('Could not copy', 2000, { type: 'error' });
        });
    });

    it('applies uppercase and no-hyphen formatting to a version 7 batch', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-version-v7'));
        fireEvent.input(document.getElementById('uuid-count'), { target: { value: '2' } });
        fireEvent.change(document.getElementById('uuid-uppercase'), { target: { checked: true } });
        fireEvent.change(document.getElementById('uuid-no-hyphens'), { target: { checked: true } });
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-generate'));
        await flushEffects();

        const lines = generatedLines();
        expect(lines).toHaveLength(2);
        lines.forEach((line) => {
            expect(line).toBe(line.toUpperCase());
            expect(line).not.toContain('-');
            const parsed = parseUuid(line);
            expect(parsed.valid && parsed.version).toBe(7);
            expect(parsed.timestampIso).toEqual(expect.any(String));
        });
        expect(NotificationManager.show).toHaveBeenCalledWith('Generated 2 UUIDs', 2000, { type: 'success' });

        fireEvent.click(document.getElementById('uuid-version-v4'));
        fireEvent.input(document.getElementById('uuid-count'), { target: { value: '1' } });
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-generate'));
        await flushEffects();
        expect(parseUuid(generatedLines()[0]).version).toBe(4);
    });

    it('rejects a count outside 1 to 100 and does not download an empty list', async () => {
        await flushEffects();
        fireEvent.input(document.getElementById('uuid-count'), { target: { value: '101' } });
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-generate'));
        await flushEffects();

        expect(document.getElementById('uuid-generate-error').textContent).toContain('1 to 100');
        expect(generatedLines()).toHaveLength(0);
        expect(document.querySelector('.c-empty-state')).not.toBeNull();
        expect(document.getElementById('uuid-count').getAttribute('aria-invalid')).toBe('true');
        expect(document.getElementById('uuid-count').getAttribute('aria-describedby')).toBe('uuid-generate-error');
        expect(document.getElementById('uuid-download').disabled).toBe(true);

        fireEvent.click(document.getElementById('uuid-download'));
        fireEvent.click(document.getElementById('uuid-copy-all'));
        expect(DownloadManager).not.toHaveBeenCalled();
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });

    it('validates a pasted UUID and a line that is not one', async () => {
        await flushEffects();
        const input = document.getElementById('uuid-validate-input');
        fireEvent.input(input, { target: { value: `${WORKED_EXAMPLE_V4}\nnot-a-uuid` } });
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-validate'));
        await flushEffects();

        const result = document.getElementById('uuid-validate-result');
        expect(result.querySelector('.c-status-banner.status-success')).not.toBeNull();
        expect(result.querySelector('.c-status-banner.status-error')).not.toBeNull();
        expect(result.querySelector('.c-stats-panel .c-stat-row')).not.toBeNull();
        expect(result.textContent).toContain('Valid');
        expect(result.textContent).toContain(WORKED_EXAMPLE_V4);
        expect(result.textContent).toContain('Version 4 (random)');
        expect(result.textContent).toContain('Variant RFC 4122');
        expect(result.textContent).toContain('Not a UUID.');
        expect(result.querySelector(`[aria-label="Copy UUID ${WORKED_EXAMPLE_V4}"]`)).not.toBeNull();

        fireEvent.click(result.querySelector(`[aria-label="Copy UUID ${WORKED_EXAMPLE_V4}"]`));
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(WORKED_EXAMPLE_V4);
        });
    });

    it('does not validate an empty paste', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-validate'));
        await flushEffects();
        expect(document.getElementById('uuid-validate-error').textContent).toBe('Paste a UUID to validate.');
        expect(document.getElementById('uuid-validate-input').getAttribute('aria-invalid')).toBe('true');
        expect(document.getElementById('uuid-validate-input').getAttribute('aria-describedby')).toBe('uuid-validate-error');
        expect(document.querySelector('.uuidg-result')).toBeNull();
    });

    it('loads the worked examples into the validator', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-load-sample'));
        await flushEffects();

        const result = document.getElementById('uuid-validate-result');
        expect(result.querySelectorAll('.c-stat-row').length).toBeGreaterThanOrEqual(3);
        expect(result.textContent).toContain('7 (time-ordered)');
        expect(result.textContent).toContain('2026-11-24T15:21:38.000Z');
        expect(result.textContent).toContain('4 (random)');
        expect(result.textContent).toContain('1795533698000 ms');
    });

    it('reports nil and max UUIDs', async () => {
        await flushEffects();
        fireEvent.input(document.getElementById('uuid-validate-input'), {
            target: { value: '00000000-0000-0000-0000-000000000000\nffffffff-ffff-ffff-ffff-ffffffffffff' }
        });
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-validate'));
        await flushEffects();

        const result = document.getElementById('uuid-validate-result');
        expect(result.querySelectorAll('.c-status-chip').length).toBe(2);
        expect(result.textContent).toContain('Nil UUID');
        expect(result.textContent).toContain('Max UUID');
        expect(result.textContent).toContain('Variant NCS');
        expect(result.textContent).toContain('Variant Reserved');
    });

    it('clears the validator from the clear button', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-load-sample'));
        await flushEffects();

        const validateInput = document.getElementById('uuid-validate-input');
        validateInput.dispatchEvent(new Event('textCleared'));
        await flushEffects();
        expect(validateInput.value).toBe('');
        expect(document.querySelector('.uuidg-result')).toBeNull();
        expect(NotificationManager.show).toHaveBeenCalledWith('Input cleared', 2000, { type: 'success' });
        expect(clearButtonInstances.at(-1).updateVisibility).toHaveBeenCalled();
    });

    it('runs Generate from the primary shortcut', async () => {
        await flushEffects();
        fireEvent.input(document.getElementById('uuid-count'), { target: { value: '2' } });
        await flushEffects();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
        await waitFor(() => expect(generatedLines()).toHaveLength(2));
        generatedLines().forEach((line) => {
            expect(parseUuid(line).version).toBe(4);
        });
    });

    it('uses the prerendered root fallback and throws when no root exists', async () => {
        document.body.innerHTML = '<div id="uuid-generator-tool"><span id="stale-prerender"></span></div>';
        new UuidGeneratorToolUI('#missing-root');
        await flushEffects();
        expect(document.getElementById('uuid-generator-tool').querySelector('#uuid-generate')).not.toBeNull();

        const toolRoot = document.getElementById('uuid-generator-tool');
        preactRender(null, toolRoot);
        document.body.innerHTML = '';
        expect(() => new UuidGeneratorToolUI()).toThrow('UUID Generator root element not found');
    });

    it('bootstraps the shell on DOMContentLoaded', async () => {
        document.body.innerHTML = `
          <div id="app-shell-header"></div>
          <div id="uuid-generator-app"></div>
          <div id="app-shell-footer"></div>
        `;
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await flushEffects();

        expect(mountToolShell).toHaveBeenCalledWith(expect.objectContaining({
            title: 'UUID Generator',
            description: expect.stringContaining('Generate UUID v4 and v7 online')
        }));
        expect(document.getElementById('uuid-generate')).not.toBeNull();
    });

    it('disconnects the clear button on unmount', async () => {
        await flushEffects();
        expect(ClearButton).toHaveBeenCalled();

        preactRender(null, document.getElementById('uuid-generator-app'));
        await flushEffects();
        expect(clearButtonInstances.at(-1).disconnect).toHaveBeenCalled();
    });
});
