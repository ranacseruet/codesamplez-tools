import { DataFormatConverter } from './DataFormatConverter';
import { NotificationManager } from '../common/notification-manager';
import DownloadManager from '../common/DownloadManager';
import ClearButton from '../common/clear-button/ClearButton';
import CopyButton from '../common/copy-button/CopyButton';
import { registerPrimaryActionShortcut } from '../common/shortcut-utils';
import { registerDropZone } from '../common/drop-zone';
import { copyTextToClipboard } from '../common/clipboard';
import type { ConverterSharePayload } from './share-url';
import { hydrate, render } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { DataFormatConverterArticle, DataFormatConverterIntro } from './content';
import toolMetadata from './tool.meta.json';

type SupportedFormat = 'json' | 'xml' | 'yaml' | 'properties';

interface DataFormatConverterAppProps {
    converter: DataFormatConverter;
}

interface ConverterStateSnapshot {
    inputFormat: SupportedFormat;
    outputFormat: SupportedFormat;
    autoConvert: boolean;
    useSampleData: boolean;
}

interface ConvertDataOptions {
    silent?: boolean;
    nextInput?: string;
    nextInputFormat?: SupportedFormat;
    nextOutputFormat?: SupportedFormat;
}

const FORMATS: SupportedFormat[] = ['json', 'xml', 'yaml', 'properties'];
const INPUT_PLACEHOLDERS: Record<SupportedFormat, string> = {
    json: 'Paste your JSON data here, or drop a file...\n\nExample:\n{\n  "name": "John",\n  "age": 30,\n  "city": "New York"\n}',
    xml: 'Paste your XML data here, or drop a file...\n\nExample:\n<person>\n  <name>John</name>\n  <age>30</age>\n  <city>New York</city>\n</person>',
    yaml: 'Paste your YAML data here, or drop a file...\n\nExample:\nname: John\nage: 30\ncity: New York',
    properties: 'Paste your Properties data here, or drop a file...\n\nExample:\nname=John\nage=30\ncity=New York'
};
const MIME_TYPES: Record<SupportedFormat, string> = {
    json: 'application/json',
    xml: 'application/xml',
    yaml: 'text/yaml',
    properties: 'text/plain'
};
const EXTENSIONS: Record<SupportedFormat, string> = {
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    properties: 'properties'
};
const SAMPLE_RECORD: Record<string, string> = {
    app: 'codesamplez-tools',
    owner: 'alex',
    environment: 'staging',
    region: 'ca-central-1',
    version: '2026.04'
};

const formatLabel = (format: SupportedFormat): string =>
    format === 'properties' ? 'Properties' : format.toUpperCase();

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

async function copyToClipboard(text: string): Promise<void> {
    if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const tempTextArea = document.createElement('textarea');
    tempTextArea.value = text;
    tempTextArea.setAttribute('readonly', '');
    tempTextArea.style.position = 'absolute';
    tempTextArea.style.left = '-9999px';
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(tempTextArea);

    if (!copied) {
        throw new Error('Copy failed');
    }
}

function createSampleInput(converter: DataFormatConverter, format: SupportedFormat): string {
    return converter.formatOutput(SAMPLE_RECORD, format);
}

export function getSelectedFormat(
    sectionSelector: string,
    fallback: SupportedFormat
): SupportedFormat {
    const activeButton = document.querySelector(`${sectionSelector} .format-btn[aria-pressed="true"]`) as HTMLButtonElement | null;
    const activeFormat = activeButton?.dataset.format as SupportedFormat | undefined;
    return FORMATS.includes(activeFormat as SupportedFormat) ? activeFormat as SupportedFormat : fallback;
}

export function DataFormatConverterApp({ converter }: DataFormatConverterAppProps) {
    const [inputFormat, setInputFormat] = useState<SupportedFormat>(converter.inputFormat);
    const [outputFormat, setOutputFormat] = useState<SupportedFormat>(converter.outputFormat);
    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [autoConvert, setAutoConvert] = useState(true);
    const [useSampleData, setUseSampleData] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stateRef = useRef<ConverterStateSnapshot>({ inputFormat, outputFormat, autoConvert, useSampleData });
    const inputTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const outputTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const clearOverlayButtonRef = useRef<ClearButton | null>(null);
    const copyOverlayButtonRef = useRef<CopyButton | null>(null);

    useEffect(() => {
        stateRef.current = { inputFormat, outputFormat, autoConvert, useSampleData };
        converter.inputFormat = inputFormat;
        converter.outputFormat = outputFormat;
    }, [inputFormat, outputFormat, autoConvert, useSampleData, converter]);

    useEffect(() => {
        return () => {
            clearTimeout(debounceTimerRef.current as ReturnType<typeof setTimeout>);
        };
    }, []);

    useLayoutEffect(() => {
        if (!(inputTextAreaRef.current instanceof HTMLTextAreaElement)) {
            return undefined;
        }

        const inputEl = inputTextAreaRef.current;
        clearOverlayButtonRef.current = new ClearButton(inputEl);

        const handleTextCleared = () => {
            setInputText(inputEl.value);
            setErrorMessage('');
            NotificationManager.show('Input cleared', 3000, { type: 'success' });
        };

        inputEl.addEventListener('textCleared', handleTextCleared);

        return () => {
            inputEl.removeEventListener('textCleared', handleTextCleared);
            clearOverlayButtonRef.current?.disconnect?.();
            clearOverlayButtonRef.current = null;
        };
    }, []);

    useEffect(() => {
        clearOverlayButtonRef.current?.updateVisibility?.();
    }, [inputText]);

    useLayoutEffect(() => {
        if (!(outputTextAreaRef.current instanceof HTMLTextAreaElement)) {
            return undefined;
        }

        const outputEl = outputTextAreaRef.current;
        copyOverlayButtonRef.current = new CopyButton(outputEl);

        const handleContentCopied = () => {
            setErrorMessage('');
            NotificationManager.show('Copied to clipboard!', 3000, { type: 'success' });
        };

        outputEl.addEventListener('contentCopied', handleContentCopied);

        return () => {
            outputEl.removeEventListener('contentCopied', handleContentCopied);
            copyOverlayButtonRef.current?.disconnect?.();
            copyOverlayButtonRef.current = null;
        };
    }, []);

    useEffect(() => {
        copyOverlayButtonRef.current?.updateVisibility?.();
    }, [outputText]);

    useEffect(() => {
        const primaryButton = document.getElementById('convertBtn');
        if (!primaryButton) {
            /* istanbul ignore next */
            return undefined;
        }
        return registerPrimaryActionShortcut(primaryButton);
    }, []);

    // v4 contract: errors surface inline in the banner, never as toasts.
    const showError = (message: string, _silent = false) => {
        setErrorMessage(message);
    };

    // Action-level guard errors (copy/download with no output, clipboard
    // failures) surface BOTH inline and as a toast: they are action feedback,
    // not input validation.
    const showActionError = (message: string) => {
        setErrorMessage(message);
        NotificationManager.show(message, 3000, { type: 'error' });
    };

    const showSuccess = (message: string) => {
        NotificationManager.show(message, 3000, { type: 'success' });
        setErrorMessage('');
    };

    const convertData = ({
        silent = false,
        nextInput = inputText,
        nextInputFormat = stateRef.current.inputFormat,
        nextOutputFormat = stateRef.current.outputFormat
    }: ConvertDataOptions = {}) => {
        const trimmedInput = nextInput.trim();
        if (!trimmedInput) {
            if (!silent) {
                showError('Please enter some data to convert.');
            }
            return;
        }

        try {
            converter.inputFormat = nextInputFormat;
            converter.outputFormat = nextOutputFormat;
            const internalData = converter.parseInput(trimmedInput, nextInputFormat);
            const converted = converter.formatOutput(internalData, nextOutputFormat);
            setOutputText(converted);

            if (!silent) {
                showSuccess(`Successfully converted from ${nextInputFormat.toUpperCase()} to ${nextOutputFormat.toUpperCase()}`);
            } else {
                setErrorMessage('');
            }
        } catch (error: unknown) {
            showError(`Conversion failed: ${getErrorMessage(error)}`, silent);
        }
    };

    const loadSampleData = ({
        nextInputFormat,
        nextOutputFormat
    }: Required<Pick<ConvertDataOptions, 'nextInputFormat' | 'nextOutputFormat'>>) => {
        const sampleInput = createSampleInput(converter, nextInputFormat);
        clearTimeout(debounceTimerRef.current as ReturnType<typeof setTimeout>);
        setInputText(sampleInput);
        setErrorMessage('');
        convertData({
            silent: true,
            nextInput: sampleInput,
            nextInputFormat,
            nextOutputFormat
        });
    };

    const handleInputChange = (event: Event) => {
        const target = event.target as HTMLTextAreaElement | null;
        const value = target?.value ?? '';
        setInputText(value);
        // Typing fresh input disables sample mode (v4 one-way sample contract).
        // Read the closure state, not stateRef: handlers are re-bound every
        // render, while stateRef writes race with deferred effect syncs.
        if (useSampleData) {
            setUseSampleData(false);
        }

        const autoConvertElement = document.getElementById('autoConvert') as HTMLInputElement | null;
        const shouldAutoConvert = autoConvertElement ? autoConvertElement.checked : stateRef.current.autoConvert;
        if (!shouldAutoConvert) {
            return;
        }

        clearTimeout(debounceTimerRef.current as ReturnType<typeof setTimeout>);
        debounceTimerRef.current = setTimeout(() => {
            const trimmed = value.trim();
            if (!trimmed) {
                return;
            }

            let detectedInputFormat = stateRef.current.inputFormat;
            const detected = converter.detectFormat(trimmed);
            if (detected && detected !== stateRef.current.inputFormat) {
                detectedInputFormat = detected;
                setInputFormat(detected);
            }

            convertData({
                silent: true,
                nextInput: trimmed,
                nextInputFormat: detectedInputFormat,
                nextOutputFormat: stateRef.current.outputFormat
            });
        }, 500);
    };

    // A dropped file is fresh input, so it follows the typing path rather than
    // the sample path: sample mode switches off, and the conversion still
    // honours the Auto-convert toggle. The debounce is skipped — a drop is one
    // discrete action, not a keystroke stream. Closure state (hence the deps),
    // not stateRef — see handleInputChange.
    useLayoutEffect(() => {
        if (!(inputTextAreaRef.current instanceof HTMLTextAreaElement)) {
            /* istanbul ignore next */
            return undefined;
        }

        return registerDropZone(inputTextAreaRef.current, {
            onText: (text, file) => {
                clearTimeout(debounceTimerRef.current as ReturnType<typeof setTimeout>);
                setInputText(text);
                setErrorMessage('');
                if (useSampleData) {
                    setUseSampleData(false);
                }
                NotificationManager.show(`Loaded ${file.name}`, 2000, { type: 'success' });

                const autoConvertElement = document.getElementById('autoConvert') as HTMLInputElement | null;
                const shouldAutoConvert = autoConvertElement ? autoConvertElement.checked : autoConvert;
                const trimmed = text.trim();
                if (!shouldAutoConvert || !trimmed) {
                    return;
                }

                let nextInputFormat = inputFormat;
                const detected = converter.detectFormat(trimmed);
                if (detected && detected !== inputFormat) {
                    nextInputFormat = detected;
                    setInputFormat(detected);
                }

                convertData({
                    silent: true,
                    nextInput: trimmed,
                    nextInputFormat,
                    nextOutputFormat: outputFormat
                });
            },
            onError: (message) => NotificationManager.show(message, 3000, { type: 'error' })
        });
    }, [useSampleData, autoConvert, inputFormat, outputFormat]);

    /**
     * Copy a shareable link carrying the input plus both format selections,
     * LZ-compressed into the hash fragment so the data never reaches a server.
     */
    const handleShare = async () => {
        if (!inputText.trim()) {
            NotificationManager.show('Enter some data before sharing.', 3000, { type: 'error' });
            return;
        }

        const payload: ConverterSharePayload = { input: inputText, inputFormat, outputFormat };
        const { buildShareUrl, SHARE_URL_MAX_LENGTH } = await import('./share-url');
        const url = buildShareUrl(window.location.href, payload);

        if (url.length > SHARE_URL_MAX_LENGTH) {
            NotificationManager.show(
                `This data is too large to share as a URL (limit ~${SHARE_URL_MAX_LENGTH} characters). Try Download instead.`,
                4000,
                { type: 'error' }
            );
            return;
        }

        try {
            await copyTextToClipboard(url);
            NotificationManager.show('Share link copied to clipboard!', 2000, { type: 'success' });
        } catch (error: unknown) {
            NotificationManager.show(`Failed to copy share link. ${getErrorMessage(error)}`, 3000, { type: 'error' });
        }
    };

    // Preload from a shared link once, on mount. A share link carries both
    // formats, so it converts immediately regardless of the Auto-convert
    // toggle: the sender already chose to share a finished conversion.
    // `useLayoutEffect` so the shared data is in place before first paint —
    // with `useEffect` the recipient sees an empty tool flash first (and it
    // has not run yet when jsdom tests assert).
    useLayoutEffect(() => {
        // Probe for the param before importing the share module: it pulls
        // lz-string, and only the few visitors arriving via a share link need
        // it. The literal must match `HASH_PARAM` in ./share-url (pinned by a
        // test).
        const { hash, search } = window.location;
        const hashValue = hash.startsWith('#') ? hash.slice(1) : hash;
        const carriesPayload =
            new URLSearchParams(hashValue).get('c') !== null ||
            new URLSearchParams(search).get('c') !== null;
        if (!carriesPayload) return;

        let active = true;
        void import('./share-url').then(({ resolveSharePayload }) => {
            // The chunk is async, so the user may have typed, dropped a file,
            // or loaded the sample while it downloaded. `active` alone only
            // catches unmount — a live component with fresh input would still
            // have been clobbered — so also require the input to be untouched.
            // Read the textarea rather than state or a ref: it is the only
            // source that is guaranteed current at this instant, with no
            // render or effect scheduled in between.
            const currentInput = inputTextAreaRef.current?.value ?? '';
            if (!active || currentInput !== '') return;
            applySharePayload(resolveSharePayload(window.location));
        });

        return () => {
            active = false;
        };
        // Intentionally mount-only: a share link is read once, and re-running
        // this would clobber whatever the user has typed since.
    }, []);

    const applySharePayload = ({ payload, source }: {
        payload: ConverterSharePayload | null;
        source: 'hash' | 'query' | null;
    }) => {
        if (!payload) return;

        stateRef.current = {
            ...stateRef.current,
            inputFormat: payload.inputFormat,
            outputFormat: payload.outputFormat
        };
        setInputFormat(payload.inputFormat);
        setOutputFormat(payload.outputFormat);
        setInputText(payload.input);
        setErrorMessage('');
        convertData({
            silent: true,
            nextInput: payload.input,
            nextInputFormat: payload.inputFormat,
            nextOutputFormat: payload.outputFormat
        });
        NotificationManager.show('Loaded data from shared link.', 2000, { type: 'success' });

        if (source === 'query') {
            NotificationManager.show(
                'Legacy ?c= preload detected. Prefer #c= to avoid leaking content in URLs.',
                4000,
                { type: 'warning' }
            );
        }
    };

    const handleInputFormatChange = (nextFormat: SupportedFormat) => {
        // Closure state (fresh per render), not stateRef — see handleInputChange.
        const sampleModeEnabled = useSampleData;
        stateRef.current = {
            ...stateRef.current,
            inputFormat: nextFormat
        };
        setInputFormat(nextFormat);
        setErrorMessage('');

        if (sampleModeEnabled) {
            loadSampleData({
                nextInputFormat: nextFormat,
                nextOutputFormat: outputFormat
            });
            return;
        }

        if (inputText) {
            setInputText('');
            NotificationManager.show('Input cleared', 3000, { type: 'success' });
        }
    };

    const handleOutputFormatChange = (nextFormat: SupportedFormat) => {
        stateRef.current = {
            ...stateRef.current,
            outputFormat: nextFormat
        };
        setOutputFormat(nextFormat);
        if (inputText.trim()) {
            convertData({
                silent: stateRef.current.autoConvert,
                nextInput: inputText,
                nextInputFormat: stateRef.current.inputFormat,
                nextOutputFormat: nextFormat
            });
        }
    };

    const handleAutoConvertToggle = (event: Event) => {
        const target = event.target as HTMLInputElement | null;
        const checked = Boolean(target?.checked);
        stateRef.current = {
            ...stateRef.current,
            autoConvert: checked
        };
        setAutoConvert(checked);

        if (checked) {
            convertData({
                silent: true,
                nextInput: inputText,
                nextInputFormat: inputFormat,
                nextOutputFormat: outputFormat
            });
        }
    };

    // v4 Phase C: sample mode is enabled via the uniform "Load Sample" ghost
    // button; typing fresh input disables it again (previously a checkbox).
    const handleLoadSampleClick = () => {
        const selectedInputFormat = getSelectedFormat('.input-section', inputFormat);
        const selectedOutputFormat = getSelectedFormat('.output-section', outputFormat);
        setUseSampleData(true);
        setInputFormat(selectedInputFormat);
        setOutputFormat(selectedOutputFormat);
        loadSampleData({
            nextInputFormat: selectedInputFormat,
            nextOutputFormat: selectedOutputFormat
        });
    };

    const handleSwap = () => {
        const swappedInputFormat = outputFormat;
        const swappedOutputFormat = inputFormat;
        const swappedInputText = outputText;
        const swappedOutputText = inputText;

        setInputFormat(swappedInputFormat);
        setOutputFormat(swappedOutputFormat);
        setInputText(swappedInputText);
        setOutputText(swappedOutputText);
        setErrorMessage('');

        if (swappedInputText.trim()) {
            convertData({
                silent: true,
                nextInput: swappedInputText,
                nextInputFormat: swappedInputFormat,
                nextOutputFormat: swappedOutputFormat
            });
        }
    };

    const handleClearInput = () => {
        setInputText('');
        setErrorMessage('');
        NotificationManager.show('Input cleared', 3000, { type: 'success' });
    };

    const handleCopyOutput = async () => {
        if (!outputText) {
            showActionError('No output to copy');
            return;
        }

        try {
            await copyToClipboard(outputText);
            NotificationManager.show('Copied to clipboard!', 3000, { type: 'success' });
        } catch (_error) {
            showActionError('Failed to copy output');
        }
    };

    const handleDownload = () => {
        if (!outputText) {
            showActionError('No data to download');
            return;
        }

        const downloadManager = new DownloadManager();
        downloadManager.downloadFile(
            outputText,
            `data.${EXTENSIONS[outputFormat]}`,
            MIME_TYPES[outputFormat]
        );
        showSuccess('Download started!');
    };

    return (
        <div id="data-format-converter-tool" className="tool-container dfc-tool c-tool-stack">
            <div className="dfc-main-content">
                <div className="converter-section o-grid-2col swap-container-wrapper">
                    <div className="input-section o-panel c-surface-card c-surface-panel">
                        <h3 className="dfc-panel-title">Input Format</h3>
                        <div className="format-selector dfc-format-selector" role="group" aria-label="Input Format">
                            {FORMATS.map((format) => (
                                <button
                                    key={`input-${format}`}
                                    className={`format-btn c-button c-button--small ${inputFormat === format ? 'active' : ''}`}
                                    data-format={format}
                                    aria-pressed={inputFormat === format ? 'true' : 'false'}
                                    onClick={() => handleInputFormatChange(format)}
                                >
                                    {formatLabel(format)}
                                </button>
                            ))}
                        </div>
                        <div className="textarea-actions dfc-textarea-actions dfc-legacy-inline-action">
                            <button
                                id="clearInputBtn"
                                className="c-button c-button--small c-button--outline"
                                type="button"
                                tabIndex={-1}
                                aria-hidden="true"
                                onClick={handleClearInput}
                            >
                                Clear
                            </button>
                        </div>
                        <textarea
                            id="inputText"
                            ref={inputTextAreaRef}
                            className="text-area c-input c-input--textarea"
                            placeholder={INPUT_PLACEHOLDERS[inputFormat]}
                            aria-label="Input data"
                            value={inputText}
                            onInput={handleInputChange}
                        />
                    </div>

                    <div className="swap-action-container">
                        <button
                            id="swapBtn"
                            className="c-button c-button--small c-button--outline"
                            title="Swap Input and Output"
                            aria-label="Swap Input and Output"
                            onClick={handleSwap}
                        >
                            Swap ⇄
                        </button>
                    </div>

                    <div className="output-section o-panel c-surface-card c-surface-panel">
                        <h3 className="dfc-panel-title">Output Format</h3>
                        <div className="format-selector dfc-format-selector" role="group" aria-label="Output Format">
                            {FORMATS.map((format) => (
                                <button
                                    key={`output-${format}`}
                                    className={`format-btn c-button c-button--small ${outputFormat === format ? 'active' : ''}`}
                                    data-format={format}
                                    aria-pressed={outputFormat === format ? 'true' : 'false'}
                                    onClick={() => handleOutputFormatChange(format)}
                                >
                                    {formatLabel(format)}
                                </button>
                            ))}
                        </div>
                        <div className="textarea-actions dfc-textarea-actions dfc-legacy-inline-action">
                            <button
                                id="copyOutputBtn"
                                className="c-button c-button--small c-button--outline"
                                type="button"
                                tabIndex={-1}
                                aria-hidden="true"
                                onClick={() => void handleCopyOutput()}
                            >
                                Copy
                            </button>
                        </div>
                        <textarea
                            id="outputText"
                            ref={outputTextAreaRef}
                            className="text-area c-input c-input--textarea"
                            placeholder="Converted data will appear here..."
                            readOnly
                            aria-label="Output data"
                            value={outputText}
                        />
                    </div>
                </div>

                <div className="c-options-panel c-action-strip u-text-center dfc-primary-actions">
                    <button id="loadSampleBtn" type="button" className="c-button c-button--ghost dfc-load-sample-btn" onClick={handleLoadSampleClick}>
                        Load Sample
                    </button>
                    <label className="c-checkbox dfc-auto-convert-label">
                        <input
                            type="checkbox"
                            id="autoConvert"
                            checked={autoConvert}
                            onChange={handleAutoConvertToggle}
                        />
                        <span>Auto-convert</span>
                    </label>
                    <span className="c-toolbar__spacer" />
                    <button id="convertBtn" className="convert-btn c-button dfc-convert-btn" onClick={() => convertData()}>
                        Convert Data
                        <span className="c-kbd" aria-hidden="true">⌘⏎</span>
                    </button>
                    <button
                        id="downloadBtn"
                        type="button"
                        className="c-button c-button--small c-button--icon-download"
                        onClick={handleDownload}
                    >
                        Download
                    </button>
                    <button
                        id="shareBtn"
                        type="button"
                        className="c-button c-button--small c-button--icon-share dfc-share-btn"
                        onClick={() => void handleShare()}
                    >
                        Share
                    </button>
                </div>

                <div
                    id="inputError"
                    className="error dfc-status-banner c-status-banner"
                    style={{ display: errorMessage ? 'block' : 'none' }}
                >
                    {errorMessage}
                </div>
                <div id="notification" className="c-notification" role="status" aria-live="polite" />
            </div>

            {/* Tool-first ordering: About intro + guide below the interactive tool. */}
            <DataFormatConverterIntro />
            <DataFormatConverterArticle />
        </div>
    );
}

export class DataFormatConverterUI {
    converter: DataFormatConverter;

    constructor(rootSelector = '#data-format-converter-app') {
        this.converter = new DataFormatConverter();
        const root = (document.querySelector(rootSelector) || document.querySelector('.tool-container')) as Element | null;
        if (!root) {
            throw new Error('Data Format Converter root element not found');
        }
        const mount = root.hasChildNodes() ? hydrate : render;
        mount(<DataFormatConverterApp converter={this.converter} />, root);
    }
}

// Initialize the converter when the page loads
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        mountToolShell({
            title: toolMetadata.title,
            description: toolMetadata.description,
            homeHref: '/'
        });
        new DataFormatConverterUI();
    });
}
