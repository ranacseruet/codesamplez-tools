import { jest } from '@jest/globals';
import { DataFormatConverter } from './DataFormatConverter.js';
import { DataFormatConverterUI } from './script.js';
import { NotificationManager } from '../common/notification-manager.js';
import DownloadManager from '../common/DownloadManager.js';

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

// We can keep ClearButton/CopyButton mocks or let them run if they don't cause issues.
// They assume specific DOM structure which we will provide.
// But they are imported in script.js.
// To ensure coverage of script.js callbacks, we rely on script.js logic.
// We can mock them to simplify.
jest.mock('../common/clear-button/ClearButton.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        clearText: jest.fn(),
        updateVisibility: jest.fn()
    }))
}));

jest.mock('../common/copy-button/CopyButton.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        updateVisibility: jest.fn()
    }))
}));

describe('DataFormatConverterUI Integration', () => {
    let ui;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();

        // Setup DOM
        document.body.innerHTML = `
            <div class="tool-container">
                <div class="input-section">
                    <button class="format-btn active" data-format="json">JSON</button>
                    <button class="format-btn" data-format="xml">XML</button>
                </div>
                <div class="output-section">
                    <button class="format-btn" data-format="json">JSON</button>
                    <button class="format-btn active" data-format="xml">XML</button>
                </div>
                <textarea id="inputText"></textarea>
                <textarea id="outputText"></textarea>
                <div id="inputError" style="display: none;"></div>
                <input type="checkbox" id="autoConvert" checked>
                <button id="convertBtn">Convert</button>
                <button id="downloadBtn">Download</button>
                <button id="swapBtn">Swap</button>
            </div>
        `;

        ui = new DataFormatConverterUI();

        // Mock converter methods to control behavior
        // We can spy on the instance created
        jest.spyOn(ui.converter, 'parseInput');
        jest.spyOn(ui.converter, 'formatOutput');
        jest.spyOn(ui.converter, 'detectFormat');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('should initialize aria attributes', () => {
        const jsonBtn = document.querySelector('.input-section .format-btn[data-format="json"]');
        expect(jsonBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('should handle format selection click', () => {
        const xmlBtn = document.querySelector('.input-section .format-btn[data-format="xml"]');
        xmlBtn.click();

        expect(xmlBtn.classList.contains('active')).toBe(true);
        expect(xmlBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('should handle convert button click', () => {
        document.getElementById('inputText').value = '{"a":1}';

        ui.converter.parseInput.mockReturnValue({a:1});
        ui.converter.formatOutput.mockReturnValue('<xml></xml>');

        document.getElementById('convertBtn').click();

        expect(ui.converter.parseInput).toHaveBeenCalled();
        expect(document.getElementById('outputText').value).toBe('<xml></xml>');
    });

    it('should handle auto-convert input event', () => {
        document.getElementById('inputText').value = '{"a":1}';

        ui.converter.parseInput.mockReturnValue({a:1});
        ui.converter.formatOutput.mockReturnValue('<xml></xml>');

        // Trigger input event
        document.getElementById('inputText').dispatchEvent(new Event('input'));

        jest.advanceTimersByTime(500);

        expect(ui.converter.parseInput).toHaveBeenCalled();
    });

    it('should handle swap button click', () => {
        const inputText = document.getElementById('inputText');
        const outputText = document.getElementById('outputText');

        inputText.value = 'in';
        outputText.value = 'out';

        ui.converter.inputFormat = 'json';
        ui.converter.outputFormat = 'xml';

        ui.converter.parseInput.mockReturnValue('parsed');
        ui.converter.formatOutput.mockReturnValue('formatted');

        document.getElementById('swapBtn').click();

        expect(inputText.value).toBe('out');
        expect(outputText.value).toBe('formatted');
        expect(ui.converter.inputFormat).toBe('xml');
        expect(ui.converter.outputFormat).toBe('json');
    });

    it('should handle download button click', () => {
        document.getElementById('outputText').value = 'content';

        const mockDownloadFile = jest.fn();
        DownloadManager.mockImplementation(() => ({
            downloadFile: mockDownloadFile
        }));

        document.getElementById('downloadBtn').click();

        expect(DownloadManager).toHaveBeenCalled();
        expect(mockDownloadFile).toHaveBeenCalledWith('content', 'data.xml', 'application/xml');
    });

    // New tests for 100% coverage
    it('should handle events from custom buttons', () => {
        document.getElementById('inputText').dispatchEvent(new Event('textCleared'));
        expect(NotificationManager.show).toHaveBeenCalledWith("Input cleared", expect.any(Number), expect.any(Object));

        document.getElementById('outputText').dispatchEvent(new Event('contentCopied'));
        expect(NotificationManager.show).toHaveBeenCalledWith("Copied to clipboard!", expect.any(Number), expect.any(Object));
    });

    it('should not auto-convert if checkbox unchecked', () => {
        document.getElementById('autoConvert').checked = false;
        document.getElementById('inputText').value = 'data';
        document.getElementById('inputText').dispatchEvent(new Event('input'));
        jest.advanceTimersByTime(500);
        expect(ui.converter.parseInput).not.toHaveBeenCalled();
    });

    it('should handle format selection with empty input', () => {
        document.getElementById('inputText').value = '';
        const btn = document.querySelector('.output-section .format-btn[data-format="json"]');
        btn.click();
        // convertData is not called
        expect(ui.converter.parseInput).not.toHaveBeenCalled();
    });

    it('should handle output format selection with populated input', () => {
        document.getElementById('inputText').value = '{"a":1}';
        ui.converter.parseInput.mockReturnValue({a:1});
        ui.converter.formatOutput.mockReturnValue('<xml></xml>');

        const btn = document.querySelector('.output-section .format-btn[data-format="xml"]');
        btn.click();

        expect(ui.converter.parseInput).toHaveBeenCalled();
        expect(document.getElementById('outputText').value).toBe('<xml></xml>');
    });

    it('should show error on convert with empty input', () => {
        document.getElementById('inputText').value = '';
        document.getElementById('convertBtn').click();
        expect(NotificationManager.show).toHaveBeenCalledWith(expect.stringContaining('Please enter some data'), expect.any(Number), expect.any(Object));
    });

    it('should handle conversion error', () => {
        document.getElementById('inputText').value = 'invalid';
        ui.converter.parseInput.mockImplementation(() => { throw new Error('Parse error'); });

        document.getElementById('convertBtn').click();

        const errorDiv = document.getElementById('inputError');
        expect(errorDiv.style.display).toBe('block');
        expect(errorDiv.textContent).toContain('Parse error');
    });

    it('should show error on download with empty output', () => {
        document.getElementById('outputText').value = '';
        document.getElementById('downloadBtn').click();
        expect(NotificationManager.show).toHaveBeenCalledWith('No data to download', expect.any(Number), expect.any(Object));
    });
});
