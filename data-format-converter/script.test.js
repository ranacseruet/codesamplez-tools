import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/dom';
import { render as preactRender } from 'preact';

const mockClearButtonInstances = [];
const mockCopyButtonInstances = [];
const SAMPLE_JSON_FRAGMENT = '"app": "codesamplez-tools"';
const SAMPLE_XML_FRAGMENT = '<app>codesamplez-tools</app>';
const SAMPLE_YAML_FRAGMENT = 'app: codesamplez-tools';
const SAMPLE_PROPERTIES_FRAGMENT = 'app=codesamplez-tools';

jest.mock('../common/clear-button/ClearButton', () => ({
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

jest.mock('../common/copy-button/CopyButton', () => ({
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

import { DataFormatConverterUI, getSelectedFormat } from './script';
import { DataFormatConverter } from './DataFormatConverter';
import { NotificationManager } from '../common/notification-manager';
import DownloadManager from '../common/DownloadManager';
import ClearButton from '../common/clear-button/ClearButton';
import CopyButton from '../common/copy-button/CopyButton';

// Mock the NotificationManager
jest.mock('../common/notification-manager', () => ({
    NotificationManager: {
        show: jest.fn()
    }
}));

// Mock DownloadManager
jest.mock('../common/DownloadManager', () => ({
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

    it('returns the active selected format from a format button group', () => {
        expect(getSelectedFormat('.input-section', 'properties')).toBe('json');
    });

    it('falls back when no active format button is available', () => {
        preactRender(null, document.getElementById('data-format-converter-app'));
        document.body.innerHTML = '<div class="input-section"></div>';

        expect(getSelectedFormat('.input-section', 'properties')).toBe('properties');
    });

    it('renders the shared article and faq content around the converter UI', () => {
        expect(document.body.textContent).toContain('About This Tool');
        expect(document.body.textContent).toContain('Data Format Converter Usage Example');
        expect(document.body.textContent).toContain('Data Format Converter FAQs');
        expect(document.querySelector('a[href="https://codesamplez.com/tools/"]')).not.toBeNull();
    });

    it('keeps sample mode disabled by default', () => {
        expect(document.getElementById('useSampleData')?.checked).toBe(false);
        expect(document.getElementById('inputText')?.value).toBe('');
        expect(document.getElementById('outputText')?.value).toBe('');
    });

    it('loads sample input and output immediately when sample mode is enabled', async () => {
        fireEvent.change(document.getElementById('useSampleData'), { target: { checked: true } });
        await flush();

        expect(document.getElementById('useSampleData')?.checked).toBe(true);
        expect(document.getElementById('inputText')?.value).toContain(SAMPLE_JSON_FRAGMENT);
        expect(document.getElementById('outputText')?.value).toContain(SAMPLE_XML_FRAGMENT);
    });

    it('replaces the input with matching sample data when input format changes in sample mode', async () => {
        fireEvent.change(document.getElementById('useSampleData'), { target: { checked: true } });
        await flush();

        fireEvent.click(document.querySelector('.input-section .format-btn[data-format="yaml"]'));
        await flush();

        expect(document.querySelector('.input-section .format-btn[data-format="yaml"]')?.getAttribute('aria-pressed')).toBe('true');
        expect(document.getElementById('inputText')?.value).toContain(SAMPLE_YAML_FRAGMENT);
        expect(document.getElementById('outputText')?.value).toContain(SAMPLE_XML_FRAGMENT);
    });

    it('reconverts sample output without replacing the current sample input on output format changes', async () => {
        fireEvent.change(document.getElementById('useSampleData'), { target: { checked: true } });
        await flush();

        const originalInput = document.getElementById('inputText')?.value;
        fireEvent.click(document.querySelector('.output-section .format-btn[data-format="yaml"]'));
        await flush();

        expect(document.getElementById('inputText')?.value).toBe(originalInput);
        expect(document.querySelector('.output-section .format-btn[data-format="yaml"]')?.getAttribute('aria-pressed')).toBe('true');
        expect(document.getElementById('outputText')?.value).toContain(SAMPLE_YAML_FRAGMENT);
    });

    it('clears input, output, and error state when sample mode is disabled', async () => {
        fireEvent.change(document.getElementById('useSampleData'), { target: { checked: true } });
        await flush();

        fireEvent.input(document.getElementById('inputText'), { target: { value: 'invalid' } });
        await flush();
        fireEvent.click(document.getElementById('convertBtn'));
        await flush();
        expect(document.getElementById('inputError')?.style.display).toBe('block');

        fireEvent.change(document.getElementById('useSampleData'), { target: { checked: false } });
        await flush();

        expect(document.getElementById('useSampleData')?.checked).toBe(false);
        expect(document.getElementById('inputText')?.value).toBe('');
        expect(document.getElementById('outputText')?.value).toBe('');
        expect(document.getElementById('inputError')?.style.display).toBe('none');
        expect(document.getElementById('inputError')?.textContent).toBe('');
    });

    it('restores sample data when sample mode is re-enabled after being cleared', async () => {
        fireEvent.change(document.getElementById('useSampleData'), { target: { checked: true } });
        await flush();
        fireEvent.change(document.getElementById('useSampleData'), { target: { checked: false } });
        await flush();

        fireEvent.change(document.getElementById('useSampleData'), { target: { checked: true } });
        await flush();

        expect(document.getElementById('inputText')?.value).toContain(SAMPLE_JSON_FRAGMENT);
        expect(document.getElementById('outputText')?.value).toContain(SAMPLE_XML_FRAGMENT);
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

    it('should report non-Error conversion failures with stringified message', async () => {
        const input = document.getElementById('inputText');
        fireEvent.input(input, { target: { value: '{"a":1}' } });
        await flush();

        ui.converter.parseInput.mockImplementation(() => {
            throw 'string-conversion-failure';
        });

        fireEvent.click(document.getElementById('convertBtn'));
        await flush();

        expect(NotificationManager.show).toHaveBeenCalledWith(
            'Conversion failed: string-conversion-failure',
            expect.any(Number),
            expect.any(Object)
        );
        expect(document.getElementById('inputError').textContent).toContain('Conversion failed: string-conversion-failure');
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

    it('clears debounce timers when the app is unmounted', async () => {
        const input = document.getElementById('inputText');
        const root = document.getElementById('data-format-converter-app');
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

        fireEvent.input(input, { target: { value: '{"queued":true}' } });
        await flush();

        preactRender(null, root);

        expect(clearTimeoutSpy).toHaveBeenCalled();
        clearTimeoutSpy.mockRestore();
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

    it('should load properties sample input when sample mode is enabled after selecting properties', async () => {
        fireEvent.click(document.querySelector('.input-section .format-btn[data-format="properties"]'));
        await flush();

        fireEvent.change(document.getElementById('useSampleData'), { target: { checked: true } });
        await flush();

        expect(document.getElementById('inputText')?.value).toContain(SAMPLE_PROPERTIES_FRAGMENT);
        expect(document.getElementById('outputText')?.value).toContain(SAMPLE_XML_FRAGMENT);
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
