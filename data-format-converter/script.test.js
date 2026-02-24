import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/dom';
import { render as preactRender } from 'preact';

const mockClearButtonInstances = [];
const mockCopyButtonInstances = [];

jest.mock('../common/clear-button/ClearButton.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
        const instance = {
            updateVisibility: jest.fn(),
            disconnect: jest.fn()
        };
        mockClearButtonInstances.push(instance);
        return instance;
    })
}));

jest.mock('../common/copy-button/CopyButton.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
        const instance = {
            updateVisibility: jest.fn(),
            disconnect: jest.fn()
        };
        mockCopyButtonInstances.push(instance);
        return instance;
    })
}));

import { DataFormatConverterUI } from './script.js';
import { NotificationManager } from '../common/notification-manager.js';
import DownloadManager from '../common/DownloadManager.js';
import ClearButton from '../common/clear-button/ClearButton.js';
import CopyButton from '../common/copy-button/CopyButton.js';

// Mock the NotificationManager
jest.mock('../common/notification-manager.js', () => ({
    NotificationManager: {
        show: jest.fn()
    }
}));

// Mock DownloadManager
jest.mock('../common/DownloadManager.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        downloadFile: jest.fn()
    }))
}));

describe('DataFormatConverterUI Integration', () => {
    let ui;
    const flush = () => Promise.resolve();

    beforeEach(async () => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockClearButtonInstances.length = 0;
        mockCopyButtonInstances.length = 0;

        // Setup DOM
        document.body.innerHTML = `
            <div id="data-format-converter-app"></div>
        `;

        Object.defineProperty(window.navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: jest.fn().mockResolvedValue(undefined)
            }
        });

        ui = new DataFormatConverterUI();
        await flush();
        await flush();

        // Mock converter methods to control behavior
        jest.spyOn(ui.converter, 'parseInput');
        jest.spyOn(ui.converter, 'formatOutput');
        jest.spyOn(ui.converter, 'detectFormat');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('initializes shared clear/copy overlay buttons for the textareas', () => {
        expect(ClearButton).toHaveBeenCalledWith(document.getElementById('inputText'));
        expect(CopyButton).toHaveBeenCalledWith(document.getElementById('outputText'));
        expect(mockClearButtonInstances).toHaveLength(1);
        expect(mockCopyButtonInstances).toHaveLength(1);
    });

    it('should initialize aria attributes', () => {
        const jsonBtn = document.querySelector('.input-section .format-btn[data-format="json"]');
        expect(jsonBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('should handle format selection click', async () => {
        fireEvent.click(document.querySelector('.input-section .format-btn[data-format="xml"]'));
        await flush();
        const xmlBtn = document.querySelector('.input-section .format-btn[data-format="xml"]');

        expect(xmlBtn.classList.contains('active')).toBe(true);
        expect(xmlBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('should handle convert button click', async () => {
        const input = document.getElementById('inputText');
        fireEvent.input(input, { target: { value: '{"a":1}' } });
        await flush();

        ui.converter.parseInput.mockReturnValue({a:1});
        ui.converter.formatOutput.mockReturnValue('<xml></xml>');

        fireEvent.click(document.getElementById('convertBtn'));
        await flush();

        expect(ui.converter.parseInput).toHaveBeenCalled();
        expect(document.getElementById('outputText').value).toBe('<xml></xml>');
    });

    it('should handle auto-convert input event', () => {
        const input = document.getElementById('inputText');
        fireEvent.input(input, { target: { value: '{"a":1}' } });

        ui.converter.parseInput.mockReturnValue({a:1});
        ui.converter.formatOutput.mockReturnValue('<xml></xml>');

        // Trigger input event
        fireEvent.input(input, { target: { value: '{"a":1}' } });

        jest.advanceTimersByTime(500);

        expect(ui.converter.parseInput).toHaveBeenCalled();
    });

    it('should skip auto-convert when debounced input is empty after trim', () => {
        const input = document.getElementById('inputText');

        fireEvent.input(input, { target: { value: '   ' } });
        jest.advanceTimersByTime(500);

        expect(ui.converter.detectFormat).not.toHaveBeenCalled();
        expect(ui.converter.parseInput).not.toHaveBeenCalled();
    });

    it('should handle swap button click', async () => {
        const inputText = document.getElementById('inputText');
        const outputText = document.getElementById('outputText');

        fireEvent.input(inputText, { target: { value: 'in' } });
        await flush();
        ui.converter.parseInput.mockReturnValue('parsed');
        ui.converter.formatOutput.mockReturnValue('out');
        fireEvent.click(document.getElementById('convertBtn'));
        await flush();

        ui.converter.formatOutput.mockReturnValue('formatted');

        fireEvent.click(document.getElementById('swapBtn'));
        await flush();

        expect(inputText.value).toBe('out');
        expect(outputText.value).toBe('formatted');
        expect(document.querySelector('.input-section .format-btn[data-format="xml"]').getAttribute('aria-pressed')).toBe('true');
        expect(document.querySelector('.output-section .format-btn[data-format="json"]').getAttribute('aria-pressed')).toBe('true');
    });

    it('should handle download button click', async () => {
        const input = document.getElementById('inputText');
        fireEvent.input(input, { target: { value: '{"a":1}' } });
        await flush();
        ui.converter.parseInput.mockReturnValue({a:1});
        ui.converter.formatOutput.mockReturnValue('content');
        fireEvent.click(document.getElementById('convertBtn'));
        await flush();

        const mockDownloadFile = jest.fn();
        DownloadManager.mockImplementation(() => ({
            downloadFile: mockDownloadFile
        }));

        fireEvent.click(document.getElementById('downloadBtn'));
        await flush();

        expect(DownloadManager).toHaveBeenCalled();
        expect(mockDownloadFile).toHaveBeenCalledWith('content', 'data.xml', 'application/xml');
    });

    it('should handle clear and copy actions', async () => {
        const input = document.getElementById('inputText');
        fireEvent.input(input, { target: { value: '{"a":1}' } });
        await flush();
        fireEvent.click(document.getElementById('clearInputBtn'));
        await flush();
        expect(NotificationManager.show).toHaveBeenCalledWith("Input cleared", expect.any(Number), expect.any(Object));

        ui.converter.parseInput.mockReturnValue({a:1});
        ui.converter.formatOutput.mockReturnValue('<xml></xml>');
        fireEvent.input(input, { target: { value: '{"a":1}' } });
        await flush();
        fireEvent.click(document.getElementById('convertBtn'));
        await flush();

        NotificationManager.show.mockClear();
        fireEvent.click(document.getElementById('copyOutputBtn'));
        await flush();
        await flush();

        expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith('<xml></xml>');
        expect(NotificationManager.show).toHaveBeenCalledWith("Copied to clipboard!", expect.any(Number), expect.any(Object));
    });

    it('should react to shared overlay custom events', async () => {
        const input = document.getElementById('inputText');
        const output = document.getElementById('outputText');
        const errorDiv = document.getElementById('inputError');

        fireEvent.click(document.getElementById('convertBtn'));
        await flush();
        expect(errorDiv.style.display).toBe('block');

        NotificationManager.show.mockClear();
        input.value = '';
        input.dispatchEvent(new CustomEvent('textCleared', { bubbles: true }));
        await flush();

        expect(errorDiv.style.display).toBe('none');
        expect(NotificationManager.show).toHaveBeenCalledWith('Input cleared', expect.any(Number), expect.any(Object));

        NotificationManager.show.mockClear();
        fireEvent.click(document.getElementById('downloadBtn'));
        await flush();
        expect(errorDiv.style.display).toBe('block');

        output.dispatchEvent(new CustomEvent('contentCopied', { bubbles: true }));
        await flush();

        expect(errorDiv.style.display).toBe('none');
        expect(NotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', expect.any(Number), expect.any(Object));
    });

    it('should use execCommand clipboard fallback when Clipboard API is unavailable', async () => {
        const input = document.getElementById('inputText');
        fireEvent.input(input, { target: { value: '{"a":1}' } });
        await flush();
        ui.converter.parseInput.mockReturnValue({ a: 1 });
        ui.converter.formatOutput.mockReturnValue('<xml></xml>');
        fireEvent.click(document.getElementById('convertBtn'));
        await flush();

        Object.defineProperty(window.navigator, 'clipboard', {
            configurable: true,
            value: undefined
        });
        document.execCommand = jest.fn().mockReturnValue(true);

        NotificationManager.show.mockClear();
        fireEvent.click(document.getElementById('copyOutputBtn'));
        await flush();

        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect(NotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', expect.any(Number), expect.any(Object));
    });

    it('should show error when clipboard fallback fails', async () => {
        const input = document.getElementById('inputText');
        fireEvent.input(input, { target: { value: '{"a":1}' } });
        await flush();
        ui.converter.parseInput.mockReturnValue({ a: 1 });
        ui.converter.formatOutput.mockReturnValue('<xml></xml>');
        fireEvent.click(document.getElementById('convertBtn'));
        await flush();

        Object.defineProperty(window.navigator, 'clipboard', {
            configurable: true,
            value: undefined
        });
        document.execCommand = jest.fn().mockReturnValue(false);

        NotificationManager.show.mockClear();
        fireEvent.click(document.getElementById('copyOutputBtn'));
        await flush();

        expect(NotificationManager.show).toHaveBeenCalledWith('Failed to copy output', expect.any(Number), expect.any(Object));
    });

    it('should show error when copy is requested with empty output', async () => {
        fireEvent.click(document.getElementById('copyOutputBtn'));
        await flush();

        expect(NotificationManager.show).toHaveBeenCalledWith('No output to copy', expect.any(Number), expect.any(Object));
    });

    it('should not auto-convert if checkbox unchecked', async () => {
        const autoConvert = document.getElementById('autoConvert');
        fireEvent.change(autoConvert, { target: { checked: false } });
        await flush();
        expect(autoConvert.checked).toBe(false);

        const input = document.getElementById('inputText');
        fireEvent.input(input, { target: { value: 'data' } });
        await flush();
        jest.advanceTimersByTime(500);
        expect(ui.converter.parseInput).not.toHaveBeenCalled();
    });

    it('should handle format selection with empty input', () => {
        const input = document.getElementById('inputText');
        fireEvent.input(input, { target: { value: '' } });
        fireEvent.click(document.querySelector('.output-section .format-btn[data-format="json"]'));
        // convertData is not called
        expect(ui.converter.parseInput).not.toHaveBeenCalled();
    });

    it('should handle output format selection with populated input', async () => {
        const input = document.getElementById('inputText');
        fireEvent.input(input, { target: { value: '{"a":1}' } });
        await flush();
        ui.converter.parseInput.mockReturnValue({a:1});
        ui.converter.formatOutput.mockReturnValue('{\n  "a": 1\n}');

        fireEvent.click(document.querySelector('.output-section .format-btn[data-format="json"]'));
        await flush();

        expect(ui.converter.parseInput).toHaveBeenCalled();
        expect(document.getElementById('outputText').value).toBe('{\n  "a": 1\n}');
    });

    it('should auto-detect and switch input format during auto-convert', async () => {
        const input = document.getElementById('inputText');
        ui.converter.detectFormat.mockReturnValue('yaml');
        ui.converter.parseInput.mockReturnValue({ name: 'alex' });
        ui.converter.formatOutput.mockReturnValue('<name>alex</name>');

        fireEvent.input(input, { target: { value: 'name: alex' } });
        jest.advanceTimersByTime(500);
        await flush();

        const detectedInputButton = document.querySelector('.input-section .format-btn[data-format="yaml"]');
        expect(detectedInputButton.classList.contains('active')).toBe(true);
    });

    it('should clear previous input when input format changes', async () => {
        const input = document.getElementById('inputText');
        fireEvent.input(input, { target: { value: '{"a":1}' } });
        await flush();

        NotificationManager.show.mockClear();
        fireEvent.click(document.querySelector('.input-section .format-btn[data-format="xml"]'));
        await flush();

        expect(document.getElementById('inputText').value).toBe('');
        expect(NotificationManager.show).toHaveBeenCalledWith('Input cleared', expect.any(Number), expect.any(Object));
    });

    it('should show error on convert with empty input', () => {
        const input = document.getElementById('inputText');
        fireEvent.input(input, { target: { value: '' } });
        fireEvent.click(document.getElementById('convertBtn'));
        expect(NotificationManager.show).toHaveBeenCalledWith(expect.stringContaining('Please enter some data'), expect.any(Number), expect.any(Object));
    });

    it('should handle conversion error', async () => {
        const input = document.getElementById('inputText');
        fireEvent.input(input, { target: { value: 'invalid' } });
        await flush();
        ui.converter.parseInput.mockImplementation(() => { throw new Error('Parse error'); });

        fireEvent.click(document.getElementById('convertBtn'));
        await flush();

        const errorDiv = document.getElementById('inputError');
        expect(errorDiv.style.display).toBe('block');
        expect(errorDiv.textContent).toContain('Parse error');
    });

    it('should attempt conversion when auto-convert is toggled back on', async () => {
        const autoConvert = document.getElementById('autoConvert');
        const input = document.getElementById('inputText');

        fireEvent.change(autoConvert, { target: { checked: false } });
        await flush();

        fireEvent.input(input, { target: { value: '{"a":1}' } });
        await flush();

        ui.converter.parseInput.mockReturnValue({ a: 1 });
        ui.converter.formatOutput.mockReturnValue('<xml></xml>');

        fireEvent.change(autoConvert, { target: { checked: true } });
        await flush();

        expect(ui.converter.parseInput).toHaveBeenCalled();
    });

    it('should unmount cleanly and clear debounce timer on teardown', () => {
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
        const input = document.getElementById('inputText');

        fireEvent.input(input, { target: { value: '{"a":1}' } });
        preactRender(null, document.getElementById('data-format-converter-app'));

        expect(clearTimeoutSpy).toHaveBeenCalled();
        expect(mockClearButtonInstances.at(-1)?.disconnect).toHaveBeenCalled();
        expect(mockCopyButtonInstances.at(-1)?.disconnect).toHaveBeenCalled();
    });

    it('should show error on download with empty output', () => {
        fireEvent.click(document.getElementById('downloadBtn'));
        expect(NotificationManager.show).toHaveBeenCalledWith('No data to download', expect.any(Number), expect.any(Object));
    });

    it('should throw if no mount root is available', () => {
        document.body.innerHTML = '';
        expect(() => new DataFormatConverterUI('#missing-root')).toThrow('Data Format Converter root element not found');
    });

    it('should fallback to .tool-container when explicit root selector is missing', () => {
        document.body.innerHTML = '<div class="tool-container"></div>';

        expect(() => new DataFormatConverterUI('#missing-root')).not.toThrow();
        expect(document.getElementById('convertBtn')).not.toBeNull();
    });

    it('should bootstrap shell and app on DOMContentLoaded', async () => {
        document.body.innerHTML = `
            <div id="app-shell-header"></div>
            <div id="data-format-converter-app"></div>
            <div id="app-shell-footer"></div>
        `;

        document.dispatchEvent(new Event('DOMContentLoaded'));
        await flush();

        expect(document.querySelector('.cst-shell__title')?.textContent).toBe('Data Format Converter');
        expect(document.querySelector('.cst-shell__footer-link')?.textContent).toBe('All Tools');
        expect(document.getElementById('convertBtn')).not.toBeNull();
    });
});
