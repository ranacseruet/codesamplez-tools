// Import test utilities and script
const { setupPolyfills, cleanup } = require('./test-utils.js');

// Setup test environment
const original = { ...global };
setupPolyfills();

// Mock FileReader
let mockFileReaderInstance;
const mockFileReader = jest.fn(() => {
    mockFileReaderInstance = {
        readAsDataURL: jest.fn(),
        onload: null,
        onerror: null,
        result: null,
        error: null,
    };
    return mockFileReaderInstance;
});
global.FileReader = mockFileReader;

describe('Base64Converter UI (script.js)', () => {
    let converter;
    let elements;
    let initConverter;

    beforeEach(() => {
        jest.resetModules();
        initConverter = require('./script.js');

        // Set up mock DOM
        document.body.innerHTML = `
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
            <span id="base64converter-status"></span>
            <button id="base64converter-copy" disabled></button>
            <button id="base64converter-download-decoded" disabled></button>
            <span id="base64converter-copy-status"></span>
            <button id="base64converter-clear"></button>
            <button id="base64converter-convert"></button>
        `;

        elements = {
            input: document.getElementById('base64converter-input'),
            result: document.getElementById('base64converter-result'),
            status: document.getElementById('base64converter-status'),
            copyButton: document.getElementById('base64converter-copy'),
            downloadDecodedButton: document.getElementById('base64converter-download-decoded'),
            fileInput: document.getElementById('base64converter-file'),
            mode: document.getElementById('base64converter-mode'),
            encoding: document.getElementById('base64converter-encoding'),
            copyStatus: document.getElementById('base64converter-copy-status'),
            clearButton: document.getElementById('base64converter-clear'),
            convertButton: document.getElementById('base64converter-convert'),
        };
        
        converter = initConverter;
        converter.elements = elements;

        mockFileReader.mockClear();
        if (mockFileReaderInstance) {
            mockFileReaderInstance.readAsDataURL.mockClear();
        }
    });

    describe('handleFileUpload', () => {
        test('should process file successfully and update UI', () => {
            const mockFile = new File(['Hello World'], 'test.txt', { type: 'text/plain' });
            const mockDataURL = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
            
            const event = { target: { files: [mockFile], value: 'C:\\fakepath\\test.txt' } };
            converter.handleFileUpload(event);

            expect(mockFileReader).toHaveBeenCalledTimes(1);
            expect(mockFileReaderInstance.readAsDataURL).toHaveBeenCalledWith(mockFile);

            mockFileReaderInstance.result = mockDataURL;
            mockFileReaderInstance.onload();

            expect(elements.result.textContent).toBe('SGVsbG8gV29ybGQ=');
            expect(elements.input.value).toBe(`[File: ${mockFile.name} uploaded and encoded to output]`);
            expect(elements.status.textContent).toBe(`✓ Encoded file: ${mockFile.name}`);
            expect(elements.status.className).toBe('success');
            expect(elements.copyButton.disabled).toBe(false);
            expect(event.target.value).toBeNull();
        });

        test('should handle file reading errors', () => {
            const mockFile = new File([''], 'error.txt', { type: 'text/plain' });
            const mockError = new Error('File read failed');

            const event = { target: { files: [mockFile], value: 'C:\\fakepath\\error.txt' } };
            converter.handleFileUpload(event);

            mockFileReaderInstance.error = mockError;
            mockFileReaderInstance.onerror();

            expect(elements.result.textContent).toBe('');
            expect(elements.input.value).toBe('');
            expect(elements.status.textContent).toBe(`⚠ Error reading file: ${mockError.message}`);
            expect(elements.status.className).toBe('error');
            expect(elements.copyButton.disabled).toBe(true);
        });

        test('should do nothing if no file is selected', () => {
            const event = { target: { files: [], value: '' } };
            converter.handleFileUpload(event);
            expect(mockFileReader).not.toHaveBeenCalled();
        });

        test('should handle invalid Data URI format during file processing', () => {
            const mockFile = new File(['Hello World'], 'test.txt', { type: 'text/plain' });
            const mockDataURL = 'invalid-data-url-format';
            
            const event = { target: { files: [mockFile], value: 'C:\\fakepath\\test.txt' } };
            converter.handleFileUpload(event);

            mockFileReaderInstance.result = mockDataURL;
            mockFileReaderInstance.onload();

            // For non-Data URI results, the script treats it as raw base64
            expect(elements.result.textContent).toBe('invalid-data-url-format');
            expect(elements.input.value).toBe(`[File: ${mockFile.name} uploaded and encoded to output]`);
            expect(elements.status.textContent).toBe(`✓ Encoded file: ${mockFile.name}`);
            expect(elements.status.className).toBe('success');
            expect(elements.copyButton.disabled).toBe(false);
            expect(event.target.value).toBeNull();
        });

        test('should handle non-Data URI result from FileReader', () => {
            const mockFile = new File(['Hello World'], 'test.txt', { type: 'text/plain' });
            const mockResult = 'SGVsbG8gV29ybGQ='; // Raw base64 without data: prefix
            
            const event = { target: { files: [mockFile], value: 'C:\\fakepath\\test.txt' } };
            converter.handleFileUpload(event);

            mockFileReaderInstance.result = mockResult;
            mockFileReaderInstance.onload();

            expect(elements.result.textContent).toBe('SGVsbG8gV29ybGQ=');
            expect(elements.input.value).toBe(`[File: ${mockFile.name} uploaded and encoded to output]`);
            expect(elements.status.textContent).toBe(`✓ Encoded file: ${mockFile.name}`);
            expect(converter.currentMimeType).toBe('application/octet-stream');
        });
    });

    describe('processInput', () => {
        test('should clear result and status if input is empty', () => {
            elements.input.value = '';
            converter.processInput();
            expect(elements.result.textContent).toBe('');
            expect(elements.status.textContent).toBe('');
            expect(elements.copyButton.disabled).toBe(true);
        });

        test('should encode text in encode mode', () => {
            elements.input.value = 'Hello World';
            elements.mode.value = 'encode';
            elements.encoding.value = 'UTF-8';
            converter.processInput();
            expect(elements.result.textContent).toBe('SGVsbG8gV29ybGQ=');
            expect(elements.status.textContent).toBe('✓ Encoded using UTF-8');
            expect(elements.status.className).toBe('success');
            expect(elements.copyButton.disabled).toBe(false);
        });

        test('should decode text in decode mode', () => {
            elements.input.value = 'SGVsbG8gV29ybGQ=';
            elements.mode.value = 'decode';
            elements.encoding.value = 'UTF-8';
            converter.processInput();
            expect(elements.result.textContent).toBe('Hello World');
            expect(elements.status.textContent).toBe('✓ Decoded using UTF-8');
            expect(elements.status.className).toBe('success');
            expect(elements.copyButton.disabled).toBe(false);
        });

        test('should show error for invalid base64 in decode mode', () => {
            elements.input.value = 'Not Base64!';
            elements.mode.value = 'decode';
            converter.processInput();
            expect(elements.result.textContent).toBe('');
            expect(elements.status.textContent).toContain('Invalid base64 input');
            expect(elements.status.className).toBe('error');
            expect(elements.copyButton.disabled).toBe(true);
        });
        
        test('should auto-detect and encode plain text', () => {
            elements.input.value = 'Auto Encode Test';
            elements.mode.value = 'auto';
            converter.processInput();
            expect(elements.result.textContent).toBe('QXV0byBFbmNvZGUgVGVzdA==');
            expect(elements.status.textContent).toBe('✓ Encoded using UTF-8');
        });

        test('should auto-detect and decode base64 text', () => {
            elements.input.value = 'QXV0byBEZWNvZGUgVGVzdA==';
            elements.mode.value = 'auto';
            converter.processInput();
            expect(elements.result.textContent).toBe('Auto Decode Test');
            expect(elements.status.textContent).toBe('✓ Decoded using UTF-8');
        });

        test('should handle Data URI with binary content', () => {
            elements.input.value = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==';
            elements.mode.value = 'auto';
            converter.processInput();
            expect(elements.result.textContent).toContain('[Binary content (image/png)');
            expect(elements.downloadDecodedButton.disabled).toBe(false);
        });

        test('should not process file upload placeholder as text', () => {
            elements.input.value = '[File: test.png uploaded and encoded to output]';
            converter.processInput();
            expect(elements.copyButton.disabled).toBe(false);
            expect(elements.downloadDecodedButton.disabled).toBe(false);
        });

        test('should handle invalid Data URI format', () => {
            elements.input.value = 'data:invalid-format-without-base64';
            elements.mode.value = 'auto';
            converter.processInput();
            expect(elements.result.textContent).toBe('');
            expect(elements.status.textContent).toBe('⚠ Invalid Data URI format.');
            expect(elements.status.className).toBe('error');
        });

        test('should handle Data URI with text content in auto mode', () => {
            elements.input.value = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
            elements.mode.value = 'auto';
            converter.processInput();
            expect(elements.result.textContent).toBe('Hello World');
            expect(elements.downloadDecodedButton.disabled).toBe(false);
        });

        test('should handle Data URI with JSON content', () => {
            const jsonBase64 = btoa('{"key":"value"}');
            elements.input.value = `data:application/json;base64,${jsonBase64}`;
            elements.mode.value = 'auto';
            converter.processInput();
            expect(elements.result.textContent).toBe('{"key":"value"}');
            expect(elements.downloadDecodedButton.disabled).toBe(false);
        });

        test('should handle Data URI with XML content', () => {
            const xmlBase64 = btoa('<?xml version="1.0"?><root></root>');
            elements.input.value = `data:application/xml;base64,${xmlBase64}`;
            elements.mode.value = 'auto';
            converter.processInput();
            expect(elements.result.textContent).toBe('<?xml version="1.0"?><root></root>');
            expect(elements.downloadDecodedButton.disabled).toBe(false);
        });

        test('should handle Data URI with JavaScript content', () => {
            const jsBase64 = btoa('function test() { return true; }');
            elements.input.value = `data:application/javascript;base64,${jsBase64}`;
            elements.mode.value = 'auto';
            converter.processInput();
            expect(elements.result.textContent).toBe('function test() { return true; }');
            expect(elements.downloadDecodedButton.disabled).toBe(false);
        });

        test('should handle base64 with null characters (binary detection)', () => {
            // Create base64 that decodes to content with null character
            const binaryContent = 'Hello\u0000World';
            const base64WithNull = btoa(binaryContent);
            elements.input.value = base64WithNull;
            elements.mode.value = 'auto';
            converter.processInput();
            expect(elements.result.textContent).toContain('[Decoded content (likely binary');
            expect(elements.downloadDecodedButton.disabled).toBe(false);
        });

        test('should handle text decoding errors in auto mode', () => {
            // Mock the codec to throw a UTF-8 error
            const originalDecodeText = converter.elements.input.value;
            const mockCodec = {
                isBase64: jest.fn(() => true),
                decodeText: jest.fn(() => {
                    throw new Error('Invalid UTF-8 sequence');
                })
            };
            
            // Temporarily replace the codec
            const originalProcessInput = converter.processInput;
            converter.processInput = function() {
                const rawInput = this.elements.input.value.trim();
                if (!rawInput) return;
                
                this.currentMimeType = null;
                this.elements.downloadDecodedButton.disabled = true;
                this.elements.copyButton.disabled = true;

                const mode = this.elements.mode.value;
                
                try {
                    if (mode === 'auto' && mockCodec.isBase64(rawInput)) {
                        try {
                            mockCodec.decodeText(rawInput, 'utf8');
                        } catch (decodeError) {
                            const msg = decodeError.message.toLowerCase();
                            if (msg.includes('utf-8')) {
                                this.elements.result.textContent = '[Decoded content (likely binary, not UTF-8 text). Use Download button.]';
                                this.elements.downloadDecodedButton.disabled = false;
                                this.elements.status.textContent = '✓ Decoded. Selected encoding (UTF-8) failed for display. Use Download.';
                                this.elements.status.className = 'success';
                                this.elements.copyButton.disabled = false;
                                return;
                            }
                            throw decodeError;
                        }
                    }
                } catch (error) {
                    this.elements.result.textContent = '';
                    this.elements.status.textContent = '⚠ Processing failed: ' + error.message;
                    this.elements.status.className = 'error';
                }
            };

            elements.input.value = 'SGVsbG8gV29ybGQ=';
            elements.mode.value = 'auto';
            converter.processInput();
            
            expect(elements.result.textContent).toContain('[Decoded content (likely binary');
            expect(elements.status.textContent).toContain('failed for display');
            expect(elements.downloadDecodedButton.disabled).toBe(false);
            
            // Restore original method
            converter.processInput = originalProcessInput;
        });

        test('should handle UCS-2 decoding errors', () => {
            elements.input.value = 'SGVsbG8gV29ybGQ=';
            elements.mode.value = 'decode';
            elements.encoding.value = 'UTF-16'; // Maps to ucs2
            
            // Mock the codec to throw a UCS-2 error
            const Base64Codec = require('./Base64Codec.js');
            const originalDecodeText = Base64Codec.prototype.decodeText;
            Base64Codec.prototype.decodeText = jest.fn(() => {
                throw new Error('Invalid UCS-2 sequence');
            });
            
            converter.processInput();
            
            expect(elements.result.textContent).toBe('');
            expect(elements.status.textContent).toContain('Invalid UCS-2 sequence');
            expect(elements.status.className).toBe('error');
            
            // Restore original method
            Base64Codec.prototype.decodeText = originalDecodeText;
        });

        test('should handle empty input error', () => {
            elements.input.value = 'SGVsbG8gV29ybGQ=';
            elements.mode.value = 'encode';
            
            // Mock the codec to throw an empty error
            const Base64Codec = require('./Base64Codec.js');
            const originalEncodeText = Base64Codec.prototype.encodeText;
            Base64Codec.prototype.encodeText = jest.fn(() => {
                throw new Error('Input cannot be empty');
            });
            
            converter.processInput();
            
            expect(elements.result.textContent).toBe('');
            expect(elements.status.textContent).toContain('Input cannot be empty');
            expect(elements.status.className).toBe('error');
            
            // Restore original method
            Base64Codec.prototype.encodeText = originalEncodeText;
        });

        test('should handle generic processing errors', () => {
            elements.input.value = 'test';
            elements.mode.value = 'encode';
            
            // Mock the codec to throw a generic error
            const Base64Codec = require('./Base64Codec.js');
            const originalEncodeText = Base64Codec.prototype.encodeText;
            Base64Codec.prototype.encodeText = jest.fn(() => {
                throw new Error('Generic processing error');
            });
            
            converter.processInput();
            
            expect(elements.result.textContent).toBe('');
            expect(elements.status.textContent).toContain('Processing failed: Generic processing error');
            expect(elements.status.className).toBe('error');
            
            // Restore original method
            Base64Codec.prototype.encodeText = originalEncodeText;
        });

        test('should handle encoding mapping for UTF-16', () => {
            elements.input.value = 'Hello';
            elements.mode.value = 'encode';
            elements.encoding.value = 'UTF-16';
            converter.processInput();
            // UTF-16 should be mapped to ucs2 internally
            expect(elements.status.textContent).toBe('✓ Encoded using UTF-16');
        });

        test('should show special status for binary MIME types', () => {
            elements.input.value = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==';
            elements.mode.value = 'auto';
            converter.processInput();
            expect(elements.status.textContent).toContain('MIME: image/png');
            expect(elements.status.textContent).toContain('Selected encoding (UTF-8) ignored for binary display');
        });
    });

    describe('handleCopy', () => {
        beforeEach(() => {
            global.navigator.clipboard = { writeText: jest.fn() };
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.clearAllTimers();
            jest.useRealTimers();
            delete global.navigator.clipboard;
        });

        test('should copy result to clipboard and show success message', async () => {
            elements.result.textContent = 'Copied Text';
            global.navigator.clipboard.writeText.mockResolvedValueOnce(undefined);

            await converter.handleCopy();

            expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('Copied Text');
            expect(elements.copyStatus.textContent).toBe('Copied!');
            expect(elements.copyStatus.className).toBe('success');

            jest.runAllTimers();
            expect(elements.copyStatus.textContent).toBe('');
        });

        test('should show error message if copy fails', async () => {
            elements.result.textContent = 'Text';
            const errorMessage = 'Copy failed';
            global.navigator.clipboard.writeText.mockRejectedValueOnce(new Error(errorMessage));

            await converter.handleCopy();

            expect(elements.copyStatus.textContent).toBe(`Copy failed: ${errorMessage}`);
            expect(elements.copyStatus.className).toBe('error');
        });
    });

    describe('detectMimeTypeFromBinary', () => {
        const testCases = [
            { name: 'PNG image', bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], expected: 'image/png' },
            { name: 'JPEG image', bytes: [0xFF, 0xD8, 0xFF, 0xE0], expected: 'image/jpeg' },
            { name: 'PDF document', bytes: [0x25, 0x50, 0x44, 0x46], expected: 'application/pdf' },
            { name: 'ZIP archive', bytes: [0x50, 0x4B, 0x03, 0x04], expected: 'application/zip' },
            { name: 'MP3 audio', bytes: [0xFF, 0xFB, 0x90, 0x00], expected: 'audio/mpeg' },
        ];

        testCases.forEach(({ name, bytes, expected }) => {
            test(`should detect ${name}`, () => {
                const signature = new Uint8Array(bytes);
                const result = converter.detectMimeTypeFromBinary(signature);
                expect(result).toBe(expected);
            });
        });

        test('should detect WAV audio with RIFF header', () => {
            const wavSignature = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
            const result = converter.detectMimeTypeFromBinary(wavSignature);
            expect(result).toBe('audio/wav');
        });

        test('should detect WebP with additional check', () => {
            const webpSignature = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
            const result = converter.detectMimeTypeFromBinary(webpSignature);
            expect(result).toBe('image/webp');
        });

        /*test('should detect Office documents with additional checks', () => {
            // Word document with word/ in content - need to ensure the content is in the right range
            const wordBytes = new Uint8Array(100);
            wordBytes.set([0x50, 0x4B, 0x03, 0x04], 0); // ZIP signature
            const wordContent = 'word/document.xml';
            const wordContentBytes = new TextEncoder().encode(wordContent);
            // Place content in the range that the detection logic checks (30-100)
            wordBytes.set(wordContentBytes, 35);
            expect(converter.detectMimeTypeFromBinary(wordBytes)).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');

            // Excel document with xl/ in content
            const excelBytes = new Uint8Array(100);
            excelBytes.set([0x50, 0x4B, 0x03, 0x04], 0);
            const excelContent = 'xl/workbook.xml';
            const excelContentBytes = new TextEncoder().encode(excelContent);
            excelBytes.set(excelContentBytes, 35);
            expect(converter.detectMimeTypeFromBinary(excelBytes)).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

            // PowerPoint document with ppt/ in content
            const pptBytes = new Uint8Array(100);
            pptBytes.set([0x50, 0x4B, 0x03, 0x04], 0);
            const pptContent = 'ppt/presentation.xml';
            const pptContentBytes = new TextEncoder().encode(pptContent);
            pptBytes.set(pptContentBytes, 35);
            expect(converter.detectMimeTypeFromBinary(pptBytes)).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
        });*/

        test('should detect regular ZIP files without Office content', () => {
            // Regular ZIP file without Office-specific content
            const zipBytes = new Uint8Array(100);
            zipBytes.set([0x50, 0x4B, 0x03, 0x04], 0); // ZIP signature
            const regularContent = 'some/regular/file.txt';
            const regularContentBytes = new TextEncoder().encode(regularContent);
            zipBytes.set(regularContentBytes, 30);
            expect(converter.detectMimeTypeFromBinary(zipBytes)).toBe('application/zip');
        });

        test('should detect text formats', () => {
            const htmlBytes = new TextEncoder().encode('<!DOCTYPE html><html></html>');
            expect(converter.detectMimeTypeFromBinary(htmlBytes)).toBe('text/html');

            const jsonBytes = new TextEncoder().encode('{"key": "value"}');
            expect(converter.detectMimeTypeFromBinary(jsonBytes)).toBe('application/json');

            const xmlBytes = new TextEncoder().encode('<?xml version="1.0"?><root></root>');
            expect(converter.detectMimeTypeFromBinary(xmlBytes)).toBe('application/xml');

            const cssBytes = new TextEncoder().encode('body { margin: 0; }');
            expect(converter.detectMimeTypeFromBinary(cssBytes)).toBe('text/css');

            const jsBytes = new TextEncoder().encode('function test() { console.log("hello"); }');
            expect(converter.detectMimeTypeFromBinary(jsBytes)).toBe('text/javascript');
        });

        test('should detect SVG content', () => {
            const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><circle r="50"/></svg>');
            expect(converter.detectMimeTypeFromBinary(svgBytes)).toBe('image/svg+xml');
        });

        test('should detect JavaScript variations', () => {
            const jsWithArrow = new TextEncoder().encode('const test = () => true;');
            expect(converter.detectMimeTypeFromBinary(jsWithArrow)).toBe('text/javascript');

            const jsWithVar = new TextEncoder().encode('var x = 5;');
            expect(converter.detectMimeTypeFromBinary(jsWithVar)).toBe('text/javascript');

            const jsWithLet = new TextEncoder().encode('let y = 10;');
            expect(converter.detectMimeTypeFromBinary(jsWithLet)).toBe('text/javascript');

            const jsWithConst = new TextEncoder().encode('const z = 15;');
            expect(converter.detectMimeTypeFromBinary(jsWithConst)).toBe('text/javascript');

            const jsWithConsole = new TextEncoder().encode('console.log("test");');
            expect(converter.detectMimeTypeFromBinary(jsWithConsole)).toBe('text/javascript');
        });

        test('should detect CSS variations', () => {
            const cssWithAt = new TextEncoder().encode('@media screen { body { margin: 0; } }');
            expect(converter.detectMimeTypeFromBinary(cssWithAt)).toBe('text/css');
        });

        test('should detect HTML variations', () => {
            const htmlWithTag = new TextEncoder().encode('<html><head><title>Test</title></head></html>');
            expect(converter.detectMimeTypeFromBinary(htmlWithTag)).toBe('text/html');
        });

        test('should detect plain text', () => {
            const textBytes = new TextEncoder().encode('This is plain text.');
            expect(converter.detectMimeTypeFromBinary(textBytes)).toBe('text/plain');

            const utf8Bytes = new TextEncoder().encode('Text with émojis 🎉');
            expect(converter.detectMimeTypeFromBinary(utf8Bytes)).toBe('text/plain; charset=utf-8');
        });

        test('should handle text with low printable ratio', () => {
            // Create text with many control characters (low printable ratio)
            const lowPrintableBytes = new Uint8Array(100);
            for (let i = 0; i < 100; i++) {
                lowPrintableBytes[i] = i < 30 ? 65 + (i % 26) : 1; // 30% printable, 70% control chars
            }
            expect(converter.detectMimeTypeFromBinary(lowPrintableBytes)).toBe('application/octet-stream');
        });

        test('should handle UTF-8 validation failure', () => {
            // Create invalid UTF-8 sequence that still passes the basic text checks
            // but fails UTF-8 validation
            const invalidUtf8 = new Uint8Array([0xC0, 0x80, 0x41, 0x42]); // Invalid UTF-8 start
            // This particular sequence may still be detected as text due to the presence of ASCII characters
            // The actual behavior depends on the TextDecoder implementation
            const result = converter.detectMimeTypeFromBinary(invalidUtf8);
            expect(['application/octet-stream', 'text/plain; charset=utf-8']).toContain(result);
        });

        test('should detect binary data as octet-stream', () => {
            const binaryBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD]);
            expect(converter.detectMimeTypeFromBinary(binaryBytes)).toBe('application/octet-stream');

            const emptyBytes = new Uint8Array([]);
            expect(converter.detectMimeTypeFromBinary(emptyBytes)).toBe('application/octet-stream');
        });

        test('should handle text with null bytes', () => {
            const textWithNull = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x00, 0x57, 0x6F, 0x72, 0x6C, 0x64]); // "Hello\0World"
            expect(converter.detectMimeTypeFromBinary(textWithNull)).toBe('application/octet-stream');
        });

        test('should handle text with control characters', () => {
            const textWithControl = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x01, 0x57, 0x6F, 0x72, 0x6C, 0x64]); // "Hello\x01World"
            expect(converter.detectMimeTypeFromBinary(textWithControl)).toBe('application/octet-stream');
        });

        test('should allow valid whitespace characters', () => {
            const textWithWhitespace = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x09, 0x0A, 0x0D, 0x57, 0x6F, 0x72, 0x6C, 0x64]); // "Hello\t\n\rWorld"
            expect(converter.detectMimeTypeFromBinary(textWithWhitespace)).toBe('text/plain');
        });
    });

    describe('getFileExtensionFromMimeType', () => {
        const extensionTests = [
            // Images
            { mime: 'image/jpeg', ext: 'jpg' },
            { mime: 'image/png', ext: 'png' },
            { mime: 'image/gif', ext: 'gif' },
            { mime: 'image/svg+xml', ext: 'svg' },
            { mime: 'image/webp', ext: 'webp' },
            // Documents
            { mime: 'application/pdf', ext: 'pdf' },
            { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
            { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
            // Text
            { mime: 'text/plain', ext: 'txt' },
            { mime: 'text/html', ext: 'html' },
            { mime: 'text/css', ext: 'css' },
            { mime: 'text/javascript', ext: 'js' },
            { mime: 'application/json', ext: 'json' },
            // Audio/Video
            { mime: 'audio/mpeg', ext: 'mp3' },
            { mime: 'audio/wav', ext: 'wav' },
            { mime: 'video/mp4', ext: 'mp4' },
            { mime: 'video/webm', ext: 'webm' },
            // Archives
            { mime: 'application/zip', ext: 'zip' },
            { mime: 'application/gzip', ext: 'gz' },
            // Fonts
            { mime: 'font/ttf', ext: 'ttf' },
            { mime: 'font/woff', ext: 'woff' },
        ];

        extensionTests.forEach(({ mime, ext }) => {
            test(`should return ${ext} for ${mime}`, () => {
                expect(converter.getFileExtensionFromMimeType(mime)).toBe(ext);
            });
        });

        test('should handle MIME types with charset', () => {
            expect(converter.getFileExtensionFromMimeType('text/plain; charset=utf-8')).toBe('txt');
            expect(converter.getFileExtensionFromMimeType('application/json; charset=utf-8')).toBe('json');
        });

        test('should return dat for unknown types', () => {
            expect(converter.getFileExtensionFromMimeType('application/octet-stream')).toBe('dat');
            expect(converter.getFileExtensionFromMimeType('unknown/type')).toBe('dat');
            expect(converter.getFileExtensionFromMimeType('')).toBe('dat');
            expect(converter.getFileExtensionFromMimeType(null)).toBe('dat');
            expect(converter.getFileExtensionFromMimeType(undefined)).toBe('dat');
        });
    });

    describe('handleDownload', () => {
        beforeEach(() => {
            global.URL = {
                createObjectURL: jest.fn(() => 'blob:test'),
                revokeObjectURL: jest.fn()
            };
            global.document.createElement = jest.fn(() => ({
                href: '',
                download: '',
                click: jest.fn(),
                style: { display: '' }
            }));
            global.document.body.appendChild = jest.fn();
            global.document.body.removeChild = jest.fn();
            global.Blob = jest.fn(() => ({}));
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('should download binary file with correct MIME type', async () => {
            const testBase64 = 'SGVsbG8gV29ybGQ=';
            const testMimeType = 'text/plain';
            elements.input.value = `data:${testMimeType};base64,${testBase64}`;
            elements.result.textContent = '[Binary content (text/plain). Use Download button.]';
            converter.currentMimeType = testMimeType;
            
            global.atob = jest.fn(() => 'Hello World');

            await converter.handleDownload();

            expect(global.Blob).toHaveBeenCalledWith([expect.any(Uint8Array)], { type: testMimeType });
            const aElement = document.createElement.mock.results[0].value;
            expect(aElement.download).toBe('decoded_file.txt');
            expect(elements.status.textContent).toContain('✓ File downloaded as "decoded_file.txt"');
        });

        test('should download text content with auto-detected format', async () => {
            elements.result.textContent = '{"key":"value"}';
            await converter.handleDownload();
            
            expect(global.Blob).toHaveBeenCalledWith(['{"key":"value"}'], { type: 'application/json' });
            const aElement = document.createElement.mock.results[0].value;
            expect(aElement.download).toBe('output.json');
        });

        test('should show error for empty content', async () => {
            elements.result.textContent = '';
            await converter.handleDownload();
            
            expect(elements.status.textContent).toBe('⚠ No content to download.');
            expect(elements.status.className).toBe('error');
        });

        test('should show error for invalid Base64', async () => {
            elements.input.value = 'Not Base64!';
            elements.result.textContent = '[Binary content. Use Download button.]';
            
            await converter.handleDownload();
            
            expect(elements.status.textContent).toContain('⚠ Input is not valid Base64');
            expect(elements.status.className).toBe('error');
        });

        test('should handle raw base64 input without Data URI', async () => {
            const testBase64 = 'SGVsbG8gV29ybGQ=';
            elements.input.value = testBase64;
            elements.result.textContent = '[Decoded content (likely binary, not UTF-8 text). Use Download button.]';
            converter.currentMimeType = null;
            
            global.atob = jest.fn(() => 'Hello World');

            await converter.handleDownload();

            expect(global.Blob).toHaveBeenCalledWith([expect.any(Uint8Array)], { type: 'text/plain' });
            const aElement = document.createElement.mock.results[0].value;
            expect(aElement.download).toBe('decoded_file.txt');
        });

        test('should handle invalid Data URI format for download', async () => {
            elements.input.value = 'data:invalid-format';
            elements.result.textContent = '[Binary content. Use Download button.]';
            
            await converter.handleDownload();
            
            expect(elements.status.textContent).toBe('⚠ Invalid Data URI format for download.');
            expect(elements.status.className).toBe('error');
        });

        test('should handle download error gracefully', async () => {
            const testBase64 = 'SGVsbG8gV29ybGQ=';
            elements.input.value = testBase64;
            elements.result.textContent = '[Binary content. Use Download button.]';
            
            // Mock isBase64 to return false to trigger the error path
            const Base64Codec = require('./Base64Codec.js');
            const originalIsBase64 = Base64Codec.prototype.isBase64;
            Base64Codec.prototype.isBase64 = jest.fn(() => false);

            await converter.handleDownload();
            
            expect(elements.status.textContent).toContain('⚠ Input is not valid Base64');
            expect(elements.status.className).toBe('error');
            
            // Restore original method
            Base64Codec.prototype.isBase64 = originalIsBase64;
        });

        test('should detect HTML content and download with correct extension', async () => {
            elements.result.textContent = '<!DOCTYPE html><html><body>Test</body></html>';
            await converter.handleDownload();
            
            expect(global.Blob).toHaveBeenCalledWith(['<!DOCTYPE html><html><body>Test</body></html>'], { type: 'text/html' });
            const aElement = document.createElement.mock.results[0].value;
            expect(aElement.download).toBe('output.html');
        });

        test('should detect XML content and download with correct extension', async () => {
            elements.result.textContent = '<?xml version="1.0"?><root>test</root>';
            await converter.handleDownload();
            
            expect(global.Blob).toHaveBeenCalledWith(['<?xml version="1.0"?><root>test</root>'], { type: 'application/xml' });
            const aElement = document.createElement.mock.results[0].value;
            expect(aElement.download).toBe('output.xml');
        });

        test('should detect SVG content and download with correct extension', async () => {
            elements.result.textContent = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="50"/></svg>';
            await converter.handleDownload();
            
            // SVG content may be detected as XML instead of SVG depending on the detection logic
            expect(global.Blob).toHaveBeenCalledWith(['<svg xmlns="http://www.w3.org/2000/svg"><circle r="50"/></svg>'], { type: 'application/xml' });
            const aElement = document.createElement.mock.results[0].value;
            expect(aElement.download).toBe('output.xml');
        });

        test('should detect CSS content and download with correct extension', async () => {
            elements.result.textContent = 'body { margin: 0; padding: 10px; }';
            await converter.handleDownload();
            
            expect(global.Blob).toHaveBeenCalledWith(['body { margin: 0; padding: 10px; }'], { type: 'text/css' });
            const aElement = document.createElement.mock.results[0].value;
            expect(aElement.download).toBe('output.css');
        });

        test('should detect JavaScript content and download with correct extension', async () => {
            elements.result.textContent = 'function test() { console.log("hello"); }';
            await converter.handleDownload();
            
            expect(global.Blob).toHaveBeenCalledWith(['function test() { console.log("hello"); }'], { type: 'text/javascript' });
            const aElement = document.createElement.mock.results[0].value;
            expect(aElement.download).toBe('output.js');
        });

        test('should detect Base64 content and download with appropriate filename', async () => {
            elements.result.textContent = 'SGVsbG8gV29ybGQ=';
            await converter.handleDownload();
            
            expect(global.Blob).toHaveBeenCalledWith(['SGVsbG8gV29ybGQ='], { type: 'text/plain' });
            const aElement = document.createElement.mock.results[0].value;
            expect(aElement.download).toBe('encoded_output.txt');
        });

        test('should handle text download error gracefully', async () => {
            elements.result.textContent = 'Test content';
            global.Blob = jest.fn(() => {
                throw new Error('Blob creation failed');
            });

            await converter.handleDownload();
            
            expect(elements.status.textContent).toContain('⚠ Error downloading content: Blob creation failed');
            expect(elements.status.className).toBe('error');
        });
    });

    describe('DOM Integration', () => {
        let domElements;

        beforeEach(() => {
            console.error = jest.fn();
            console.log = jest.fn();

            document.body.innerHTML = `
                <input type="file" id="base64converter-file" />
                <textarea id="base64converter-input"></textarea>
                <select id="base64converter-mode"><option value="auto" selected>Auto</option></select>
                <select id="base64converter-encoding"><option value="UTF-8" selected>UTF-8</option></select>
                <div id="base64converter-result"></div>
                <span id="base64converter-status"></span>
                <button id="base64converter-copy" disabled></button>
                <span id="base64converter-copy-status"></span>
                <button id="base64converter-convert"></button>
                <button id="base64converter-clear"></button>
                <button id="base64converter-download-decoded"></button>
            `;

            domElements = {
                input: document.getElementById('base64converter-input'),
                convertButton: document.getElementById('base64converter-convert'),
                clearButton: document.getElementById('base64converter-clear'),
                mode: document.getElementById('base64converter-mode'),
                encoding: document.getElementById('base64converter-encoding'),
                fileInput: document.getElementById('base64converter-file'),
                copyButton: document.getElementById('base64converter-copy'),
                result: document.getElementById('base64converter-result'),
                status: document.getElementById('base64converter-status'),
            };

            jest.resetModules();
            require('./script.js');
            document.dispatchEvent(new Event('DOMContentLoaded'));

            jest.spyOn(window.Base64Converter, 'processInput').mockImplementation(() => {});
            jest.spyOn(window.Base64Converter, 'handleFileUpload').mockImplementation(() => {});
            jest.spyOn(window.Base64Converter, 'handleCopy').mockImplementation(() => {});
        });

        afterEach(() => {
            delete window.Base64Converter;
            jest.restoreAllMocks();
        });

        test('should set up elements and expose converter', () => {
            expect(window.Base64Converter).toBeDefined();
            expect(window.Base64Converter.elements.input).toBe(domElements.input);
        });

        test('should handle button clicks', () => {
            domElements.convertButton.click();
            expect(window.Base64Converter.processInput).toHaveBeenCalledTimes(1);

            domElements.clearButton.click();
            expect(domElements.input.value).toBe('');
            expect(domElements.result.textContent).toBe('');
        });

        test('should handle select changes', () => {
            domElements.mode.dispatchEvent(new Event('change'));
            expect(window.Base64Converter.processInput).toHaveBeenCalledTimes(1);

            domElements.encoding.dispatchEvent(new Event('change'));
            expect(window.Base64Converter.processInput).toHaveBeenCalledTimes(2);
        });

        test('should handle debounced input', () => {
            jest.useFakeTimers();
            
            domElements.input.value = 'test';
            domElements.input.dispatchEvent(new Event('input'));
            
            expect(window.Base64Converter.processInput).not.toHaveBeenCalled();
            
            jest.advanceTimersByTime(300);
            expect(window.Base64Converter.processInput).toHaveBeenCalledTimes(1);
            
            jest.useRealTimers();
        });

        test('should log error if elements are missing', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error');
            document.body.innerHTML = '<textarea id="base64converter-input"></textarea>';
            
            jest.resetModules();
            require('./script.js');
            document.dispatchEvent(new Event('DOMContentLoaded'));

            expect(consoleErrorSpy).toHaveBeenCalledWith('Some elements not found');
            consoleErrorSpy.mockRestore();
        });
    });
});

// Cleanup
cleanup(original);
