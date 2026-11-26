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

jest.mock('../common/DownloadManager', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        downloadFile: jest.fn()
    }))
}));

import { NotificationManager } from '../common/notification-manager';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import ClearButton from '../common/clear-button/ClearButton';
import CopyButton from '../common/copy-button/CopyButton';
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

describe('UUID Generator runtime', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearButtonInstances.length = 0;
        copyButtonInstances.length = 0;
        mount();
    });

    afterEach(() => {
        const root = document.getElementById('uuid-generator-app');
        if (root) {
            preactRender(null, root);
        }
        document.body.innerHTML = '';
    });

    it('renders version 4, count 1, and an empty output', async () => {
        await flushEffects();

        expect(document.getElementById('uuid-version-v4').checked).toBe(true);
        expect(document.getElementById('uuid-version-v7').checked).toBe(false);
        expect(document.getElementById('uuid-count').value).toBe('1');
        expect(document.getElementById('uuid-uppercase').checked).toBe(false);
        expect(document.getElementById('uuid-no-hyphens').checked).toBe(false);
        expect(document.getElementById('uuid-output').value).toBe('');
        expect(document.getElementById('uuid-download').disabled).toBe(true);
        expect(document.getElementById('uuid-generate').textContent).toContain('Generate');
    });

    it('generates a version 4 UUID and downloads it under a fixed filename', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-generate'));
        await flushEffects();

        const output = document.getElementById('uuid-output').value;
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

    it('applies uppercase and no-hyphen formatting to a version 7 batch', async () => {
        await flushEffects();
        fireEvent.change(document.getElementById('uuid-version-v7'));
        fireEvent.input(document.getElementById('uuid-count'), { target: { value: '2' } });
        fireEvent.change(document.getElementById('uuid-uppercase'), { target: { checked: true } });
        fireEvent.change(document.getElementById('uuid-no-hyphens'), { target: { checked: true } });
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-generate'));
        await flushEffects();

        const lines = document.getElementById('uuid-output').value.split('\n');
        expect(lines).toHaveLength(2);
        lines.forEach((line) => {
            expect(line).toBe(line.toUpperCase());
            expect(line).not.toContain('-');
            const parsed = parseUuid(line);
            expect(parsed.valid && parsed.version).toBe(7);
            expect(parsed.timestampIso).toEqual(expect.any(String));
        });
        expect(NotificationManager.show).toHaveBeenCalledWith('Generated 2 UUIDs', 2000, { type: 'success' });

        fireEvent.change(document.getElementById('uuid-version-v4'));
        fireEvent.input(document.getElementById('uuid-count'), { target: { value: '1' } });
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-generate'));
        await flushEffects();
        expect(parseUuid(document.getElementById('uuid-output').value).version).toBe(4);
    });

    it('rejects a count outside 1 to 100 and does not download an empty list', async () => {
        await flushEffects();
        fireEvent.input(document.getElementById('uuid-count'), { target: { value: '101' } });
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-generate'));
        await flushEffects();

        expect(document.getElementById('uuid-generate-error').textContent).toContain('1 to 100');
        expect(document.getElementById('uuid-output').value).toBe('');
        expect(document.getElementById('uuid-count').getAttribute('aria-invalid')).toBe('true');

        fireEvent.click(document.getElementById('uuid-download'));
        expect(DownloadManager).not.toHaveBeenCalled();
    });

    it('validates a pasted UUID and a line that is not one', async () => {
        await flushEffects();
        const input = document.getElementById('uuid-validate-input');
        fireEvent.input(input, { target: { value: `${WORKED_EXAMPLE_V4}\nnot-a-uuid` } });
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-validate'));
        await flushEffects();

        const result = document.getElementById('uuid-validate-result').textContent;
        expect(result).toContain('Valid');
        expect(result).toContain(WORKED_EXAMPLE_V4);
        expect(result).toContain('Version 4 (random)');
        expect(result).toContain('Variant RFC 4122');
        expect(result).toContain('Not a UUID.');
    });

    it('does not validate an empty paste', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-validate'));
        await flushEffects();
        expect(document.getElementById('uuid-validate-error').textContent).toBe('Paste a UUID to validate.');
        expect(document.querySelector('.uuidg-result')).toBeNull();
    });

    it('loads the worked examples into the validator', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-load-sample'));
        await flushEffects();

        const result = document.getElementById('uuid-validate-result').textContent;
        expect(result).toContain('7 (time-ordered)');
        expect(result).toContain('2026-11-24T15:21:38.000Z');
        expect(result).toContain('4 (random)');
        expect(result).toContain('1795533698000 ms');
    });

    it('reports nil and max UUIDs', async () => {
        await flushEffects();
        fireEvent.input(document.getElementById('uuid-validate-input'), {
            target: { value: '00000000-0000-0000-0000-000000000000\nffffffff-ffff-ffff-ffff-ffffffffffff' }
        });
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-validate'));
        await flushEffects();

        const result = document.getElementById('uuid-validate-result').textContent;
        expect(result).toContain('Nil UUID');
        expect(result).toContain('Max UUID');
        expect(result).toContain('Variant NCS');
        expect(result).toContain('Variant Reserved');
    });

    it('clears the validator from the clear button and copies from the output button', async () => {
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-load-sample'));
        await flushEffects();

        const validateInput = document.getElementById('uuid-validate-input');
        validateInput.dispatchEvent(new Event('textCleared'));
        await flushEffects();
        expect(validateInput.value).toBe('');
        expect(document.querySelector('.uuidg-result')).toBeNull();
        expect(NotificationManager.show).toHaveBeenCalledWith('Input cleared', 2000, { type: 'success' });

        fireEvent.click(document.getElementById('uuid-generate'));
        await flushEffects();
        document.getElementById('uuid-output').dispatchEvent(new Event('contentCopied'));
        expect(NotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', 2000, { type: 'success' });
        expect(copyButtonInstances.at(-1).updateVisibility).toHaveBeenCalled();
        expect(clearButtonInstances.at(-1).updateVisibility).toHaveBeenCalled();
    });

    it('runs Generate from the primary shortcut', async () => {
        await flushEffects();
        await flushEffects();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
        await waitFor(() => expect(document.getElementById('uuid-output').value).not.toBe(''));
        expect(parseUuid(document.getElementById('uuid-output').value).version).toBe(4);
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

    it('disconnects the clear and copy buttons on unmount', async () => {
        await flushEffects();
        expect(ClearButton).toHaveBeenCalled();
        expect(CopyButton).toHaveBeenCalled();

        preactRender(null, document.getElementById('uuid-generator-app'));
        await flushEffects();
        expect(clearButtonInstances.at(-1).disconnect).toHaveBeenCalled();
        expect(copyButtonInstances.at(-1).disconnect).toHaveBeenCalled();
    });
});
