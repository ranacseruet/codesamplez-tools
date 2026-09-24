// Import dependencies
import Base64Codec from '../common/Base64Codec';
import { NotificationManager } from '../common/notification-manager';
import DownloadManager from '../common/DownloadManager';
import ClearButton from '../common/clear-button/ClearButton';
import CopyButton from '../common/copy-button/CopyButton';
import { buildShareUrl, readHashOrQueryParam, SHARE_URL_MAX_LENGTH } from '../common/share-url';
import { copyTextToClipboard } from '../common/clipboard';
import { registerPrimaryActionShortcut } from '../common/shortcut-utils';
import { describeLoadedFile, registerDropZone, registerFileInput, type LoadedFileDetail } from '../common/drop-zone';
import { formatBytes } from '../common/format-utils';
import FileUploadButton from '../common/file-upload';
import { hydrate, render } from 'preact';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import toolMetadata from './tool.meta.json';

const BASE64_DATA_URL_REGEX = /^data:([a-zA-Z0-9/\-+.-\w]+)?(?:;charset=([a-zA-Z0-9/\-+.-\w]+))?;base64,(.*)$/;

type Base64Encoding = 'utf8' | 'ascii' | 'iso88591' | 'ucs2';
type Base64ConversionDirection = 'encode' | 'decode';
type Base64OutputKind = 'empty' | 'text' | 'binary' | 'image';

interface ParsedDataUrl {
    mimeType: string | null;
    base64Payload: string;
}

interface Base64ConverterElements {
    input: HTMLTextAreaElement;
    result: HTMLElement;
    preview: HTMLImageElement;
    status: HTMLElement;
    mode: HTMLSelectElement;
    encoding: HTMLSelectElement;
    fileInput: HTMLInputElement;
    convertButton: HTMLElement;
    swapButton: HTMLButtonElement;
    downloadDecodedButton: HTMLButtonElement;
    // Optional thumbnail for uploaded image files. Queried separately from
    // BASE64_CONVERTER_ELEMENT_IDS so older DOMs (and tests) without these
    // nodes still initialize — null means "no thumbnail slot available".
    uploadPreview: HTMLImageElement | null;
    uploadPreviewMeta: HTMLElement | null;
    // Caption under the decode-path image preview (MIME · size · dimensions).
    // Optional for the same reason as the upload slots.
    previewMeta: HTMLElement | null;
}

interface ImagePreviewRequest {
    loader: HTMLImageElement;
}

interface Base64ConverterInstance {
    elements: Base64ConverterElements;
    currentMimeType: string | null;
    outputKind: Base64OutputKind;
    lastConversionDirection: Base64ConversionDirection | null;
    downloadSource: string | null;
    imagePreviewRequest: ImagePreviewRequest | null;
    // Blob URL for the current upload thumbnail, if any. Revoked whenever the
    // output state resets so long-lived sessions don't leak object URLs.
    uploadPreviewUrl: string | null;
    // Base caption for the decode-path image preview ("type · size");
    // dimensions are appended once the image loads.
    imagePreviewMetaBase: string | null;
    // Decoded text stashed when a bare payload takes the sniffed image path,
    // so a browser render rejection (e.g. text colliding with magic bytes)
    // can fall back to text instead of a binary placeholder. Null when the
    // bytes are not valid text, or when the preview was declared (not sniffed).
    imagePreviewTextFallback: string | null;
    downloadManager: DownloadManager;
    clearButtonInstance: ClearButton | null;
    copyButtonInstance: CopyButton;
    processInput(): void;
    // Sniffs raster magic bytes. Returns the MIME type for previewable raster
    // images, or null for anything else (including SVG, which stays
    // download-only — see PREVIEWABLE_RASTER_MIME_TYPES).
    detectMimeTypeFromBinary(bytes: Uint8Array): string | null;
    getFileExtensionFromMimeType(mimeType: string): string;
    clearUploadPreview(): void;
    showUploadPreview(file: File): void;
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

function isTextMimeType(mimeType: string | null): boolean {
    const normalizedMimeType = mimeType?.toLowerCase();
    return Boolean(
        normalizedMimeType &&
        (normalizedMimeType.startsWith('text/') ||
            normalizedMimeType === 'application/json' ||
            normalizedMimeType === 'application/xml' ||
            normalizedMimeType.startsWith('application/javascript'))
    );
}

function isImageMimeType(mimeType: string | null): boolean {
    return Boolean(mimeType?.toLowerCase().startsWith('image/'));
}

/**
 * Raster formats eligible for image preview. Mirrors the image-editor
 * allowlist — and deliberately excludes `image/svg+xml`: SVG in an `<img>`
 * blocks scripts, but opening the same `blob:`/`data:` URL directly (e.g.
 * right-click "open image in new tab") would execute embedded scripts in the
 * tool origin, so SVG stays download-only.
 */
const PREVIEWABLE_RASTER_MIME_TYPES: ReadonlySet<string> = new Set([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/avif'
]);

const RASTER_MIME_TO_EXTENSION: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/avif': 'avif'
};

/** Bytes decoded from a base64 head purely to sniff magic bytes. */
const IMAGE_SNIFF_BYTE_BUDGET = 48;

/**
 * Upload thumbnails are a preview nicety, not the conversion itself, so they
 * stay under the same ceiling the image-editor uses (15 MB). Larger uploads
 * still encode/download exactly as before — they just get no thumbnail.
 */
const UPLOAD_PREVIEW_MAX_BYTES = 15 * 1024 * 1024;

/**
 * Ceiling for an uploaded or dropped file. Encoding reads the whole file into
 * memory via `readAsDataURL` and renders a Base64 string a third larger, so an
 * unbounded multi-GB drop would jank or crash the tab before anything shows.
 * Set above the preview ceiling: 15-25 MB files still encode, just without a
 * thumbnail.
 */
const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

function isPreviewableRasterMimeType(mimeType: string | null): boolean {
    return Boolean(mimeType && PREVIEWABLE_RASTER_MIME_TYPES.has(mimeType.toLowerCase()));
}

/**
 * Decodes just enough of a base64 payload to cover the magic-byte window.
 * Magic bytes sit at offset 0, so decoding a short head keeps the sniff O(1)
 * no matter how large the pasted payload is. Exported for unit tests.
 */
export function base64HeadToBytes(payload: string, byteBudget: number = IMAGE_SNIFF_BYTE_BUDGET): Uint8Array | null {
    if (!payload) {
        return null;
    }
    const charsNeeded = Math.ceil(byteBudget / 3) * 4;
    const head = payload.length > charsNeeded ? payload.slice(0, charsNeeded) : payload;
    if (head.length % 4 !== 0) {
        return null;
    }
    try {
        const binary = atob(head);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    } catch (_sniffError: unknown) {
        return null;
    }
}

/**
 * Infers a previewable raster MIME type from magic bytes. Returns null for
 * anything else — including SVG/text (never sniffed on purpose).
 * Exported for unit tests.
 */
export function sniffRasterImageMimeType(bytes: Uint8Array | null): string | null {
    if (!bytes || bytes.length < 3) {
        return null;
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
        bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    ) {
        return 'image/png';
    }
    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'image/jpeg';
    }
    // GIF: GIF87a / GIF89a
    if (
        bytes.length >= 6 &&
        bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
        (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
    ) {
        return 'image/gif';
    }
    // BMP: BM
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
        return 'image/bmp';
    }
    // WebP: RIFF....WEBP
    if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
        return 'image/webp';
    }
    // AVIF: ....ftypavif / ....ftypavis
    if (
        bytes.length >= 12 &&
        bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
    ) {
        const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
        if (brand === 'avif' || brand === 'avis') {
            return 'image/avif';
        }
    }
    return null;
}

/**
 * Decoded byte size of a validated base64 payload, for preview captions.
 * Returns null for malformed input rather than guessing.
 * Exported for unit tests.
 */
export function base64DecodedSize(payload: string): number | null {
    if (!payload || payload.length % 4 !== 0) {
        return null;
    }
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    const size = (payload.length / 4) * 3 - padding;
    return Number.isInteger(size) && size >= 0 ? size : null;
}

function isBinaryPlaceholder(value: string): boolean {
    return value.startsWith('[Binary content') || value.startsWith('[Decoded content (likely binary');
}

function isFileUploadPlaceholder(value: string): boolean {
    return value.startsWith('[File:') && value.endsWith('uploaded and encoded to output]');
}

function isBinaryOutputKind(outputKind: Base64OutputKind): boolean {
    return outputKind === 'binary' || outputKind === 'image';
}

const SWAPPABLE_OUTPUT_KINDS: ReadonlySet<Base64OutputKind> = new Set(['text']);

function isSwappableOutputKind(outputKind: Base64OutputKind): boolean {
    return SWAPPABLE_OUTPUT_KINDS.has(outputKind);
}

function isLikelyBinaryDecodeError(error: unknown): boolean {
    const message = error instanceof Error && error.message ? error.message.toLowerCase() : '';
    return (
        message.includes('utf-8') ||
        message.includes('ucs-2') ||
        message.includes('malformed') ||
        message.includes('invalid sequence') ||
        message.includes('data was not valid') ||
        message.includes('valid utf') ||
        error instanceof TypeError
    );
}

function readOutputText(element: HTMLElement): string {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
        return element.value;
    }
    return element.textContent || '';
}

function writeOutputText(element: HTMLElement, value: string): void {
    element.textContent = value;
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
        element.value = value;
    }
}

function setImagePreviewVisible(converter: Base64ConverterInstance, visible: boolean, source = ''): void {
    const { preview, previewMeta, result } = converter.elements;
    converter.imagePreviewRequest = null;

    if (visible) {
        preview.src = source;
        preview.hidden = false;

        if (previewMeta && converter.imagePreviewMetaBase) {
            previewMeta.textContent = converter.imagePreviewMetaBase;
            previewMeta.hidden = false;
        }

        const request: ImagePreviewRequest = {
            loader: document.createElement('img')
        };
        converter.imagePreviewRequest = request;
        request.loader.onerror = () => {
            if (converter.imagePreviewRequest !== request || converter.outputKind !== 'image') {
                return;
            }
            handleImagePreviewError(converter);
        };
        request.loader.onload = () => {
            if (converter.imagePreviewRequest !== request || converter.outputKind !== 'image') {
                return;
            }
            const { naturalWidth, naturalHeight } = request.loader;
            if (previewMeta && converter.imagePreviewMetaBase && naturalWidth > 0 && naturalHeight > 0) {
                previewMeta.textContent = `${converter.imagePreviewMetaBase} · ${naturalWidth}×${naturalHeight}px`;
            }
        };
        request.loader.src = source;
    } else {
        preview.hidden = true;
        preview.removeAttribute('src');
        if (previewMeta) {
            previewMeta.hidden = true;
        }
    }

    result.hidden = visible;
    const copyWrapper = converter.copyButtonInstance?.wrapper;
    if (copyWrapper) {
        copyWrapper.hidden = visible;
    }
}

function handleImagePreviewError(converter: Base64ConverterInstance): void {
    if (converter.outputKind !== 'image') {
        return;
    }

    const textFallback = converter.imagePreviewTextFallback;
    converter.imagePreviewTextFallback = null;
    if (textFallback !== null) {
        // A sniffed preview the browser rejected (e.g. text colliding with
        // magic bytes): restore the decoded text rather than a placeholder,
        // and return to the text download path.
        setImagePreviewVisible(converter, false);
        writeOutputText(converter.elements.result, textFallback);
        converter.outputKind = 'text';
        converter.currentMimeType = null;
        converter.downloadSource = null;
        converter.elements.downloadDecodedButton.disabled = false;
        converter.elements.status.textContent = '';
        converter.copyButtonInstance.forceUpdateVisibility();
        updateSwapButton(converter);
        return;
    }

    const mimeType = converter.currentMimeType || 'image/*';
    setImagePreviewVisible(converter, false);
    writeOutputText(converter.elements.result, `[Binary content (${mimeType}). Use Download button.]`);
    converter.outputKind = 'binary';
    converter.elements.downloadDecodedButton.disabled = false;
    converter.elements.status.textContent = 'Image preview unavailable. Use Download button.';
    converter.copyButtonInstance.forceUpdateVisibility();
    updateSwapButton(converter);
}

function updateSwapButton(converter: Base64ConverterInstance): void {
    converter.elements.swapButton.disabled =
        !isSwappableOutputKind(converter.outputKind) ||
        !readOutputText(converter.elements.result).trim() ||
        isFileUploadPlaceholder(converter.elements.input.value);
}

function resetOutputState(converter: Base64ConverterInstance): void {
    converter.clearUploadPreview();
    converter.imagePreviewMetaBase = null;
    converter.imagePreviewTextFallback = null;
    converter.currentMimeType = null;
    converter.outputKind = 'empty';
    converter.lastConversionDirection = null;
    converter.downloadSource = null;
    converter.elements.downloadDecodedButton.disabled = true;
    setImagePreviewVisible(converter, false);
    writeOutputText(converter.elements.result, '');
    converter.copyButtonInstance.forceUpdateVisibility();
    updateSwapButton(converter);
}

const BASE64_CONVERTER_ELEMENT_IDS = {
    input: 'base64converter-input',
    result: 'base64converter-result',
    preview: 'base64converter-image-preview',
    status: 'base64converter-status',
    mode: 'base64converter-mode',
    encoding: 'base64converter-encoding',
    fileInput: 'base64converter-file',
    convertButton: 'base64converter-convert',
    swapButton: 'base64converter-swap',
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
        outputKind: 'empty' as Base64OutputKind,
        lastConversionDirection: null as Base64ConversionDirection | null,
        downloadSource: null,
        imagePreviewRequest: null,
        uploadPreviewUrl: null as string | null,
        imagePreviewMetaBase: null as string | null,
        imagePreviewTextFallback: null as string | null,
        downloadManager: downloadManager, // Expose downloadManager for testing
        clearButtonInstance: null,
        copyButtonInstance: null as unknown as CopyButton,

        processInput() {
            const rawInput = this.elements.input.value.trim();

            // If the input is the file upload placeholder, do not process it as text for encoding/decoding.
            // The result and status should already be set by handleFileUpload.
            if (isFileUploadPlaceholder(rawInput)) {
                this.currentMimeType = null;
                this.downloadSource = null;
                this.outputKind = 'text';
                this.lastConversionDirection = 'encode';
                setImagePreviewVisible(this, false);
                this.elements.downloadDecodedButton.disabled = false;
                this.copyButtonInstance.forceUpdateVisibility();
                updateSwapButton(this);
                return;
            }

            resetOutputState(this);

            if (!rawInput) {
                this.elements.status.textContent = '';
                return;
            }

            let base64Payload = rawInput;
            let detectedMimeType = null; // MIME type from Data URI, if present
            // Raster MIME inferred from magic bytes for bare base64 payloads
            // (e.g. re-pasted upload output, which carries no Data URI prefix).
            let inferredMimeType: string | null = null;

            if (rawInput.startsWith('data:')) {
                const parsedDataUrl = parseBase64DataUrl(rawInput);
                if (parsedDataUrl) {
                    detectedMimeType = parsedDataUrl.mimeType; // e.g., 'image/png', 'text/plain'
                    base64Payload = parsedDataUrl.base64Payload;
                    this.currentMimeType = detectedMimeType; // Persist for download
                } else {
                    // v4 contract: errors surface inline in the status chip.
                    this.elements.status.textContent = 'Invalid Data URI format';
                    return;
                }
            }

            // Normalize URL-safe (`-`/`_`) payloads up front: `isBase64` accepts
            // them, so every downstream consumer — magic-byte sniffing, the
            // `data:` preview URL, and the download path — must see the standard
            // alphabet or a detected/converted payload still fails to open.
            base64Payload = codec.normalizePayload(base64Payload);

            const mode = this.elements.mode.value;
            const encoding = normalizeEncodingValue(this.elements.encoding.value); // For text decoding

            try {
                let resultText = '';
                let statusActionMessage: 'Encoded' | 'Decoded';
                let outputKind: Base64OutputKind = 'text';
                let imagePreviewSource = '';

                const decodePayloadForDisplay = (strictTextValidation: boolean) => {
                    // SVG is intentionally not previewable even when declared:
                    // scripts inside an SVG opened directly (e.g. "open image in
                    // new tab" on the preview) would run in the tool origin, so
                    // it stays download-only like any other binary content.
                    if (
                        isImageMimeType(detectedMimeType) &&
                        detectedMimeType?.toLowerCase() !== 'image/svg+xml'
                    ) {
                        return {
                            resultText: '',
                            outputKind: 'image' as const,
                            imagePreviewSource: `data:${detectedMimeType};base64,${base64Payload}`
                        };
                    }

                    if (detectedMimeType && !isTextMimeType(detectedMimeType)) {
                        return {
                            resultText: `[Binary content (${detectedMimeType}). Use Download button.]`,
                            outputKind: 'binary' as const,
                            imagePreviewSource: ''
                        };
                    }

                    const decodeTextForDisplay = () => {
                        let decodedText = codec.decodeText(base64Payload, encoding);
                        if (strictTextValidation) {
                            // Replace null characters for display purposes to match the existing text output contract.
                            decodedText = decodedText.replace(/\u0000/g, '');
                            // Check for replacement characters indicating decode errors.
                            if (decodedText.includes('\uFFFD')) {
                                throw new Error('Invalid UTF-8 sequence detected in decoded result');
                            }
                        }

                        return {
                            resultText: decodedText,
                            outputKind: 'text' as const,
                            imagePreviewSource: ''
                        };
                    };

                    if (!detectedMimeType) {
                        // Bare base64 with no declared MIME (notably the output
                        // of an image upload, which strips the Data URI prefix).
                        // Sniffing runs independently of text decoding: ASCII and
                        // ISO-8859-1 decoding accept arbitrary bytes, and some
                        // raster payloads are valid UTF-8 too, so gating the
                        // sniff on a text failure would miss those images.
                        // When the bytes are also valid text it is stashed as a
                        // fallback — if the browser rejects the render (e.g.
                        // text colliding with magic bytes), the error path
                        // restores text instead of a binary placeholder. SVG is
                        // never sniffed and stays download-only.
                        let textDisplay: ReturnType<typeof decodeTextForDisplay> | null = null;
                        let textError: unknown = null;
                        try {
                            textDisplay = decodeTextForDisplay();
                        } catch (error: unknown) {
                            textError = error;
                        }
                        const sniffedMimeType = sniffRasterImageMimeType(base64HeadToBytes(base64Payload));
                        if (sniffedMimeType) {
                            inferredMimeType = sniffedMimeType;
                            this.imagePreviewTextFallback = textDisplay ? textDisplay.resultText : null;
                            return {
                                resultText: '',
                                outputKind: 'image' as const,
                                imagePreviewSource: `data:${sniffedMimeType};base64,${base64Payload}`
                            };
                        }
                        if (textDisplay) {
                            return textDisplay;
                        }
                        throw textError;
                    }

                    return decodeTextForDisplay();
                };

                if (mode === 'encode') {
                    statusActionMessage = 'Encoded';
                    resultText = codec.encodeText(rawInput, encoding);
                } else { // mode is 'decode' or 'auto'
                    const isPayloadBase64 = codec.isBase64(base64Payload);

                    if (mode === 'auto') {
                        if (isPayloadBase64) {
                            statusActionMessage = 'Decoded';
                            try {
                                const display = decodePayloadForDisplay(false);
                                resultText = display.resultText;
                                outputKind = display.outputKind;
                                imagePreviewSource = display.imagePreviewSource;
                            } catch (decodeError: unknown) {
                                if (isLikelyBinaryDecodeError(decodeError)) {
                                    resultText = `[Decoded content (likely binary, not ${encoding} text). Use Download button.]`;
                                    outputKind = 'binary';
                                } else {
                                    throw decodeError;
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
                        const display = decodePayloadForDisplay(true);
                        resultText = display.resultText;
                        outputKind = display.outputKind;
                        imagePreviewSource = display.imagePreviewSource;
                    }
                }

                this.outputKind = outputKind;
                this.lastConversionDirection = statusActionMessage === 'Encoded' ? 'encode' : 'decode';
                if (outputKind === 'image') {
                    const previewMimeType = inferredMimeType || detectedMimeType;
                    if (inferredMimeType) {
                        this.currentMimeType = inferredMimeType;
                    }
                    const decodedSize = base64DecodedSize(base64Payload);
                    this.imagePreviewMetaBase = previewMimeType
                        ? `${previewMimeType} · ${decodedSize === null ? 'unknown size' : formatBytes(decodedSize)}`
                        : null;
                }
                this.downloadSource = isBinaryOutputKind(outputKind) ? rawInput : null;
                writeOutputText(this.elements.result, resultText);
                setImagePreviewVisible(this, outputKind === 'image', imagePreviewSource);
                this.elements.status.textContent = '';
                // Update CopyButton visibility directly
                this.copyButtonInstance.forceUpdateVisibility();
                updateSwapButton(this);
                if (statusActionMessage === 'Decoded' && outputKind === 'image' && detectedMimeType && isImageMimeType(detectedMimeType)) {
                    NotificationManager.show(`${statusActionMessage}. MIME: ${detectedMimeType}. Image preview available.`, 2000, { type: 'success' });
                } else if (statusActionMessage === 'Decoded' && outputKind === 'image' && inferredMimeType) {
                    NotificationManager.show(`${statusActionMessage}. Image preview loading (inferred MIME: ${inferredMimeType}).`, 2000, { type: 'success' });
                } else if (statusActionMessage === 'Decoded' && detectedMimeType && !isTextMimeType(detectedMimeType)) {
                    NotificationManager.show(`${statusActionMessage}. MIME: ${detectedMimeType}. Selected encoding (${this.elements.encoding.value}) ignored for binary display.`, 2000, { type: 'success' });
                } else if (statusActionMessage === 'Decoded' && !detectedMimeType && isBinaryPlaceholder(resultText)) {
                    NotificationManager.show(`${statusActionMessage}. Selected encoding (${this.elements.encoding.value}) failed for display. Use Download.`, 2000, { type: 'success' });
                } else {
                    NotificationManager.show(`${statusActionMessage} using ${this.elements.encoding.value}`, 2000, { type: 'success' });
                }
                this.elements.downloadDecodedButton.disabled = false;

            } catch (error: unknown) {
                console.error('Processing error:', error);
                resetOutputState(this);
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
            }
        },

        detectMimeTypeFromBinary(bytes: Uint8Array) {
            return sniffRasterImageMimeType(bytes);
        },

        getFileExtensionFromMimeType(mimeType: string) {
            const normalized = String(mimeType || '').toLowerCase().split(';')[0].trim();
            return RASTER_MIME_TO_EXTENSION[normalized] || 'bin';
        },

        clearUploadPreview() {
            if (
                this.uploadPreviewUrl &&
                typeof URL !== 'undefined' &&
                typeof URL.revokeObjectURL === 'function'
            ) {
                try {
                    URL.revokeObjectURL(this.uploadPreviewUrl);
                } catch (_revokeError: unknown) {
                    // Revocation is best-effort cleanup; ignore failures.
                }
            }
            this.uploadPreviewUrl = null;
            const uploadPreview = this.elements.uploadPreview;
            if (uploadPreview) {
                uploadPreview.hidden = true;
                uploadPreview.removeAttribute('src');
                uploadPreview.onload = null;
                uploadPreview.onerror = null;
            }
            const uploadMeta = this.elements.uploadPreviewMeta;
            if (uploadMeta) {
                uploadMeta.hidden = true;
                uploadMeta.textContent = '';
            }
        },

        /**
         * Shows a thumbnail for an uploaded raster image file alongside the
         * base64 text output. The base64 output is untouched — the thumbnail
         * is supplementary and rendered from a blob URL (never uploaded).
         * Non-images, SVG, oversized files, and environments without blob-URL
         * support simply get no thumbnail; conversion is unaffected.
         */
        showUploadPreview(file: File) {
            this.clearUploadPreview();

            const fileMimeType = typeof file.type === 'string' ? file.type : '';
            if (!isPreviewableRasterMimeType(fileMimeType)) {
                return;
            }

            const uploadMeta = this.elements.uploadPreviewMeta;
            if (file.size > UPLOAD_PREVIEW_MAX_BYTES) {
                if (uploadMeta) {
                    uploadMeta.hidden = false;
                    uploadMeta.textContent =
                        `Preview skipped: file is larger than ${formatBytes(UPLOAD_PREVIEW_MAX_BYTES)}. ` +
                        'Base64 output and Download are still available.';
                }
                return;
            }

            if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
                return;
            }

            try {
                const objectUrl = URL.createObjectURL(file);
                this.uploadPreviewUrl = objectUrl;
                const uploadPreview = this.elements.uploadPreview;
                if (uploadPreview) {
                    uploadPreview.onerror = () => {
                        this.clearUploadPreview();
                    };
                    uploadPreview.onload = () => {
                        const dimensions =
                            uploadPreview.naturalWidth && uploadPreview.naturalHeight
                                ? ` · ${uploadPreview.naturalWidth}×${uploadPreview.naturalHeight}px`
                                : '';
                        if (uploadMeta) {
                            uploadMeta.textContent = `${fileMimeType} · ${formatBytes(file.size)}${dimensions}`;
                        }
                    };
                    uploadPreview.src = objectUrl;
                    uploadPreview.hidden = false;
                }
                if (uploadMeta) {
                    uploadMeta.hidden = false;
                    uploadMeta.textContent = `${fileMimeType} · ${formatBytes(file.size)}`;
                }
            } catch (_previewError: unknown) {
                this.clearUploadPreview();
            }
        },

        async handleDownload() {
            const outputContent = readOutputText(this.elements.result).trim();
            const shouldDownloadBinary = isBinaryOutputKind(this.outputKind);

            if (!outputContent && !shouldDownloadBinary) {
                NotificationManager.show('No content to download', 3000, { type: 'error' });
                return;
            }

            try {
                let content;
                let filename = 'output.txt';
                // Text output is a JS string, which Blob always writes as UTF-8
                // regardless of the encoding selected for decoding — label it so.
                let mimeType = 'text/plain;charset=utf-8';

                if (shouldDownloadBinary) {
                    const rawInputValue = (this.downloadSource ?? this.elements.input.value).trim();
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

                    // `isBase64` accepts URL-safe payloads, so normalize before
                    // `atob` — otherwise a payload that passed validation (and
                    // enabled this button) throws here and the download fails.
                    base64Payload = codec.normalizePayload(base64Payload);
                    const binaryString = atob(base64Payload);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    content = bytes;
                    // Name the file by sniffed raster type when the bytes are a
                    // known image; otherwise keep the legacy .bin name.
                    filename = `output.${this.getFileExtensionFromMimeType(this.detectMimeTypeFromBinary(bytes) || '')}`;
                    mimeType = 'application/octet-stream';
                } else {
                    content = outputContent;
                }

                downloadManager.downloadFile(content, filename, mimeType);
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
                    writeOutputText(this.elements.result, base64String);
                    this.currentMimeType = null;
                    this.downloadSource = null;
                    this.outputKind = 'text';
                    this.lastConversionDirection = 'encode';
                    setImagePreviewVisible(this, false);
                    this.showUploadPreview(file);
                    // Update CopyButton visibility directly
                    this.copyButtonInstance.forceUpdateVisibility();
                    updateSwapButton(this);
                    this.elements.downloadDecodedButton.disabled = false;

                } catch (error: unknown) {
                    console.error('File processing error after read:', error);
                    resetOutputState(this);
                    this.elements.input.value = '';
                    const message = error instanceof Error ? error.message : String(error);
                    NotificationManager.show('Error processing file: ' + message, 3000, { type: 'error' });
                } finally {
                    e.target.value = null;
                }
            };

            reader.onerror = () => {
                console.error('File reading error:', reader.error);
                resetOutputState(this);
                this.elements.input.value = '';
                NotificationManager.show('Error reading file: ' + (reader.error?.message || 'Unknown error'), 3000, { type: 'error' });
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

                <div className="b64-swap-action">
                    <button
                        type="button"
                        id="base64converter-swap"
                        className="c-button c-button--secondary c-button--small b64-swap-button"
                        title="Swap Input and Output"
                        aria-label="Swap Input and Output"
                        aria-controls="base64converter-input base64converter-result"
                        disabled
                    >
                        Swap ⇄
                    </button>
                </div>

                <div className="o-panel b64-panel c-surface-card c-surface-panel">
                    <div className="o-panel-header b64-panel-header c-surface-panel__header">
                        <h3>Output</h3>
                    </div>
                    <div className="b64-output-well">
                        <textarea
                            id="base64converter-result"
                            className="c-input c-input--textarea b64-textarea b64-output"
                            readOnly
                            aria-label="Output text"
                            placeholder="Converted output will appear here..."
                        />
                        <img
                            id="base64converter-image-preview"
                            className="b64-image-preview"
                            alt="Decoded image preview"
                            hidden
                        />
                        <p
                            id="base64converter-preview-meta"
                            className="b64-preview-meta c-status-chip"
                            aria-live="polite"
                            hidden
                        />
                        <img
                            id="base64converter-upload-preview"
                            className="b64-upload-preview"
                            alt="Uploaded image preview"
                            hidden
                        />
                        <p
                            id="base64converter-upload-meta"
                            className="b64-upload-meta c-status-chip"
                            aria-live="polite"
                            hidden
                        />
                    </div>
                </div>
            </div>

            <div className="u-flex u-mt-md b64-action-row c-action-strip">
                <div className="u-flex u-gap-sm b64-file-action">
                    <button type="button" id="base64converter-load-sample" className="c-button c-button--ghost b64-load-sample-button">
                        Load Sample
                    </button>
                    <FileUploadButton
                        id="base64converter-file"
                        className="c-button c-button--secondary b64-upload-button"
                    />
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

    // Upload-thumbnail slots are optional: older DOMs and test fixtures
    // without them still initialize, uploads just show no thumbnail.
    const uploadPreviewElement = document.getElementById('base64converter-upload-preview');
    typedElements.uploadPreview = uploadPreviewElement instanceof HTMLImageElement ? uploadPreviewElement : null;
    const uploadPreviewMetaElement = document.getElementById('base64converter-upload-meta');
    typedElements.uploadPreviewMeta = uploadPreviewMetaElement instanceof HTMLElement ? uploadPreviewMetaElement : null;
    const previewMetaElement = document.getElementById('base64converter-preview-meta');
    typedElements.previewMeta = previewMetaElement instanceof HTMLElement ? previewMetaElement : null;

    if (dataFromUrl) {
        typedElements.input.value = dataFromUrl;
        typedElements.mode.value = 'auto';
    }

    converter.clearButtonInstance = new ClearButton(typedElements.input);
    converter.copyButtonInstance = new CopyButton(typedElements.result as HTMLTextAreaElement | HTMLInputElement | HTMLPreElement);
    setImagePreviewVisible(converter, false);
    updateSwapButton(converter);

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

    const swapHandler = () => {
        if (!isSwappableOutputKind(converter.outputKind) || isFileUploadPlaceholder(typedElements.input.value)) {
            return;
        }

        const outputValue = readOutputText(typedElements.result);
        if (!outputValue.trim()) {
            updateSwapButton(converter);
            return;
        }

        const inputValue = typedElements.input.value;
        typedElements.input.value = outputValue;
        writeOutputText(typedElements.result, inputValue);
        setImagePreviewVisible(converter, false);
        converter.clearUploadPreview();

        const nextMode = typedElements.mode.value === 'encode'
            ? 'decode'
            : typedElements.mode.value === 'decode'
                ? 'encode'
                : converter.lastConversionDirection === 'encode'
                    ? 'decode'
                    : 'encode';
        typedElements.mode.value = nextMode;
        converter.currentMimeType = null;
        converter.downloadSource = null;
        converter.outputKind = inputValue.trim() ? 'text' : 'empty';
        converter.elements.status.textContent = '';
        converter.elements.downloadDecodedButton.disabled = !inputValue.trim();
        converter.copyButtonInstance.forceUpdateVisibility();
        updateSwapButton(converter);
    };
    typedElements.swapButton.addEventListener('click', swapHandler);

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

    const handleRawFile = (file: File, detail: LoadedFileDetail) => {
        // Uploads show no success toast of their own, so a multi-file drop
        // gets a dedicated note naming the file that was actually encoded.
        if (detail.ignoredFileCount > 0) {
            NotificationManager.show(describeLoadedFile(file.name, detail), 4000, { type: 'warning' });
        }
        void converter.handleFileUpload({ target: { files: [file], value: null } });
    };

    // Base64 is intentionally open to arbitrary binary input, so it gets its
    // own ceiling well above the text tools' 5 MB default.
    const fileOptions = {
        onFile: handleRawFile,
        onError: (message: string) => NotificationManager.show(message, 3000, { type: 'error' as const }),
        maxBytes: UPLOAD_MAX_BYTES
    };

    registerFileInput(typedElements.fileInput, fileOptions);

    // Drag-and-drop reuses the Upload File path rather than the text path:
    // this tool is the one that legitimately wants binary input (images are
    // encoded via readAsDataURL), so the raw File is handed straight to
    // `handleFileUpload` in the same shape its change listener receives.
    if (typedElements.input instanceof HTMLElement) {
        registerDropZone(typedElements.input, fileOptions);
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
