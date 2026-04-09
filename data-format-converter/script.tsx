import { DataFormatConverter } from './DataFormatConverter';
import { NotificationManager } from '../common/notification-manager';
import DownloadManager from '../common/DownloadManager';
import ClearButton from '../common/clear-button/ClearButton';
import CopyButton from '../common/copy-button/CopyButton';
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
}

interface ConvertDataOptions {
    silent?: boolean;
    nextInput?: string;
    nextInputFormat?: SupportedFormat;
    nextOutputFormat?: SupportedFormat;
}

const FORMATS: SupportedFormat[] = ['json', 'xml', 'yaml', 'properties'];
const INPUT_PLACEHOLDERS: Record<SupportedFormat, string> = {
    json: 'Paste your JSON data here...\n\nExample:\n{\n  "name": "John",\n  "age": 30,\n  "city": "New York"\n}',
    xml: 'Paste your XML data here...\n\nExample:\n<person>\n  <name>John</name>\n  <age>30</age>\n  <city>New York</city>\n</person>',
    yaml: 'Paste your YAML data here...\n\nExample:\nname: John\nage: 30\ncity: New York',
    properties: 'Paste your Properties data here...\n\nExample:\nname=John\nage=30\ncity=New York'
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

export function DataFormatConverterApp({ converter }: DataFormatConverterAppProps) {
    const [inputFormat, setInputFormat] = useState<SupportedFormat>(converter.inputFormat);
    const [outputFormat, setOutputFormat] = useState<SupportedFormat>(converter.outputFormat);
    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [autoConvert, setAutoConvert] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stateRef = useRef<ConverterStateSnapshot>({ inputFormat, outputFormat, autoConvert });
    const inputTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const outputTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const clearOverlayButtonRef = useRef<ClearButton | null>(null);
    const copyOverlayButtonRef = useRef<CopyButton | null>(null);

    useEffect(() => {
        stateRef.current = { inputFormat, outputFormat, autoConvert };
        converter.inputFormat = inputFormat;
        converter.outputFormat = outputFormat;
    }, [inputFormat, outputFormat, autoConvert, converter]);

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

    const showError = (message: string, silent = false) => {
        if (!silent) {
            NotificationManager.show(message, 3000, { type: 'error' });
        }
        setErrorMessage(message);
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

    const handleInputChange = (event: Event) => {
        const target = event.target as HTMLTextAreaElement | null;
        const value = target?.value ?? '';
        setInputText(value);

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

    const handleInputFormatChange = (nextFormat: SupportedFormat) => {
        stateRef.current = {
            ...stateRef.current,
            inputFormat: nextFormat
        };
        setInputFormat(nextFormat);
        setErrorMessage('');

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
            showError('No output to copy');
            return;
        }

        try {
            await copyToClipboard(outputText);
            NotificationManager.show('Copied to clipboard!', 3000, { type: 'success' });
        } catch (_error) {
            showError('Failed to copy output');
        }
    };

    const handleDownload = () => {
        if (!outputText) {
            showError('No data to download');
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
            <DataFormatConverterIntro />

            <main className="dfc-main-content">
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
                    <label className="c-checkbox dfc-auto-convert-label">
                        <input
                            type="checkbox"
                            id="autoConvert"
                            checked={autoConvert}
                            onChange={handleAutoConvertToggle}
                        />
                        <span>Auto-convert</span>
                    </label>
                    <button id="convertBtn" className="convert-btn c-button dfc-convert-btn" onClick={() => convertData()}>
                        Convert Data
                    </button>
                    <button
                        id="downloadBtn"
                        type="button"
                        className="c-button c-button--small c-button--icon-download"
                        onClick={handleDownload}
                    >
                        Download
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
            </main>

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
