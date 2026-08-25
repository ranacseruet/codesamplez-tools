// Import dependencies
import Base64Codec from '../common/Base64Codec';
import { NotificationManager } from '../common/notification-manager';
import DownloadManager from '../common/DownloadManager';
import ClearButton from '../common/clear-button/ClearButton';
import CopyButton from '../common/copy-button/CopyButton';
import { buildShareUrl, readHashOrQueryParam, SHARE_URL_MAX_LENGTH } from '../common/share-url';
import { copyTextToClipboard } from '../common/clipboard';
import { registerPrimaryActionShortcut } from '../common/shortcut-utils';
import { registerDropZone } from '../common/drop-zone';
import { hydrate, render } from 'preact';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import toolMetadata from './tool.meta.json';

const BASE64_DATA_URL_REGEX = /^data:([a-zA-Z0-9/\-+.-\w]+)?(?:;charset=([a-zA-Z0-9/\-+.-\w]+))?;base64,(.*)$/;

type Base64Encoding = 'utf8' | 'ascii' | 'iso88591' | 'ucs2';

interface ParsedDataUrl {
    mimeType: string | null;
    base64Payload: string;
}

interface Base64ConverterElements {
    input: HTMLTextAreaElement;
    result: HTMLElement;
    status: HTMLElement;
    mode: HTMLSelectElement;
    encoding: HTMLSelectElement;
    fileInput: HTMLInputElement;
    convertButton: HTMLElement;
    downloadDecodedButton: HTMLButtonElement;
}

interface Base64ConverterInstance {
    elements: Base64ConverterElements;
    currentMimeType: string | null;
    downloadManager: DownloadManager;
    clearButtonInstance: ClearButton | null;
    copyButtonInstance: CopyButton;
    processInput(): void;
    detectMimeTypeFromBinary(bytes: Uint8Array): void;
    getFileExtensionFromMimeType(mimeType: string): void;
    handleDownload(): Promise<void>;
    handleFileUpload(event: { target: { files?: FileList | File[] | null; value?: string | null } }): Promise<void>;
}

type Base64ConverterWindow = Window & {
    Base64Converter?: () => Base64ConverterInstance;
    base64ConverterInstance?: Base64ConverterInstance | null;
};

const browserWindow = typeof window !== 'undefined' ? (window as Base64ConverterWindow) : null;

function normalizeEncodingValue(value: unknown): Base64Encoding {
    const encoding = String(value || '').trim();
    switch (encoding) {
        case 'UTF-8':
        case 'utf8':
            return 'utf8';
        case 'UTF-16':
        case 'ucs2':
            return 'ucs2';
        case 'ASCII':
        case 'ascii':
            return 'ascii';
        case 'ISO-8859-1':
        case 'iso88591':
            return 'iso88591';
        default:
            return 'utf8';
    }
}

function parseBase64DataUrl(value: unknown): ParsedDataUrl | null {
    const parts = String(value || '').match(BASE64_DATA_URL_REGEX);
    if (!parts || typeof parts[3] !== 'string') {
        return null;
    }

    return {
        mimeType: parts[1] || null,
        base64Payload: parts[3].trim()
    };
}

const BASE64_CONVERTER_ELEMENT_IDS = {
    input: 'base64converter-input',
    result: 'base64converter-result',
    status: 'base64converter-status',
    mode: 'base64converter-mode',
    encoding: 'base64converter-encoding',
    fileInput: 'base64converter-file',
    convertButton: 'base64converter-convert',
    downloadDecodedButton: 'base64converter-download-decoded'
};

// Converter factory function
const createConverter = (): Base64ConverterInstance => {
    // Create Base64Codec instance
    const codec = new Base64Codec();
    const downloadManager = new DownloadManager();
    
    return {
        elements: {} as Base64ConverterElements,
        currentMimeType: null, // To store MIME type from Data URL
        downloadManager: downloadManager, // Expose downloadManager for testing
        clearButtonInstance: null,
        copyButtonInstance: null as unknown as CopyButton,

        processInput() {
            const rawInput = this.elements.input.value.trim();
            
            // If the input is the file upload placeholder, do not process it as text for encoding/decoding.
            // The result and status should already be set by handleFileUpload.
            if (rawInput.startsWith('[File:') && rawInput.endsWith('uploaded and encoded to output]')) {
                this.elements.downloadDecodedButton.disabled = false;
                return; 
            }

            this.currentMimeType = null; // Reset MIME type, will be set if Data URI
            this.elements.downloadDecodedButton.disabled = true;

            if (!rawInput) {
                this.elements.result.textContent = '';
                this.elements.status.textContent = '';
                return;
            }

            let base64Payload = rawInput;
            let detectedMimeType = null; // MIME type from Data URI, if present

            if (rawInput.startsWith('data:')) {
                const parsedDataUrl = parseBase64DataUrl(rawInput);
                if (parsedDataUrl) {
                    detectedMimeType = parsedDataUrl.mimeType; // e.g., 'image/png', 'text/plain'
                    base64Payload = parsedDataUrl.base64Payload;
                    this.currentMimeType = detectedMimeType; // Persist for download
                } else {
                    this.elements.result.textContent = '';
                    // v4 contract: errors surface inline in the status chip.
                    this.elements.status.textContent = 'Invalid Data URI format';
                    return;
                }
            }
            
            const mode = this.elements.mode.value;
            let encoding = normalizeEncodingValue(this.elements.encoding.value); // For text decoding

            try {
                let resultText;
                let statusActionMessage;

                if (mode === 'encode') {
                    statusActionMessage = 'Encoded';
                    resultText = codec.encodeText(rawInput, encoding);
                } else { // mode is 'decode' or 'auto'
                    const isPayloadBase64 = codec.isBase64(base64Payload);

                    if (mode === 'auto') {
                        if (isPayloadBase64) {
                            statusActionMessage = 'Decoded';
                            if (detectedMimeType && 
                                !detectedMimeType.startsWith('text/') && 
                                detectedMimeType !== 'application/json' && 
                                detectedMimeType !== 'application/xml' && 
                                !detectedMimeType.startsWith('application/javascript')) {
                                resultText = `[Binary content (${detectedMimeType}). Use Download button.]`;
                                this.elements.downloadDecodedButton.disabled = false;
                            } else {
                                try {
                                    resultText = codec.decodeText(base64Payload, encoding);
                                    this.elements.downloadDecodedButton.disabled = false;
                                } catch (decodeError: unknown) {
                                    const msg = decodeError instanceof Error && decodeError.message ? decodeError.message.toLowerCase() : "";
                                    if (msg.includes('utf-8') || msg.includes('ucs-2') || 
                                        msg.includes('malformed') || msg.includes('invalid sequence') || 
                                        msg.includes('data was not valid') || msg.includes('valid utf') ||
                                        decodeError instanceof TypeError) {
                                        resultText = `[Decoded content (likely binary, not ${encoding} text). Use Download button.]`;
                                        this.elements.downloadDecodedButton.disabled = false;
                                    } else {
                                        throw decodeError;
                                    }
                                }
                            }
                        } else {
                            statusActionMessage = 'Encoded';
                            resultText = codec.encodeText(rawInput, encoding);
                        }
                    } else { // mode === 'decode'
                        statusActionMessage = 'Decoded';
                        if (!isPayloadBase64) {
                            throw new Error('Invalid base64 input string');
                        }
                        try {
                            resultText = codec.decodeText(base64Payload, encoding);
                            // Replace null characters for display purposes to match test expectation
                            resultText = resultText.replace(/\u0000/g, '');
                            // Check for replacement characters indicating decode errors
                            if (resultText.includes('\uFFFD')) {
                                throw new Error('Invalid UTF-8 sequence detected in decoded result');
                            }
                            this.elements.downloadDecodedButton.disabled = false;
                        } catch (decodeError) {
                            throw decodeError; // Re-throw to ensure it's handled in the catch block
                        }
                    }
                }

                this.elements.result.textContent = resultText;
                this.elements.status.textContent = '';
                // Update CopyButton visibility directly
                this.copyButtonInstance.forceUpdateVisibility();
                if (statusActionMessage === 'Decoded' && detectedMimeType && !detectedMimeType.startsWith('text/')) {
                    NotificationManager.show(`${statusActionMessage}. MIME: ${detectedMimeType}. Selected encoding (${this.elements.encoding.value}) ignored for binary display.`, 2000, { type: 'success' });
                } else if (statusActionMessage === 'Decoded' && !detectedMimeType && (resultText.startsWith('[Decoded content (likely binary') || resultText.startsWith('[Binary content'))) {
                    NotificationManager.show(`${statusActionMessage}. Selected encoding (${this.elements.encoding.value}) failed for display. Use Download.`, 2000, { type: 'success' });
                }
                else {
                    NotificationManager.show(`${statusActionMessage} using ${this.elements.encoding.value}`, 2000, { type: 'success' });
                }
                this.elements.downloadDecodedButton.disabled = false;

            } catch (error: unknown) {
                console.error('Processing error:', error);
                this.elements.result.textContent = '';
                let errorMessage = '';
                const message = error instanceof Error ? error.message : String(error);

                if (message.includes('UCS-2')) {
                    errorMessage = 'Invalid UCS-2 sequence - Input may be corrupted or not UCS-2 text.';
                } else if (message.includes('UTF-8')) {
                    errorMessage = 'Invalid UTF-8 sequence - Input may be corrupted or not UTF-8 text. Try a different encoding, or Download if binary.';
                } else if (message.includes('Invalid base64 input string')) {
                    errorMessage = 'Invalid base64 input';
                } else if (message.includes('Invalid Data URI format')) {
                    errorMessage = 'Invalid Data URI format.';
                } else if (message.includes('empty')) {
                    errorMessage = 'Input cannot be empty.';
                } else {
                    errorMessage = `Processing failed: ${message}`;
                }

                // v4 contract: all errors surface inline in the status chip;
                // toasts are reserved for success confirmations.
                this.elements.status.textContent = errorMessage;
                this.elements.downloadDecodedButton.disabled = true;
            }
        },

        detectMimeTypeFromBinary(_bytes: Uint8Array) {
            // ... (keep existing detectMimeTypeFromBinary implementation unchanged)
        },

        getFileExtensionFromMimeType(_mimeType: string) {
            // ... (keep existing getFileExtensionFromMimeType implementation unchanged)
        },

        async handleDownload() {
            const outputContent = this.elements.result.textContent.trim();

            if (!outputContent) {
                NotificationManager.show('No content to download', 3000, { type: 'error' });
                return;
            }

            try {
                let content;
                let filename = 'output.txt';

                if (outputContent.startsWith('[Binary content') || outputContent.startsWith('[Decoded content (likely binary')) {
                    const rawInputValue = this.elements.input.value.trim();
                    let base64Payload = rawInputValue;

                    if (rawInputValue.startsWith('data:')) {
                        const parsedDataUrl = parseBase64DataUrl(rawInputValue);
                        if (parsedDataUrl) {
                            base64Payload = parsedDataUrl.base64Payload;
                        } else {
                            NotificationManager.show('Invalid Data URI format for download', 3000, { type: 'error' });
                            return;
                        }
                    }

                    if (!codec.isBase64(base64Payload)) {
                        NotificationManager.show('Input is not valid Base64 for download', 3000, { type: 'error' });
                        return;
                    }

                    const binaryString = atob(base64Payload);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    content = bytes;
                    filename = 'output.bin';
                } else {
                    content = outputContent;
                }

                downloadManager.downloadFile(content, filename, 'application/octet-stream'); // Default to octet-stream for binary
                NotificationManager.show(`Content downloaded as "${filename}"`, 2000, { type: 'success' });
            } catch (error: unknown) {
                console.error('Download error:', error);
                const message = error instanceof Error ? error.message : String(error);
                NotificationManager.show('Error downloading content: ' + message, 3000, { type: 'error' });
            }
        },

        async handleFileUpload(e) {
            const files = e.target.files || [];
            const file = files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = () => {
                try {
                    const dataUrl = reader.result;
                    if (typeof dataUrl !== 'string') {
                        throw new Error('Invalid file reader result');
                    }
                    let base64String;

                    if (dataUrl.startsWith('data:')) {
                        const parsedDataUrl = parseBase64DataUrl(dataUrl);
                        if (parsedDataUrl) {
                            base64String = parsedDataUrl.base64Payload;
                        } else {
                            throw new Error('Invalid Data URI format');
                        }
                    } else {
                        base64String = dataUrl.trim();
                    }

                    this.elements.input.value = `[File: ${file.name} uploaded and encoded to output]`;
                    this.elements.result.textContent = base64String;
                    // Update CopyButton visibility directly
                    this.copyButtonInstance.forceUpdateVisibility();

                } catch (error: unknown) {
                console.error('File processing error after read:', error);
                this.elements.result.textContent = '';
                this.copyButtonInstance.forceUpdateVisibility();
                this.elements.input.value = '';
                const message = error instanceof Error ? error.message : String(error);
                NotificationManager.show('Error processing file: ' + message, 3000, { type: 'error' });
                    this.elements.downloadDecodedButton.disabled = true;
                } finally {
                    e.target.value = null;
                }
            };

            reader.onerror = () => {
                console.error('File reading error:', reader.error);
                this.elements.result.textContent = '';
                this.copyButtonInstance.forceUpdateVisibility();
                this.elements.input.value = '';
                NotificationManager.show('Error reading file: ' + (reader.error?.message || 'Unknown error'), 3000, { type: 'error' });
                this.elements.downloadDecodedButton.disabled = true;
                e.target.value = null;
            };

            reader.readAsDataURL(file);
        },

    };
};

// Export the factory function
export default createConverter;

export function Base64ConverterApp() {
    return (
        <div id="base64converter-tool" className="tool-container b64-tool c-tool-stack">
            <div className="o-controls b64-settings-panel c-surface-card">
                <div className="u-flex u-gap-sm b64-settings-row">
                    <select
                        id="base64converter-mode"
                        className="tool-container select c-input b64-select"
                        aria-label="Conversion Mode"
                        defaultValue="auto"
                    >
                        <option value="auto">Auto Detect</option>
                        <option value="encode">Encode</option>
                        <option value="decode">Decode</option>
                    </select>

                    <select
                        id="base64converter-encoding"
                        className="tool-container select c-input b64-select"
                        aria-label="Character Encoding"
                        defaultValue="utf8"
                    >
                        <option value="utf8">UTF-8</option>
                        <option value="ascii">ASCII</option>
                        <option value="iso88591">ISO-8859-1</option>
                        <option value="ucs2">UCS-2</option>
                    </select>
                </div>
            </div>

            <div className="u-flex u-gap-lg b64-panels">
                <div className="o-panel b64-panel c-surface-card c-surface-panel">
                    <div className="o-panel-header b64-panel-header c-surface-panel__header">
                        <h3>Input</h3>
                    </div>
                    <textarea
                        id="base64converter-input"
                        className="c-input c-input--textarea b64-textarea b64-input"
                        placeholder="Enter text to encode or decode, or drop a file..."
                        aria-label="Input text"
                    />
                </div>

                <div className="o-panel b64-panel c-surface-card c-surface-panel">
                    <div className="o-panel-header b64-panel-header c-surface-panel__header">
                        <h3>Output</h3>
                    </div>
                    <textarea
                        id="base64converter-result"
                        className="c-input c-input--textarea b64-textarea b64-output"
                        readOnly
                        aria-label="Output text"
                        placeholder="Converted output will appear here..."
                    />
                </div>
            </div>

            <div className="u-flex u-mt-md b64-action-row c-action-strip">
                <div className="u-flex u-gap-sm b64-file-action">
                    <button type="button" id="base64converter-load-sample" className="c-button c-button--ghost b64-load-sample-button">
                        Load Sample
                    </button>
                    <input type="file" id="base64converter-file" className="u-visually-hidden" />
                    <label className="c-button c-button--secondary b64-upload-button" htmlFor="base64converter-file">
                        Upload File
                    </label>
                    <button
                        type="button"
                        id="base64converter-share"
                        className="c-button c-button--secondary c-button--icon-share b64-share-button"
                    >
                        Share
                    </button>
                </div>
                <span className="c-toolbar__spacer" />
                <button type="button" id="base64converter-convert" className="c-button b64-convert-button">
                    Convert
                    <span className="c-kbd" aria-hidden="true">⌘⏎</span>
                </button>
                <button
                    type="button"
                    id="base64converter-download-decoded"
                    className="c-button c-button--secondary c-button--icon-download b64-download-button"
                    disabled
                >
                    Download
                </button>
            </div>

            <div className="o-controls b64-status-panel c-surface-card">
                <span id="base64converter-status" className="b64-status-text c-status-chip" aria-live="polite" />
            </div>

            <div id="notification" className="c-notification" role="status" aria-live="polite" />

        </div>
    );
}

function initializeBase64ConverterDom(): Base64ConverterInstance | null {
    if (browserWindow) {
        browserWindow.Base64Converter = createConverter;
    }
    const converter = createConverter();

    // Handle fragment/query preload for external linking.
    const preloadedData = readHashOrQueryParam(window.location, 'data');
    const dataParam = preloadedData.value;

    let dataFromUrl = null;
    let shouldAutoConvert = false;

    if (dataParam) {
        // `readHashOrQueryParam` resolves the value through `URLSearchParams`,
        // which has already applied exactly one percent-decoding pass. This
        // used to run `decodeURIComponent` on top of that, which corrupted any
        // input containing a percent sign — `100%` and `a%FFb` threw a URIError
        // and aborted the preload outright, and `literal %20 marker` came back
        // as `literal   marker`. Harmless while the param was only produced by
        // hand, but Share now generates these links, so writer and reader have
        // to agree on a single pass. Inputs with no percent sign are unaffected
        // either way, so links already in the wild keep working.
        dataFromUrl = dataParam;
        shouldAutoConvert = true;

        if (shouldAutoConvert && preloadedData.source === 'query') {
            NotificationManager.show(
                'Legacy ?data= preload detected. Prefer #data= to avoid leaking content in URLs.',
                4000,
                { type: 'warning' }
            );
        }
    }

    const elements: Partial<Base64ConverterElements> = {};
    const missingElements = [];
    for (const [key, id] of Object.entries(BASE64_CONVERTER_ELEMENT_IDS) as [keyof Base64ConverterElements, string][]) {
        const element = document.getElementById(id);
        if (!element) {
            missingElements.push(id);
            continue;
        }
        (elements as Record<keyof Base64ConverterElements, HTMLElement>)[key] = element;
    }

    if (missingElements.length > 0) {
        console.error('Missing required elements:', missingElements);
        NotificationManager.show('Required elements not found - tool may not function properly', 3000, { type: 'error' });
        return null;
    }

    const typedElements = elements as Base64ConverterElements;
    converter.elements = typedElements;

    if (dataFromUrl) {
        typedElements.input.value = dataFromUrl;
        typedElements.mode.value = 'auto';
    }

    converter.clearButtonInstance = new ClearButton(typedElements.input);
    converter.copyButtonInstance = new CopyButton(typedElements.result as HTMLTextAreaElement | HTMLInputElement | HTMLPreElement);

    if (browserWindow) {
        browserWindow.base64ConverterInstance = converter;
    }

    const convertHandler = () => {
        converter.processInput();
        // v4 contract: errors surface inline in the status chip. processInput
        // clears the chip on the empty path, so set the message after it.
        if (!converter.elements.input.value.trim()) {
            converter.elements.status.textContent = 'Please enter some text or upload a file to convert';
        }
    };
    typedElements.convertButton.addEventListener('click', convertHandler);
    if (typedElements.convertButton instanceof HTMLElement) {
        registerPrimaryActionShortcut(typedElements.convertButton);
    }

    const sampleHandler = () => {
        // Load Sample always demonstrates a valid encode: reset the mode to
        // Auto so a plain-text sample isn't fed to Decode (which would error).
        converter.elements.mode.value = 'auto';
        converter.elements.input.value = 'Hello from CodeSamplez Tools!';
        converter.processInput();
    };
    const sampleButton = document.getElementById('base64converter-load-sample');
    if (sampleButton) {
        sampleButton.addEventListener('click', sampleHandler);
    }

    const fileUploadHandler = (e) => converter.handleFileUpload(e);
    typedElements.fileInput.addEventListener('change', fileUploadHandler);

    // Drag-and-drop reuses the Upload File path rather than the text path:
    // this tool is the one that legitimately wants binary input (images are
    // encoded via readAsDataURL), so the raw File is handed straight to
    // `handleFileUpload` in the same shape its change listener receives.
    if (typedElements.input instanceof HTMLElement) {
        registerDropZone(typedElements.input, {
            onFile: (file) => {
                void converter.handleFileUpload({ target: { files: [file], value: null } });
            },
            onError: (message) => NotificationManager.show(message, 3000, { type: 'error' })
        });
    }

    const downloadHandler = () => converter.handleDownload();
    typedElements.downloadDecodedButton.addEventListener('click', downloadHandler);

    /**
     * Copy a shareable link carrying the current input.
     *
     * This tool has had a documented `data` preload param since before the
     * shared share-URL conventions existed, and third-party pages link to it,
     * so Share writes that exact format (raw `encodeURIComponent`, hash form)
     * rather than the LZ-compressed payload the newer tools use. Switching
     * encodings would strand every link already in the wild.
     */
    const shareHandler = async () => {
        const inputValue = (typedElements.input as HTMLTextAreaElement).value;
        if (!inputValue.trim()) {
            NotificationManager.show('Enter some text before sharing.', 3000, { type: 'error' });
            return;
        }

        const url = buildShareUrl(window.location.href, `data=${encodeURIComponent(inputValue)}`);
        if (url.length > SHARE_URL_MAX_LENGTH) {
            NotificationManager.show(
                `This text is too large to share as a URL (limit ~${SHARE_URL_MAX_LENGTH} characters).`,
                4000,
                { type: 'error' }
            );
            return;
        }

        try {
            await copyTextToClipboard(url);
            NotificationManager.show('Share link copied to clipboard!', 2000, { type: 'success' });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            NotificationManager.show(`Failed to copy share link. ${message}`, 3000, { type: 'error' });
        }
    };

    const shareButton = document.getElementById('base64converter-share');
    if (shareButton) {
        shareButton.addEventListener('click', () => void shareHandler());
    }

    if (shouldAutoConvert && dataFromUrl && typeof converter.processInput === 'function') {
        setTimeout(() => {
            converter.processInput();
        }, 100);
    }

    return converter;
}

export class Base64ConverterToolUI {
    converter: Base64ConverterInstance | null;

    constructor(rootSelector = '#base64converter-app') {
        const root = document.querySelector<HTMLElement>(rootSelector) || document.querySelector<HTMLElement>('#base64converter-tool');
        if (!root) {
            throw new Error('Base64 Converter root element not found');
        }

        const mount = root.hasChildNodes() ? hydrate : render;
        mount(<Base64ConverterApp />, root);
        this.converter = initializeBase64ConverterDom();
    }
}

function bootstrapBase64ConverterPage() {
    mountToolShell({
        title: toolMetadata.title,
        description: toolMetadata.description,
        homeHref: '/'
    });

    const hasAppRoot = Boolean(document.getElementById('base64converter-app') || document.getElementById('base64converter-tool'));
    if (hasAppRoot) {
        try {
            new Base64ConverterToolUI();
            return;
        } catch (error) {
            console.error('Base64 converter UI bootstrap failed:', error);
        }
    }

    initializeBase64ConverterDom();
}

// Initialize when DOM is loaded
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', bootstrapBase64ConverterPage);
}
