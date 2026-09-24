import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import Base64Codec from '../common/Base64Codec';
import DownloadManager from '../common/DownloadManager';
import CopyButton from '../common/copy-button/CopyButton';
import { waitFor } from '@testing-library/dom';
import { fireFileDragEvent } from '../common/drop-zone-test-utils';

const IMAGE_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

jest.mock('../common/notification-manager', () => ({
    NotificationManager: {
        show: jest.fn(),
    },
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
    mountToolShell: jest.fn()
}));

// Mock DownloadManager
jest.mock('../common/DownloadManager', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => {
            return {
                downloadFile: jest.fn(),
            };
        }),
    };
});

// Mock CopyButton
jest.mock('../common/copy-button/CopyButton', () => {
    return jest.fn().mockImplementation(() => {
        return {
            copyContent: jest.fn(),
            updateVisibility: jest.fn(),
            forceUpdateVisibility: jest.fn(),
            isDisabled: jest.fn().mockReturnValue(false),
            wrapper: { hidden: false },
            disconnect: jest.fn()
        };
    });
});

import { NotificationManager } from '../common/notification-manager';
import './script';

const BASE_DOM_HTML = `
    <div id="notification"></div>
    <input type="file" id="base64converter-file" />
    <textarea id="base64converter-input"></textarea>
    <select id="base64converter-mode">
        <option value="auto" selected>Auto</option>
        <option value="encode">Encode</option>
        <option value="decode">Decode</option>
    </select>
    <select id="base64converter-encoding">
        <option value="UTF-8" selected>UTF-8</option>
        <option value="UTF-16">UTF-16</option>
    </select>
    <div id="base64converter-result"></div>
    <img id="base64converter-image-preview" alt="Decoded image preview" hidden />
    <span id="base64converter-status"></span>
    <span id="base64converter-copy-status"></span>
    <button id="base64converter-convert"></button>
    <button id="base64converter-load-sample"></button>
    <button id="base64converter-share"></button>
    <button id="base64converter-swap" disabled></button>
    <button id="base64converter-download-decoded" disabled></button>
`;

describe('Base64Converter UI (script.tsx)', () => {
    let converter;
    let elements;
    let mockFileReaderInstance;
    let mockClipboard;

    beforeEach(() => {
        document.body.innerHTML = BASE_DOM_HTML;

        // Mock FileReader
        mockFileReaderInstance = {
            readAsDataURL: jest.fn(),
            onload: null,
            onerror: null,
            result: null,
            error: null
        };
        global.FileReader = jest.fn(() => mockFileReaderInstance);

        // Mock clipboard
        mockClipboard = {
            writeText: jest.fn().mockResolvedValue(undefined)
        };
        Object.defineProperty(global.navigator, 'clipboard', {
            value: mockClipboard,
            writable: true,
            configurable: true
        });

        document.dispatchEvent(new Event('DOMContentLoaded'));

        converter = window.base64ConverterInstance;
        elements = converter.elements;
    });

    afterEach(() => {
        jest.clearAllMocks();
        NotificationManager.show.mockClear();
        if (global.navigator.clipboard) {
            global.navigator.clipboard.writeText.mockReset();
        }
    });

    describe('Core Functionality', () => {
        test('should initialize with all required elements', () => {
            expect(converter.elements.input).toBeDefined();
            expect(converter.elements.result).toBeDefined();
            expect(converter.elements.preview).toBeDefined();
            expect(converter.elements.swapButton).toBeDefined();
            expect(converter.elements.downloadDecodedButton).toBeDefined();
        });


        test('should encode text in encode mode with UTF-8', () => {
            elements.input.value = 'Hello World';
            elements.mode.value = 'encode';
            elements.encoding.value = 'UTF-8';
            converter.processInput();
            
            expect(elements.result.textContent).toBe('SGVsbG8gV29ybGQ=');
        });

        test('should encode text in encode mode with UTF-16', () => {
            elements.input.value = 'Hello';
            elements.mode.value = 'encode';
            elements.encoding.value = 'UTF-16';
            converter.processInput();
            
            expect(elements.result.textContent).toBe('SABlAGwAbABvAA==');
        });

        test('should support ASCII and ISO-8859-1 encoding aliases plus empty fallback', () => {
            elements.mode.value = 'encode';

            elements.input.value = 'Hello';
            elements.encoding.innerHTML = `
              <option value="ASCII">ASCII</option>
              <option value="ISO-8859-1">ISO-8859-1</option>
              <option value="">(empty)</option>
            `;

            elements.encoding.value = 'ASCII';
            converter.processInput();
            expect(elements.result.textContent).toBe('SGVsbG8=');

            elements.input.value = 'Hé';
            elements.encoding.value = 'ISO-8859-1';
            converter.processInput();
            expect(elements.result.textContent).toBe('SOk=');

            elements.input.value = 'Hi';
            elements.encoding.value = '';
            converter.processInput();
            expect(elements.result.textContent).toBe('SGk=');
        });

        test('should decode text in decode mode', () => {
            elements.input.value = 'SGVsbG8gV29ybGQ=';
            elements.mode.value = 'decode';
            converter.processInput();
            
            expect(elements.result.textContent).toBe('Hello World');
            expect(elements.downloadDecodedButton.disabled).toBe(false);
        });

        test('should exchange panels and toggle from encode to decode', () => {
            elements.input.value = 'Hello World';
            elements.mode.value = 'encode';
            converter.processInput();

            elements.swapButton.click();

            expect(elements.input.value).toBe('SGVsbG8gV29ybGQ=');
            expect(elements.result.textContent).toBe('Hello World');
            expect(elements.mode.value).toBe('decode');
            expect(elements.swapButton.disabled).toBe(false);
        });

        test('should exchange panels and toggle from decode to encode', () => {
            elements.input.value = 'SGVsbG8gV29ybGQ=';
            elements.mode.value = 'decode';
            converter.processInput();

            elements.swapButton.click();

            expect(elements.input.value).toBe('Hello World');
            expect(elements.result.textContent).toBe('SGVsbG8gV29ybGQ=');
            expect(elements.mode.value).toBe('encode');
            expect(elements.swapButton.disabled).toBe(false);
        });

        test('should choose the opposite last direction when swapping in auto mode', () => {
            elements.input.value = 'Hello World';
            elements.mode.value = 'auto';
            converter.processInput();

            elements.swapButton.click();

            expect(elements.mode.value).toBe('decode');
            expect(elements.input.value).toBe('SGVsbG8gV29ybGQ=');
            expect(elements.result.textContent).toBe('Hello World');

            elements.input.value = 'SGVsbG8gV29ybGQ=';
            elements.mode.value = 'auto';
            converter.processInput();
            elements.swapButton.click();

            expect(elements.mode.value).toBe('encode');
            expect(elements.input.value).toBe('Hello World');
            expect(elements.result.textContent).toBe('SGVsbG8gV29ybGQ=');
        });

        test('should keep Swap disabled until text output is available', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            expect(elements.swapButton.disabled).toBe(true);

            converter.outputKind = 'text';
            elements.swapButton.disabled = false;
            elements.swapButton.click();
            expect(elements.swapButton.disabled).toBe(true);

            elements.input.value = 'Not base64!';
            elements.mode.value = 'decode';
            converter.processInput();
            expect(elements.swapButton.disabled).toBe(true);

            elements.input.value = 'data:application/pdf;base64,SGVsbG8=';
            elements.mode.value = 'decode';
            converter.processInput();
            expect(elements.swapButton.disabled).toBe(true);

            elements.input.value = IMAGE_DATA_URI;
            elements.mode.value = 'decode';
            converter.processInput();
            expect(elements.swapButton.disabled).toBe(true);
            consoleErrorSpy.mockRestore();
        });

        test('should not swap when input is a file upload placeholder', () => {
            elements.input.value = '[File: sample.txt uploaded and encoded to output]';
            converter.outputKind = 'text';
            elements.result.textContent = 'Decoded Content';
            elements.swapButton.disabled = false;

            elements.swapButton.click();

            expect(elements.input.value).toBe('[File: sample.txt uploaded and encoded to output]');
            expect(elements.result.textContent).toBe('Decoded Content');
        });

        test('should auto-detect and encode plain text', () => {
            elements.input.value = 'Auto Encode Test';
            elements.mode.value = 'auto';
            converter.processInput();
            
            expect(elements.result.textContent).toBe('QXV0byBFbmNvZGUgVGVzdA==');
        });

        test('should auto-detect and decode base64 text', () => {
            elements.input.value = 'QXV0byBEZWNvZGUgVGVzdA==';
            elements.mode.value = 'auto';
            converter.processInput();
            
            expect(elements.result.textContent).toBe('Auto Decode Test');
        });

        test('should handle empty input', () => {
            elements.input.value = '';
            converter.processInput();
            
            expect(elements.result.textContent).toBe('');
            expect(elements.status.textContent).toBe('');
        });

        test('should not process input if it is a file upload placeholder', () => {
            elements.input.value = '[File: test.txt uploaded and encoded to output]';
            elements.result.textContent = 'SGVsbG8gV29ybGQ=';
            converter.processInput();
            
            expect(elements.result.textContent).toBe('SGVsbG8gV29ybGQ='); // Should not change
            expect(elements.downloadDecodedButton.disabled).toBe(false);
        });

        test('should decode text with UTF-16 encoding', () => {
            // Base64 for "Hello" in UTF-16 (little-endian)
            elements.input.value = 'SABlAGwAbABvAA==';
            elements.mode.value = 'decode';
            elements.encoding.value = 'UTF-16';
            converter.processInput();
            
            expect(elements.result.textContent).toBe('Hello');
            expect(elements.downloadDecodedButton.disabled).toBe(false);
        });
    });

    describe('File Handling', () => {
        test('should process file upload and encode to base64', () => {
            const mockFile = new File(['Test content'], 'test.txt', { type: 'text/plain' });
            const mockDataURL = 'data:text/plain;base64,VGVzdCBjb250ZW50';
            
            const event = { target: { files: [mockFile] } };
            converter.handleFileUpload(event);

            mockFileReaderInstance.result = mockDataURL;
            mockFileReaderInstance.onload();
            
            expect(elements.result.textContent).toBe('VGVzdCBjb250ZW50');
            expect(elements.input.value).toContain('[File: test.txt uploaded');
            expect(elements.swapButton.disabled).toBe(true);
        });

        test('should allow a large binary file selected through the picker', () => {
            const mockFile = new File(['x'], 'large.bin', { type: 'application/octet-stream' });
            Object.defineProperty(mockFile, 'size', { configurable: true, value: 7 * 1024 * 1024 });
            Object.defineProperty(elements.fileInput, 'files', { configurable: true, value: [mockFile] });

            elements.fileInput.dispatchEvent(new Event('change', { bubbles: true }));

            expect(mockFileReaderInstance.readAsDataURL).toHaveBeenCalledWith(mockFile);
            expect(NotificationManager.show).not.toHaveBeenCalledWith(
                expect.stringContaining('too large'),
                3000,
                expect.objectContaining({ type: 'error' })
            );
        });

        test('should encode a file dropped on the input through the upload path', () => {
            const mockFile = new File(['Test content'], 'dropped.txt', { type: 'text/plain' });

            // Unlike the text tools, base64-converter takes the raw File: it is
            // the one tool that legitimately wants binary input.
            fireFileDragEvent(elements.input, 'drop', [mockFile]);

            mockFileReaderInstance.result = 'data:text/plain;base64,VGVzdCBjb250ZW50';
            mockFileReaderInstance.onload();

            expect(elements.result.textContent).toBe('VGVzdCBjb250ZW50');
            expect(elements.input.value).toContain('[File: dropped.txt uploaded');
        });

        test('should surface a rejected drop as an error toast', async () => {
            fireFileDragEvent(elements.input, 'drop', []);
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(NotificationManager.show).toHaveBeenCalledWith(
                expect.stringContaining('No file'),
                expect.any(Number),
                expect.objectContaining({ type: 'error' })
            );
        });

        test('should handle file read errors', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const mockFile = new File([''], 'error.txt');
            const mockError = new Error('Read error');
            
            const event = { target: { files: [mockFile] } };
            converter.handleFileUpload(event);

            mockFileReaderInstance.error = mockError;
            mockFileReaderInstance.onerror();
            
            expect(elements.result.textContent).toBe('');
            expect(elements.input.value).toBe('');
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Error reading file: ' + mockError.message,
                3000,
                { type: 'error' }
            );
            consoleErrorSpy.mockRestore();
        });

        test('should handle invalid Data URI format in file upload', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const mockFile = new File([''], 'invalid.txt');
            const mockDataURL = 'data:invalid-format';
            
            const event = { target: { files: [mockFile] } };
            converter.handleFileUpload(event);

            mockFileReaderInstance.result = mockDataURL;
            mockFileReaderInstance.onload();
            
            expect(elements.result.textContent).toBe('');
            expect(elements.input.value).toBe('');
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Error processing file: Invalid Data URI format',
                3000,
                { type: 'error' }
            );
            expect(elements.downloadDecodedButton.disabled).toBe(true);
            expect(consoleErrorSpy).toHaveBeenCalledWith('File processing error after read:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });

        test('should handle file upload when FileReader returns raw base64 (non-Data URI)', () => {
            const mockFile = new File(['Test'], 'raw.bin', { type: 'application/octet-stream' });
            const event = { target: { files: [mockFile], value: 'x' } };

            converter.handleFileUpload(event);

            mockFileReaderInstance.result = 'U29tZUJhc2U2NA==';
            mockFileReaderInstance.onload();

            expect(elements.input.value).toContain('[File: raw.bin uploaded');
            expect(elements.result.textContent).toBe('U29tZUJhc2U2NA==');
        });

        test('should handle non-string FileReader results during upload', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const mockFile = new File(['Test'], 'binary.bin', { type: 'application/octet-stream' });
            const event = { target: { files: [mockFile], value: 'x' } };
            converter.handleFileUpload(event);

            mockFileReaderInstance.result = { unexpected: true };
            mockFileReaderInstance.onload();

            expect(elements.result.textContent).toBe('');
            expect(elements.input.value).toBe('');
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Error processing file: Invalid file reader result',
                3000,
                { type: 'error' }
            );
            expect(consoleErrorSpy).toHaveBeenCalledWith('File processing error after read:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });

    describe('Share Links', () => {
        const flushShare = () => new Promise((resolve) => setTimeout(resolve, 0));

        test('should copy a #data= link carrying the current input', async () => {
            elements.input.value = 'Hello from CodeSamplez Tools!';

            document.getElementById('base64converter-share').click();
            await waitFor(() => expect(mockClipboard.writeText).toHaveBeenCalled());

            // Not a call-count assertion: this suite re-requires ./script and
            // re-dispatches DOMContentLoaded in every beforeEach, and the
            // document persists, so earlier bootstraps are still listening and
            // each one copies the same URL.
            expect(mockClipboard.writeText).toHaveBeenCalled();
            const url = mockClipboard.writeText.mock.calls[0][0];
            // Deliberately the legacy raw `data` format, not the LZ payload the
            // newer tools use — third-party links already point at this param.
            expect(url).toContain('#data=');
            expect(url.split('#')[0]).not.toContain('data=');
            const shared = new URLSearchParams(url.split('#')[1]).get('data');
            expect(shared).toBe('Hello from CodeSamplez Tools!');
        });

        test('should round-trip through the existing preload reader', async () => {
            elements.input.value = 'a+b/c=&d e';

            document.getElementById('base64converter-share').click();
            await flushShare();

            const url = mockClipboard.writeText.mock.calls[0][0];
            // What the preload path does with the value on the way back in.
            const raw = url.split('#data=')[1];
            expect(decodeURIComponent(raw)).toBe('a+b/c=&d e');
            expect(encodeURIComponent(decodeURIComponent(raw))).toBe(raw);
        });

        test('should refuse to share a payload that would exceed the URL ceiling', async () => {
            // Raw encodeURIComponent, no compression, so length maps directly.
            elements.input.value = 'a'.repeat(9000);

            document.getElementById('base64converter-share').click();
            await flushShare();

            expect(mockClipboard.writeText).not.toHaveBeenCalled();
            expect(NotificationManager.show).toHaveBeenCalledWith(
                expect.stringContaining('too large to share'),
                expect.any(Number),
                expect.objectContaining({ type: 'error' })
            );
        });

        test('should report a clipboard failure instead of claiming success', async () => {
            mockClipboard.writeText.mockRejectedValue(new Error('denied'));
            elements.input.value = 'shareable';

            document.getElementById('base64converter-share').click();
            await flushShare();

            expect(NotificationManager.show).toHaveBeenCalledWith(
                expect.stringContaining('Failed to copy share link'),
                expect.any(Number),
                expect.objectContaining({ type: 'error' })
            );
        });

        test('should refuse to share an empty input', async () => {
            elements.input.value = '   ';

            document.getElementById('base64converter-share').click();
            await flushShare();

            expect(mockClipboard.writeText).not.toHaveBeenCalled();
            expect(NotificationManager.show).toHaveBeenCalledWith(
                expect.stringContaining('before sharing'),
                expect.any(Number),
                expect.objectContaining({ type: 'error' })
            );
        });
    });

    describe('Error Handling', () => {
        let consoleErrorSpy;

        beforeEach(() => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        test('should show error for invalid base64 in decode mode', () => {
            elements.input.value = 'Not base64!';
            elements.mode.value = 'decode';
            converter.processInput();
            
            expect(elements.result.textContent).toBe('');
            expect(elements.status.textContent).toBe('Invalid base64 input');
            expect(elements.downloadDecodedButton.disabled).toBe(true);
        });

        test('should show error for invalid Data URI format', () => {
            elements.input.value = 'data:invalid-format';
            converter.processInput();
            
            expect(elements.result.textContent).toBe('');
            expect(elements.status.textContent).toBe('Invalid Data URI format');
            expect(elements.downloadDecodedButton.disabled).toBe(true);
        });

        test('should handle UTF-8 decode errors', () => {
            // Base64 string that will cause UTF-8 decode error
            elements.input.value = '77+9'; // Invalid UTF-8 sequence when decoded
            elements.mode.value = 'decode';
            elements.encoding.value = 'UTF-8';
            converter.processInput();
            
            expect(elements.result.textContent).toBe('');
            expect(elements.status.textContent).toContain('Invalid UTF-8 sequence');
            expect(elements.downloadDecodedButton.disabled).toBe(true);
        });

        test('should handle UCS-2 decode errors with specific message', () => {
            // Base64 string that will cause UCS-2 decode error
            elements.input.value = '77+9'; // Invalid UCS-2 sequence when decoded
            elements.mode.value = 'decode';
            elements.encoding.value = 'UTF-16';
            converter.processInput();
            
            expect(elements.result.textContent).toBe('');
            expect(elements.status.textContent).toBe('Invalid UCS-2 sequence - Input may be corrupted or not UCS-2 text.');
            expect(elements.downloadDecodedButton.disabled).toBe(true);
        });

        test('should map invalid data URI processing errors to a friendly message', () => {
            const RuntimeBase64Codec = require('../common/Base64Codec').default;
            const decodeSpy = jest
                .spyOn(RuntimeBase64Codec.prototype, 'decodeText')
                .mockImplementation(() => {
                    throw new Error('Invalid Data URI format while decoding');
                });

            elements.input.value = 'SGVsbG8=';
            elements.mode.value = 'decode';
            converter.processInput();

            // v4 contract: processing errors surface inline in the status chip.
            expect(elements.status.textContent).toBe('Invalid Data URI format.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Processing error:', expect.any(Error));
            decodeSpy.mockRestore();
        });

        test('should map empty-processing errors to a friendly message', () => {
            const RuntimeBase64Codec = require('../common/Base64Codec').default;
            const decodeSpy = jest
                .spyOn(RuntimeBase64Codec.prototype, 'decodeText')
                .mockImplementation(() => {
                    throw new Error('decoded input is empty');
                });

            elements.input.value = 'SGVsbG8=';
            elements.mode.value = 'decode';
            converter.processInput();

            expect(elements.status.textContent).toBe('Input cannot be empty.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Processing error:', expect.any(Error));
            decodeSpy.mockRestore();
        });

        test('should map unknown processing errors to a generic failure message', () => {
            const RuntimeBase64Codec = require('../common/Base64Codec').default;
            const decodeSpy = jest
                .spyOn(RuntimeBase64Codec.prototype, 'decodeText')
                .mockImplementation(() => {
                    throw new Error('unexpected decode failure');
                });

            elements.input.value = 'SGVsbG8=';
            elements.mode.value = 'decode';
            converter.processInput();

            expect(elements.status.textContent).toBe('Processing failed: unexpected decode failure');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Processing error:', expect.any(Error));
            decodeSpy.mockRestore();
        });

        test('should surface unexpected auto-detect decode errors', () => {
            const RuntimeBase64Codec = require('../common/Base64Codec').default;
            const decodeSpy = jest
                .spyOn(RuntimeBase64Codec.prototype, 'decodeText')
                .mockImplementation(() => {
                    throw new Error('unexpected auto decode failure');
                });

            elements.input.value = 'SGVsbG8=';
            elements.mode.value = 'auto';
            converter.processInput();

            expect(elements.result.textContent).toBe('');
            expect(elements.status.textContent).toBe('Processing failed: unexpected auto decode failure');
            expect(elements.downloadDecodedButton.disabled).toBe(true);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Processing error:', expect.any(Error));
            decodeSpy.mockRestore();
        });

    });

    describe('Download Functionality', () => {
        test('should handle text content download', async () => {
            elements.result.textContent = 'Hello World';
            
            await converter.handleDownload();
            
            expect(converter.downloadManager.downloadFile).toHaveBeenCalledWith('Hello World', 'output.txt', 'application/octet-stream');
            expect(NotificationManager.show).toHaveBeenCalledWith('Content downloaded as "output.txt"', 2000, { type: 'success' });
        });

        test('should handle binary content download', async () => {
            elements.result.textContent = '[Binary content (image/png). Use Download button.]';
            elements.input.value = 'SGVsbG8gV29ybGQ='; // Base64 for "Hello World"
            converter.outputKind = 'binary';
            
            await converter.handleDownload();
            
            expect(converter.downloadManager.downloadFile).toHaveBeenCalledWith(expect.any(Uint8Array), 'output.bin', 'application/octet-stream');
            expect(NotificationManager.show).toHaveBeenCalledWith('Content downloaded as "output.bin"', 2000, { type: 'success' });
        });

        test('should treat text output as text even when it resembles a binary placeholder', async () => {
            const textOutput = '[Binary content is actually text]';
            elements.result.textContent = textOutput;
            converter.outputKind = 'text';

            await converter.handleDownload();

            expect(converter.downloadManager.downloadFile).toHaveBeenCalledWith(textOutput, 'output.txt', 'application/octet-stream');
        });

        test('should handle binary content download from Data URI', async () => {
            elements.result.textContent = '[Binary content (image/png). Use Download button.]';
            elements.input.value = 'data:image/png;base64,SGVsbG8gV29ybGQ=';
            converter.outputKind = 'binary';
            
            await converter.handleDownload();
            
            expect(converter.downloadManager.downloadFile).toHaveBeenCalledWith(expect.any(Uint8Array), 'output.bin', 'application/octet-stream');
            expect(NotificationManager.show).toHaveBeenCalledWith('Content downloaded as "output.bin"', 2000, { type: 'success' });
        });

        test('should download the source bytes when an image preview is active', async () => {
            elements.input.value = 'data:image/png;base64,SGVsbG8=';
            elements.mode.value = 'decode';
            converter.processInput();
            elements.input.value = 'data:image/png;base64,V29ybGQ=';

            await converter.handleDownload();

            const [content, filename, mimeType] = converter.downloadManager.downloadFile.mock.calls[0];
            expect(Array.from(content)).toEqual([72, 101, 108, 108, 111]);
            expect(filename).toBe('output.bin');
            expect(mimeType).toBe('application/octet-stream');
        });

        test('should show error for empty content', async () => {
            elements.result.textContent = '';
            
            await converter.handleDownload();
            
            expect(NotificationManager.show).toHaveBeenCalledWith('No content to download', 3000, { type: 'error' });
        });

        test('should show error for invalid base64 in binary download', async () => {
            elements.result.textContent = '[Binary content (image/png). Use Download button.]';
            elements.input.value = 'Invalid Base64!';
            converter.outputKind = 'binary';
            
            await converter.handleDownload();
            
            expect(NotificationManager.show).toHaveBeenCalledWith('Input is not valid Base64 for download', 3000, { type: 'error' });
        });

        test('should show error for invalid Data URI format in binary download', async () => {
            elements.result.textContent = '[Binary content (image/png). Use Download button.]';
            elements.input.value = 'data:invalid-format';
            converter.outputKind = 'binary';
            
            await converter.handleDownload();
            
            expect(NotificationManager.show).toHaveBeenCalledWith('Invalid Data URI format for download', 3000, { type: 'error' });
        });

        test('should handle binary content download with specific MIME type', async () => {
            elements.result.textContent = '[Binary content (application/pdf). Use Download button.]';
            elements.input.value = 'data:application/pdf;base64,SGVsbG8gV29ybGQ=';
            converter.outputKind = 'binary';
            
            await converter.handleDownload();
            
            expect(converter.downloadManager.downloadFile).toHaveBeenCalledWith(expect.any(Uint8Array), 'output.bin', 'application/octet-stream');
            expect(NotificationManager.show).toHaveBeenCalledWith('Content downloaded as "output.bin"', 2000, { type: 'success' });
        });

        test('should download a URL-safe binary payload', async () => {
            // Regression: isBase64 accepted the URL-safe alphabet and auto
            // detect classified it as binary + enabled Download, but the
            // download path then passed the raw payload to atob, which threw.
            elements.result.textContent = '[Binary content (application/octet-stream). Use Download button.]';
            elements.input.value = '_w=='; // URL-safe for the single byte 0xFF
            elements.mode.value = 'auto';
            converter.processInput();

            expect(converter.outputKind).toBe('binary');

            await converter.handleDownload();

            const [content] = converter.downloadManager.downloadFile.mock.calls[0];
            expect(Array.from(content)).toEqual([0xFF]);
            expect(NotificationManager.show).toHaveBeenCalledWith('Content downloaded as "output.bin"', 2000, { type: 'success' });
        });

        test('should show error when download manager throws', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            elements.result.textContent = 'Hello World';
            converter.downloadManager.downloadFile.mockImplementationOnce(() => {
                throw new Error('Disk full');
            });

            await converter.handleDownload();

            expect(NotificationManager.show)
                .toHaveBeenCalledWith('Error downloading content: Disk full', 3000, { type: 'error' });
            consoleErrorSpy.mockRestore();
        });
    });

    describe('Data URI and Binary Content Handling', () => {
        test('should handle Data URI with non-text MIME type in auto mode', () => {
            elements.input.value = 'data:application/pdf;base64,SGVsbG8gV29ybGQ=';
            elements.mode.value = 'auto';
            converter.processInput();
            
            expect(elements.result.textContent).toContain('[Binary content (application/pdf). Use Download button.]');
            expect(elements.preview.hidden).toBe(true);
            expect(elements.swapButton.disabled).toBe(true);
            expect(elements.downloadDecodedButton.disabled).toBe(false);
        });

        test('should decode a declared text Data URI as text', () => {
            elements.input.value = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
            elements.mode.value = 'auto';
            converter.processInput();

            expect(converter.outputKind).toBe('text');
            expect(elements.result.textContent).toBe('Hello World');
            expect(elements.preview.hidden).toBe(true);
            expect(elements.downloadDecodedButton.disabled).toBe(false);
        });

        test('should apply strict text validation to declared text Data URIs', () => {
            elements.input.value = 'data:text/plain;base64,SGVsbG8AAHdvcmxk';
            elements.mode.value = 'decode';
            elements.encoding.value = 'UTF-8';
            converter.processInput();

            expect(converter.outputKind).toBe('text');
            expect(elements.result.textContent).toBe('Helloworld');
            expect(elements.preview.hidden).toBe(true);
        });

        test('should preview an image Data URI in auto mode', () => {
            elements.input.value = IMAGE_DATA_URI;
            elements.mode.value = 'auto';
            converter.processInput();

            expect(elements.result.textContent).toBe('');
            expect(elements.result.hidden).toBe(true);
            expect(elements.preview.hidden).toBe(false);
            expect(elements.preview.src).toContain('data:image/png;base64,');
            expect(converter.outputKind).toBe('image');
            expect(converter.lastConversionDirection).toBe('decode');
            expect(elements.downloadDecodedButton.disabled).toBe(false);
            expect(elements.swapButton.disabled).toBe(true);
            expect(converter.copyButtonInstance.wrapper.hidden).toBe(true);
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Decoded. MIME: image/png. Image preview available.',
                2000,
                { type: 'success' }
            );
        });

        test('should preview an image Data URI in decode mode', () => {
            elements.input.value = IMAGE_DATA_URI;
            elements.mode.value = 'decode';
            converter.processInput();

            expect(elements.preview.hidden).toBe(false);
            expect(elements.result.hidden).toBe(true);
            expect(elements.downloadDecodedButton.disabled).toBe(false);
            expect(elements.swapButton.disabled).toBe(true);
        });

        test('should fall back to a binary placeholder when an image preview fails to load', () => {
            elements.input.value = IMAGE_DATA_URI;
            elements.mode.value = 'decode';
            converter.processInput();

            converter.imagePreviewRequest.loader.dispatchEvent(new Event('error'));

            expect(elements.preview.hidden).toBe(true);
            expect(elements.result.hidden).toBe(false);
            expect(elements.result.textContent).toBe('[Binary content (image/png). Use Download button.]');
            expect(elements.downloadDecodedButton.disabled).toBe(false);
            expect(elements.swapButton.disabled).toBe(true);
            expect(elements.status.textContent).toBe('Image preview unavailable. Use Download button.');
        });

        test('should ignore a stale image loader failure after a newer preview starts', () => {
            elements.input.value = 'data:image/png;base64,SGVsbG8=';
            elements.mode.value = 'decode';
            converter.processInput();
            const firstRequest = converter.imagePreviewRequest;

            elements.input.value = 'data:image/jpeg;base64,V29ybGQ=';
            converter.processInput();
            const secondRequest = converter.imagePreviewRequest;

            firstRequest.loader.dispatchEvent(new Event('error'));

            expect(converter.imagePreviewRequest).toBe(secondRequest);
            expect(converter.outputKind).toBe('image');
            expect(elements.preview.hidden).toBe(false);
            expect(elements.result.hidden).toBe(true);

            secondRequest.loader.dispatchEvent(new Event('error'));

            expect(converter.outputKind).toBe('binary');
            expect(elements.result.textContent).toBe('[Binary content (image/jpeg). Use Download button.]');
        });

        test('should reject malformed image Data URIs without previewing', () => {
            elements.input.value = 'data:image/png,not-base64';
            elements.mode.value = 'decode';
            converter.processInput();

            expect(elements.preview.hidden).toBe(true);
            expect(elements.result.textContent).toBe('');
            expect(elements.status.textContent).toBe('Invalid Data URI format');
            expect(elements.downloadDecodedButton.disabled).toBe(true);
            expect(elements.swapButton.disabled).toBe(true);
        });

        test('should keep bare Base64 text output unchanged', () => {
            elements.input.value = 'SGVsbG8gV29ybGQ=';
            elements.mode.value = 'auto';
            converter.processInput();

            expect(elements.result.textContent).toBe('Hello World');
            expect(elements.preview.hidden).toBe(true);
            expect(elements.result.hidden).toBe(false);
            expect(elements.swapButton.disabled).toBe(false);
        });

        test('should handle null characters in decoded content', () => {
            // Base64 string with null characters (binary data)
            elements.input.value = 'SGVsbG8AAHdvcmxk'; // Contains null character
            elements.mode.value = 'decode';
            elements.encoding.value = 'UTF-8';
            converter.processInput();
            
            // Check for null character replacement
            expect(elements.result.textContent).toBe('Helloworld');
            expect(elements.downloadDecodedButton.disabled).toBe(false);
        });

        test('should mark auto-decoded content as likely binary when decode fails for selected encoding', () => {
            elements.input.value = '77+9'; // produces invalid UTF-8 replacement behavior on decode
            elements.mode.value = 'auto';
            elements.encoding.value = 'UTF-16';
            converter.processInput();

            expect(elements.result.textContent).toContain('[Decoded content (likely binary');
            expect(elements.downloadDecodedButton.disabled).toBe(false);
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Decoded. Selected encoding (UTF-16) failed for display. Use Download.',
                2000,
                { type: 'success' }
            );
        });

    });

    describe('Bare Base64 Image Sniffing (magic bytes)', () => {
        // Upload output strips the Data URI prefix, so these bare payloads are
        // what a user pastes back after uploading an image file.
        const BARE_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        const BARE_JPEG = '/9j/4AAQSkZJRgD/2P/Z';
        const BARE_GIF = 'R0lGODlhAQABAIAAAP///////yH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
        const BARE_WEBP = 'UklGRhoAAABXRUJQVlA4IA0AAACdASoBAAIANCWo';
        const BARE_AVIF = 'AAAAIGZ0eXBhdmlm/9gAEEpGSUY=';
        const BARE_BMP = 'Qk34AAAAAAA2AAAAKAD/2A==';
        const BARE_SVG_MARKUP = 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==';

        test.each([
            ['png', BARE_PNG, 'image/png'],
            ['jpeg', BARE_JPEG, 'image/jpeg'],
            ['gif', BARE_GIF, 'image/gif'],
            ['webp', BARE_WEBP, 'image/webp'],
            ['avif', BARE_AVIF, 'image/avif'],
            ['bmp', BARE_BMP, 'image/bmp']
        ])('should preview bare %s base64 in auto mode (inferred %s)', (_label, payload, mimeType) => {
            elements.input.value = payload;
            elements.mode.value = 'auto';
            converter.processInput();

            expect(converter.outputKind).toBe('image');
            expect(converter.currentMimeType).toBe(mimeType);
            expect(elements.preview.hidden).toBe(false);
            expect(elements.preview.src).toContain(`data:${mimeType};base64,`);
            expect(elements.result.hidden).toBe(true);
            expect(elements.downloadDecodedButton.disabled).toBe(false);
            expect(elements.swapButton.disabled).toBe(true);
            expect(NotificationManager.show).toHaveBeenCalledWith(
                `Decoded. Image preview loading (inferred MIME: ${mimeType}).`,
                2000,
                { type: 'success' }
            );
        });

        test.each([
            ['ASCII', 'ASCII'],
            ['ISO-8859-1', 'ISO-8859-1']
        ])('should preview bare image base64 with %s encoding selected', (_label, encodingValue) => {
            elements.encoding.innerHTML = `
              <option value="ASCII">ASCII</option>
              <option value="ISO-8859-1">ISO-8859-1</option>
            `;
            elements.input.value = BARE_PNG;
            elements.mode.value = 'auto';
            elements.encoding.value = encodingValue;
            converter.processInput();

            // ASCII/ISO-8859-1 decoding accepts arbitrary bytes, so without
            // sniff-first these payloads would render as mojibake text.
            expect(converter.outputKind).toBe('image');
            expect(converter.currentMimeType).toBe('image/png');
            expect(elements.preview.hidden).toBe(false);
            expect(elements.result.hidden).toBe(true);
            expect(converter.imagePreviewTextFallback).not.toBe(null);
        });

        test('should restore text when a sniffed preview is rejected (UTF-8 magic collision)', () => {
            elements.input.value = 'Qk1X'; // "BMW" — valid text colliding with the BMP signature
            elements.mode.value = 'auto';
            converter.processInput();

            expect(converter.outputKind).toBe('image');
            expect(converter.imagePreviewTextFallback).toBe('BMW');

            converter.imagePreviewRequest.loader.dispatchEvent(new Event('error'));

            expect(converter.outputKind).toBe('text');
            expect(elements.preview.hidden).toBe(true);
            expect(elements.result.hidden).toBe(false);
            expect(elements.result.textContent).toBe('BMW');
            expect(elements.status.textContent).toBe('');
            expect(elements.swapButton.disabled).toBe(false);
        });

        test('should restore text when a sniffed preview is rejected (ASCII mode)', () => {
            elements.encoding.innerHTML = '<option value="ASCII">ASCII</option>';
            elements.input.value = 'Qk1X';
            elements.mode.value = 'auto';
            elements.encoding.value = 'ASCII';
            converter.processInput();

            expect(converter.outputKind).toBe('image');

            converter.imagePreviewRequest.loader.dispatchEvent(new Event('error'));

            expect(converter.outputKind).toBe('text');
            expect(elements.result.textContent).toBe('BMW');
        });

        test('should download restored text as a text file after fallback', async () => {
            elements.input.value = 'Qk1X';
            elements.mode.value = 'auto';
            converter.processInput();
            converter.imagePreviewRequest.loader.dispatchEvent(new Event('error'));

            await converter.handleDownload();

            const [content, filename] = converter.downloadManager.downloadFile.mock.calls[0];
            expect(content).toBe('BMW');
            expect(filename).toBe('output.txt');
        });

        test('should drop a stale text fallback when a newer preview starts', () => {
            elements.input.value = 'Qk1X'; // "BMW" — sniffed preview with a text fallback stashed
            elements.mode.value = 'auto';
            converter.processInput();
            const firstRequest = converter.imagePreviewRequest;
            expect(converter.imagePreviewTextFallback).toBe('BMW');

            elements.input.value = IMAGE_DATA_URI;
            converter.processInput();
            expect(converter.imagePreviewTextFallback).toBe(null);

            firstRequest.loader.dispatchEvent(new Event('error'));

            expect(converter.outputKind).toBe('image');
            expect(elements.preview.hidden).toBe(false);
        });

        test('should preview bare image base64 in strict decode mode', () => {
            elements.input.value = BARE_PNG;
            elements.mode.value = 'decode';
            converter.processInput();

            expect(converter.outputKind).toBe('image');
            expect(elements.preview.hidden).toBe(false);
            expect(elements.result.hidden).toBe(true);
            expect(elements.downloadDecodedButton.disabled).toBe(false);
        });

        describe('decode preview meta', () => {
            const attachPreviewMeta = () => {
                const meta = document.createElement('p');
                meta.id = 'base64converter-preview-meta';
                meta.hidden = true;
                document.body.appendChild(meta);
                converter.elements.previewMeta = meta;
                return meta;
            };

            test('should show declared type and size under a Data URI preview', () => {
                const meta = attachPreviewMeta();
                elements.input.value = IMAGE_DATA_URI;
                elements.mode.value = 'auto';
                converter.processInput();

                expect(converter.outputKind).toBe('image');
                expect(meta.hidden).toBe(false);
                expect(meta.textContent).toBe('image/png · 68 B');
            });

            test('should show inferred type and size under a bare base64 preview', () => {
                const meta = attachPreviewMeta();
                elements.input.value = BARE_PNG;
                elements.mode.value = 'auto';
                converter.processInput();

                expect(meta.hidden).toBe(false);
                expect(meta.textContent).toBe('image/png · 68 B');
            });

            test('should append dimensions to the meta once the image loads', () => {
                const meta = attachPreviewMeta();
                elements.input.value = IMAGE_DATA_URI;
                elements.mode.value = 'auto';
                converter.processInput();

                const loader = converter.imagePreviewRequest.loader;
                Object.defineProperty(loader, 'naturalWidth', { configurable: true, value: 800 });
                Object.defineProperty(loader, 'naturalHeight', { configurable: true, value: 600 });
                loader.dispatchEvent(new Event('load'));

                expect(meta.textContent).toBe('image/png · 68 B · 800×600px');
            });

            test('should ignore dimensions from a stale image loader', () => {
                const meta = attachPreviewMeta();
                elements.input.value = 'data:image/png;base64,SGVsbG8=';
                elements.mode.value = 'decode';
                converter.processInput();
                const firstLoader = converter.imagePreviewRequest.loader;

                elements.input.value = IMAGE_DATA_URI;
                converter.processInput();
                expect(meta.textContent).toBe('image/png · 68 B');

                Object.defineProperty(firstLoader, 'naturalWidth', { configurable: true, value: 1 });
                Object.defineProperty(firstLoader, 'naturalHeight', { configurable: true, value: 1 });
                firstLoader.dispatchEvent(new Event('load'));

                expect(meta.textContent).toBe('image/png · 68 B');
            });

            test('should hide the preview meta when the image fails to load', () => {
                const meta = attachPreviewMeta();
                elements.input.value = IMAGE_DATA_URI;
                elements.mode.value = 'decode';
                converter.processInput();
                expect(meta.hidden).toBe(false);

                converter.imagePreviewRequest.loader.dispatchEvent(new Event('error'));

                expect(meta.hidden).toBe(true);
                expect(elements.preview.hidden).toBe(true);
                expect(elements.result.textContent).toBe('[Binary content (image/png). Use Download button.]');
            });

            test('should clear the preview meta when converting follow-up input', () => {
                const meta = attachPreviewMeta();
                elements.input.value = IMAGE_DATA_URI;
                elements.mode.value = 'auto';
                converter.processInput();
                expect(meta.hidden).toBe(false);

                elements.input.value = 'Hello';
                converter.processInput();

                expect(meta.hidden).toBe(true);
                expect(converter.imagePreviewMetaBase).toBe(null);
            });
        });

        test('should keep a sniffed image downloadable under an image extension', async () => {
            elements.input.value = BARE_PNG;
            elements.mode.value = 'auto';
            converter.processInput();

            await converter.handleDownload();

            const [_content, filename] = converter.downloadManager.downloadFile.mock.calls[0];
            expect(filename).toBe('output.png');
        });

        test('should keep declared SVG data URIs download-only (no preview)', () => {
            elements.input.value = `data:image/svg+xml;base64,${BARE_SVG_MARKUP}`;
            elements.mode.value = 'auto';
            converter.processInput();

            expect(converter.outputKind).toBe('binary');
            expect(elements.preview.hidden).toBe(true);
            expect(elements.result.textContent).toBe('[Binary content (image/svg+xml). Use Download button.]');
            expect(elements.downloadDecodedButton.disabled).toBe(false);
        });

        test('should decode bare SVG markup as text rather than previewing it', () => {
            elements.input.value = BARE_SVG_MARKUP;
            elements.mode.value = 'auto';
            converter.processInput();

            expect(converter.outputKind).toBe('text');
            expect(elements.preview.hidden).toBe(true);
            expect(elements.result.textContent).toContain('<svg');
        });

        test('should map sniffed MIME types to file extensions', () => {
            expect(converter.detectMimeTypeFromBinary(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
            expect(converter.detectMimeTypeFromBinary(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
            expect(converter.detectMimeTypeFromBinary(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('image/gif');
            expect(converter.detectMimeTypeFromBinary(new Uint8Array([0x42, 0x4d, 0x00]))).toBe('image/bmp');
            expect(converter.detectMimeTypeFromBinary(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]))).toBe(null);
            expect(converter.getFileExtensionFromMimeType('image/png')).toBe('png');
            expect(converter.getFileExtensionFromMimeType('image/jpeg')).toBe('jpg');
            expect(converter.getFileExtensionFromMimeType('application/pdf')).toBe('bin');
            expect(converter.getFileExtensionFromMimeType('')).toBe('bin');
        });

    });

    describe('Upload Image Preview', () => {
        const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        let originalCreateObjectURL;
        let originalRevokeObjectURL;

        const attachThumbnailSlots = () => {
            const thumbnail = document.createElement('img');
            thumbnail.id = 'base64converter-upload-preview';
            thumbnail.hidden = true;
            document.body.appendChild(thumbnail);
            const meta = document.createElement('p');
            meta.id = 'base64converter-upload-meta';
            meta.hidden = true;
            document.body.appendChild(meta);
            converter.elements.uploadPreview = thumbnail;
            converter.elements.uploadPreviewMeta = meta;
            return { thumbnail, meta };
        };

        beforeEach(() => {
            originalCreateObjectURL = URL.createObjectURL;
            originalRevokeObjectURL = URL.revokeObjectURL;
            URL.createObjectURL = jest.fn().mockReturnValue('blob:mock/upload-preview');
            URL.revokeObjectURL = jest.fn();
        });

        afterEach(() => {
            URL.createObjectURL = originalCreateObjectURL;
            URL.revokeObjectURL = originalRevokeObjectURL;
            document.getElementById('base64converter-upload-preview')?.remove();
            document.getElementById('base64converter-upload-meta')?.remove();
        });

        const uploadFile = (file, dataUrl) => {
            const event = { target: { files: [file] } };
            converter.handleFileUpload(event);
            mockFileReaderInstance.result = dataUrl;
            mockFileReaderInstance.onload();
        };

        test('should show a thumbnail alongside the base64 output for image uploads', () => {
            const { thumbnail, meta } = attachThumbnailSlots();
            const mockFile = new File(['png-bytes'], 'photo.png', { type: 'image/png' });

            uploadFile(mockFile, PNG_DATA_URL);

            // Base64 output contract is unchanged (bare payload, still text).
            expect(elements.result.textContent).toBe(PNG_DATA_URL.split(',')[1]);
            expect(converter.outputKind).toBe('text');
            expect(URL.createObjectURL).toHaveBeenCalledWith(mockFile);
            expect(converter.uploadPreviewUrl).toBe('blob:mock/upload-preview');
            expect(thumbnail.hidden).toBe(false);
            expect(thumbnail.getAttribute('src')).toBe('blob:mock/upload-preview');
            expect(meta.hidden).toBe(false);
            expect(meta.textContent).toBe('image/png · 9 B');
        });

        test('should round-trip upload output back into an image preview', () => {
            attachThumbnailSlots();
            const mockFile = new File(['png-bytes'], 'photo.png', { type: 'image/png' });

            uploadFile(mockFile, PNG_DATA_URL);

            elements.input.value = elements.result.textContent;
            elements.mode.value = 'auto';
            converter.processInput();

            expect(converter.outputKind).toBe('image');
            expect(elements.preview.hidden).toBe(false);
            expect(elements.preview.src).toContain('data:image/png;base64,');
        });

        test('should not create a preview for SVG uploads', () => {
            const { thumbnail } = attachThumbnailSlots();
            const mockFile = new File(['<svg></svg>'], 'vector.svg', { type: 'image/svg+xml' });

            uploadFile(mockFile, 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=');

            expect(elements.result.textContent).toBe('PHN2Zz48L3N2Zz4=');
            expect(URL.createObjectURL).not.toHaveBeenCalled();
            expect(converter.uploadPreviewUrl).toBe(null);
            expect(thumbnail.hidden).toBe(true);
        });

        test('should skip the preview for oversized images but still encode', () => {
            const { thumbnail, meta } = attachThumbnailSlots();
            const mockFile = new File(['x'], 'big.png', { type: 'image/png' });
            Object.defineProperty(mockFile, 'size', { configurable: true, value: 16 * 1024 * 1024 });

            uploadFile(mockFile, PNG_DATA_URL);

            expect(elements.result.textContent).toBe(PNG_DATA_URL.split(',')[1]);
            expect(URL.createObjectURL).not.toHaveBeenCalled();
            expect(thumbnail.hidden).toBe(true);
            expect(meta.hidden).toBe(false);
            expect(meta.textContent).toContain('Preview skipped');
        });

        test('should revoke the object URL when the output state resets', () => {
            const { thumbnail, meta } = attachThumbnailSlots();
            const mockFile = new File(['png-bytes'], 'photo.png', { type: 'image/png' });

            uploadFile(mockFile, PNG_DATA_URL);
            expect(converter.uploadPreviewUrl).toBe('blob:mock/upload-preview');

            elements.input.value = 'Hello';
            elements.mode.value = 'auto';
            converter.processInput();

            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock/upload-preview');
            expect(converter.uploadPreviewUrl).toBe(null);
            expect(thumbnail.hidden).toBe(true);
            expect(meta.hidden).toBe(true);
        });

        test('should skip the thumbnail when blob URLs are unavailable', () => {
            const { thumbnail, meta } = attachThumbnailSlots();
            URL.createObjectURL = undefined;
            const mockFile = new File(['png-bytes'], 'photo.png', { type: 'image/png' });

            uploadFile(mockFile, PNG_DATA_URL);

            expect(elements.result.textContent).toBe(PNG_DATA_URL.split(',')[1]);
            expect(converter.uploadPreviewUrl).toBe(null);
            expect(thumbnail.hidden).toBe(true);
            expect(meta.hidden).toBe(true);
        });

        test('should clear the thumbnail if it fails to load', () => {
            const { thumbnail, meta } = attachThumbnailSlots();
            const mockFile = new File(['png-bytes'], 'photo.png', { type: 'image/png' });

            uploadFile(mockFile, PNG_DATA_URL);
            expect(thumbnail.hidden).toBe(false);

            thumbnail.dispatchEvent(new Event('error'));

            expect(converter.uploadPreviewUrl).toBe(null);
            expect(thumbnail.hidden).toBe(true);
            expect(meta.hidden).toBe(true);
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock/upload-preview');
        });

        test('should enrich the upload meta once the thumbnail loads', () => {
            const { thumbnail, meta } = attachThumbnailSlots();
            const mockFile = new File(['png-bytes'], 'photo.png', { type: 'image/png' });

            uploadFile(mockFile, PNG_DATA_URL);

            thumbnail.dispatchEvent(new Event('load'));
            expect(meta.textContent).toBe('image/png · 9 B');

            Object.defineProperty(thumbnail, 'naturalWidth', { configurable: true, value: 320 });
            Object.defineProperty(thumbnail, 'naturalHeight', { configurable: true, value: 240 });
            thumbnail.dispatchEvent(new Event('load'));
            expect(meta.textContent).toBe('image/png · 9 B · 320×240px');
        });

        test('should clear the thumbnail if creating the object URL fails', () => {
            const { thumbnail, meta } = attachThumbnailSlots();
            URL.createObjectURL = jest.fn().mockImplementation(() => {
                throw new Error('denied');
            });
            const mockFile = new File(['png-bytes'], 'photo.png', { type: 'image/png' });

            uploadFile(mockFile, PNG_DATA_URL);

            expect(elements.result.textContent).toBe(PNG_DATA_URL.split(',')[1]);
            expect(converter.uploadPreviewUrl).toBe(null);
            expect(thumbnail.hidden).toBe(true);
            expect(meta.hidden).toBe(true);
        });

    });

    describe('Preview helpers (pure functions)', () => {
        const {
            base64HeadToBytes,
            sniffRasterImageMimeType,
            base64DecodedSize
        } = require('./script');

        test('base64HeadToBytes decodes only a bounded head', () => {
            expect(base64HeadToBytes('')).toBe(null);
            expect(base64HeadToBytes('ABC')).toBe(null);
            expect(base64HeadToBytes('!!!!')).toBe(null);

            const head = base64HeadToBytes('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
            expect(head).not.toBe(null);
            expect(head.length).toBe(48);
            expect(Array.from(head.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);

            expect(Array.from(base64HeadToBytes('AA=='))).toEqual([0]);
        });

        test('sniffRasterImageMimeType matches raster magic bytes only', () => {
            expect(sniffRasterImageMimeType(null)).toBe(null);
            expect(sniffRasterImageMimeType(new Uint8Array([0x41]))).toBe(null);
            expect(sniffRasterImageMimeType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
            expect(sniffRasterImageMimeType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a]))).toBe(null);
            expect(sniffRasterImageMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
            expect(sniffRasterImageMimeType(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]))).toBe('image/gif');
            expect(sniffRasterImageMimeType(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('image/gif');
            expect(sniffRasterImageMimeType(new Uint8Array([0x42, 0x4d, 0x00]))).toBe('image/bmp');
            expect(sniffRasterImageMimeType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x1a, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp');
            expect(sniffRasterImageMimeType(new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]))).toBe('image/avif');
            expect(sniffRasterImageMimeType(new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x73]))).toBe('image/avif');
            expect(sniffRasterImageMimeType(new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]))).toBe(null);
            expect(sniffRasterImageMimeType(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]))).toBe(null);
        });

        test('base64DecodedSize reports exact decoded sizes', () => {
            expect(base64DecodedSize('')).toBe(null);
            expect(base64DecodedSize('ABC')).toBe(null);
            expect(base64DecodedSize('SGVsbG8=')).toBe(5);
            expect(base64DecodedSize('SGVsbG8gV29ybGQ=')).toBe(11);
            expect(base64DecodedSize('YWI=')).toBe(2);
        });

    });

    describe('DOM Integration', () => {
        test('should log error and warn when required elements are missing during DOM initialization', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            document.body.innerHTML = `
                <div id="notification"></div>
                <textarea id="base64converter-input"></textarea>
                <div id="base64converter-result"></div>
                <button id="base64converter-convert"></button>
            `;

            document.dispatchEvent(new Event('DOMContentLoaded'));

            expect(consoleErrorSpy).toHaveBeenCalledWith('Missing required elements:', expect.any(Array));
            expect(NotificationManager.show).toHaveBeenCalledWith(
                'Required elements not found - tool may not function properly',
                3000,
                { type: 'error' }
            );
            consoleErrorSpy.mockRestore();
        });

        test('should handle convert button click', () => {
            const processInputSpy = jest.spyOn(converter, 'processInput');
            elements.convertButton.click();
            expect(processInputSpy).toHaveBeenCalled();
        });

        test('shows an inline status error when converting empty input', () => {
            elements.input.value = '';
            elements.convertButton.click();

            expect(elements.status.textContent).toBe('Please enter some text or upload a file to convert');
        });

        test('Load Sample resets mode to auto and encodes a plain-text sample', () => {
            elements.mode.value = 'decode';
            elements.input.value = 'not actually base64';

            document.getElementById('base64converter-load-sample').click();

            expect(elements.mode.value).toBe('auto');
            expect(elements.input.value).toBe('Hello from CodeSamplez Tools!');
            expect(elements.result.textContent).not.toBe('');
            expect(elements.status.textContent).toBe('');
        });
    });

    describe('URL Parameter Support (External Linking)', () => {
        const setTestUrl = (search = '', hash = '') => {
            const normalizedSearch = search ? (search.startsWith('?') ? search : `?${search}`) : '';
            const normalizedHash = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';
            window.history.replaceState({}, '', `http://localhost/${normalizedSearch}${normalizedHash}`);
        };

        beforeEach(() => {
            document.body.innerHTML = BASE_DOM_HTML;
            setTestUrl();
        });

        afterEach(() => {
            setTestUrl();
            jest.restoreAllMocks();
        });

        test('should handle URL with data parameter and auto-convert plain text', () => {
            setTestUrl('?data=Hello%20World');

            jest.useFakeTimers();
            document.dispatchEvent(new Event('DOMContentLoaded'));
            jest.runAllTimers();

            const converter = window.base64ConverterInstance;

            // Check that URL parameter data was processed
            expect(converter.elements.input.value).toBe('Hello World');
            expect(converter.elements.mode.value).toBe('auto');
            expect(converter.elements.result.textContent).toBe('SGVsbG8gV29ybGQ=');

            jest.useRealTimers();
        });

        test('should prefer hash-based preload over query-string preload', () => {
            setTestUrl('?data=Hello%20World', '#data=SGVsbG8gV29ybGQ%3D');

            jest.useFakeTimers();
            document.dispatchEvent(new Event('DOMContentLoaded'));
            jest.runAllTimers();

            const converter = window.base64ConverterInstance;
            expect(converter.elements.input.value).toBe('SGVsbG8gV29ybGQ=');
            expect(converter.elements.result.textContent).toBe('Hello World');

            jest.useRealTimers();
        });

        test('should handle URL with data parameter and auto-convert base64', () => {
            setTestUrl('?data=SGVsbG8gV29ybGQ%3D');

            jest.useFakeTimers();
            document.dispatchEvent(new Event('DOMContentLoaded'));
            jest.runAllTimers();

            const converter = window.base64ConverterInstance;
            expect(converter.elements.input.value).toBe('SGVsbG8gV29ybGQ=');
            expect(converter.elements.mode.value).toBe('auto');
            expect(converter.elements.result.textContent).toBe('Hello World');

            jest.useRealTimers();
        });

        test('should handle URL with encoded special characters', () => {
            setTestUrl('?data=Hello%2C%20World%21%20%26%20everyone%2E');

            jest.useFakeTimers();
            document.dispatchEvent(new Event('DOMContentLoaded'));
            jest.runAllTimers();

            const converter = window.base64ConverterInstance;
            expect(converter.elements.input.value).toBe('Hello, World! & everyone.');
            expect(converter.elements.result.textContent).toBe('SGVsbG8sIFdvcmxkISAmIGV2ZXJ5b25lLg==');

            jest.useRealTimers();
        });

        test('should handle invalid URL-encoded data parameter', () => {
            setTestUrl('?data=%25ZZinvalid-encoding');

            jest.useFakeTimers();
            document.dispatchEvent(new Event('DOMContentLoaded'));
            jest.runAllTimers();

            const converter = window.base64ConverterInstance;
            expect(converter.elements.input.value).toBe('%ZZinvalid-encoding');
            expect(converter.elements.result.textContent).toBe('JVpaaW52YWxpZC1lbmNvZGluZw==');

            jest.useRealTimers();
        });

        test('should handle empty data parameter', () => {
            setTestUrl('?data=');

            jest.useFakeTimers();
            document.dispatchEvent(new Event('DOMContentLoaded'));
            jest.runAllTimers();

            const converter = window.base64ConverterInstance;
            expect(converter.elements.input.value).toBe('');
            expect(converter.elements.result.textContent).toBe('');

            jest.useRealTimers();
        });

        test('should handle URL without data parameter (normal behavior)', () => {
            setTestUrl();

            jest.useFakeTimers();
            document.dispatchEvent(new Event('DOMContentLoaded'));
            jest.runAllTimers();

            const converter = window.base64ConverterInstance;
            expect(converter.elements.input.value).toBe('');

            jest.useRealTimers();
        });

        test('should URL-decode data parameter correctly', () => {
            setTestUrl('?data=Hello%20%5C%2F%3F%23%5B%5D%40%21%24%26%27%28%29%2A%2B%2C%3B%3D');

            jest.useFakeTimers();
            document.dispatchEvent(new Event('DOMContentLoaded'));
            jest.runAllTimers();

            const converter = window.base64ConverterInstance;
            expect(converter.elements.input.value).toBe('Hello \\/?#[]@!$&\'()*+,;=');
            expect(converter.elements.result.textContent).toBe('SGVsbG8gXC8/I1tdQCEkJicoKSorLDs9');

            jest.useRealTimers();
        });

        test('should handle URL parameter with malformed encoding by escaping invalid percent signs', () => {
            setTestUrl('?data=%25%25invalid');

            jest.useFakeTimers();
            document.dispatchEvent(new Event('DOMContentLoaded'));
            jest.runAllTimers();

            const converter = window.base64ConverterInstance;
            expect(converter.elements.input.value).toBe('%%invalid');
            expect(converter.elements.result.textContent).toBe('JSVpbnZhbGlk');

            jest.useRealTimers();
        });

        test.each([
            ['a literal percent escape', 'literal %20 marker'],
            ['a bare percent sign', '100% sure'],
            ['a percent sequence that is not valid UTF-8', 'a%FFb'],
            ['plain text', 'plain text'],
            ['reserved base64 characters', 'a+b/c=']
        ])('should round-trip %s through a Share link', (_label, input) => {
            setTestUrl('', `data=${encodeURIComponent(input)}`);

            jest.useFakeTimers();
            document.dispatchEvent(new Event('DOMContentLoaded'));
            jest.runAllTimers();

            const converter = window.base64ConverterInstance;
            expect(converter.elements.input.value).toBe(input);
            expect(converter.elements.result.textContent).not.toBe('');

            jest.useRealTimers();
        });

    });
});
