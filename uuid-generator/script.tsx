import { hydrate, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { trackToolUsed, utf8ByteLength, type ToolUsedOutcome, type ToolUsedTrigger } from '../common/analytics-events';
import ClearButton from '../common/clear-button/ClearButton';
import CopyButton from '../common/copy-button/CopyButton';
import DownloadManager from '../common/DownloadManager';
import { NotificationManager } from '../common/notification-manager';
import { registerPrimaryActionShortcut } from '../common/shortcut-utils';
import {
    MAX_UUID_COUNT,
    WORKED_EXAMPLE_V4,
    WORKED_EXAMPLE_V7,
    generateUuids,
    parseUuidCount,
    parseUuidList,
    type ParsedUuid,
    type UuidVersion
} from './uuid';
import toolMetadata from './tool.meta.json';

const DOWNLOAD_FILENAME = 'uuids.txt';
const ANALYTICS_TOOL_ID = 'uuid-generator';

function generateAction(version: UuidVersion): string {
    return version === 7 ? 'generate-v7' : 'generate-v4';
}

function reportToolUsed(action: string, outcome: ToolUsedOutcome, trigger: ToolUsedTrigger, inputBytes: number): void {
    trackToolUsed({
        toolId: ANALYTICS_TOOL_ID,
        action,
        inputBytes,
        trigger,
        outcome
    });
}

export function UuidGeneratorApp(): JSX.Element {
    const [version, setVersion] = useState<UuidVersion>(4);
    const [count, setCount] = useState('1');
    const [uppercase, setUppercase] = useState(false);
    const [noHyphens, setNoHyphens] = useState(false);
    const [output, setOutput] = useState('');
    const [generateError, setGenerateError] = useState('');
    const [validateInput, setValidateInput] = useState('');
    const [validateError, setValidateError] = useState('');
    const [validateResults, setValidateResults] = useState<ParsedUuid[]>([]);
    const outputRef = useRef<HTMLTextAreaElement>(null);
    const validateRef = useRef<HTMLTextAreaElement>(null);
    const clearButtonRef = useRef<ClearButton | null>(null);
    const copyButtonRef = useRef<CopyButton | null>(null);

    useEffect(() => {
        if (!(validateRef.current instanceof HTMLTextAreaElement)) {
            return undefined;
        }

        const inputEl = validateRef.current;
        clearButtonRef.current = new ClearButton(inputEl);

        const handleTextCleared = () => {
            setValidateInput('');
            setValidateError('');
            setValidateResults([]);
            NotificationManager.show('Input cleared', 2000, { type: 'success' });
        };

        inputEl.addEventListener('textCleared', handleTextCleared);

        return () => {
            inputEl.removeEventListener('textCleared', handleTextCleared);
            clearButtonRef.current?.disconnect?.();
        };
    }, []);

    useEffect(() => {
        clearButtonRef.current?.updateVisibility?.();
    }, [validateInput]);

    useEffect(() => {
        if (!(outputRef.current instanceof HTMLTextAreaElement)) {
            return undefined;
        }

        const outputEl = outputRef.current;
        copyButtonRef.current = new CopyButton(outputEl);

        const handleContentCopied = () => {
            NotificationManager.show('Copied to clipboard!', 2000, { type: 'success' });
        };

        outputEl.addEventListener('contentCopied', handleContentCopied);

        return () => {
            outputEl.removeEventListener('contentCopied', handleContentCopied);
            copyButtonRef.current?.disconnect?.();
        };
    }, []);

    useEffect(() => {
        copyButtonRef.current?.updateVisibility?.();
    }, [output]);

    useEffect(() => {
        const primaryButton = document.getElementById('uuid-generate');
        if (!primaryButton) {
            return undefined;
        }
        return registerPrimaryActionShortcut(primaryButton);
    }, []);

    const runGenerate = () => {
        const parsedCount = parseUuidCount(count);
        const action = generateAction(version);

        if (parsedCount.ok === false) {
            setOutput('');
            setGenerateError(parsedCount.message);
            reportToolUsed(action, 'error', 'user', utf8ByteLength(count));
            return;
        }

        const lines = generateUuids({
            version,
            count: parsedCount.count,
            uppercase,
            hyphens: !noHyphens
        });
        const nextOutput = lines.join('\n');

        setGenerateError('');
        setOutput(nextOutput);
        reportToolUsed(action, 'success', 'user', utf8ByteLength(nextOutput));
        NotificationManager.show(parsedCount.count === 1 ? 'Generated 1 UUID' : `Generated ${parsedCount.count} UUIDs`, 2000, { type: 'success' });
    };

    const runValidate = (source = validateInput, trigger: ToolUsedTrigger = 'user') => {
        if (source.trim().length === 0) {
            setValidateResults([]);
            setValidateError('Paste a UUID to validate.');
            return;
        }

        const results = parseUuidList(source);
        const outcome: ToolUsedOutcome = results.every((item) => item.valid) ? 'success' : 'error';

        setValidateError('');
        setValidateResults(results);
        reportToolUsed('validate', outcome, trigger, utf8ByteLength(source));
    };

    const loadSample = () => {
        const sample = `${WORKED_EXAMPLE_V7}\n${WORKED_EXAMPLE_V4}`;
        setValidateInput(sample);
        runValidate(sample, 'sample');
    };

    const downloadOutput = () => {
        if (!output) {
            return;
        }

        const downloadManager = new DownloadManager();
        downloadManager.downloadFile(output, DOWNLOAD_FILENAME, 'text/plain');
        NotificationManager.show('Downloaded uuids.txt', 2000, { type: 'success' });
    };

    return (
        <div id="uuid-generator-tool" className="uuid-generator-container tool-container uuidg-tool c-tool-stack">
            <div className="o-panel c-surface-card c-surface-panel">
                <div className="o-panel-header c-surface-panel__header">
                    <h3>Generate</h3>
                </div>
                <div className="uuidg-options">
                    <fieldset className="uuidg-fieldset">
                        <legend>Version</legend>
                        <div className="c-checkbox-row">
                            <div className="c-checkbox-item c-checkbox-card">
                                <input
                                    type="radio"
                                    id="uuid-version-v4"
                                    name="uuid-version"
                                    checked={version === 4}
                                    onChange={() => setVersion(4)}
                                />
                                <label htmlFor="uuid-version-v4">Version 4</label>
                            </div>
                            <div className="c-checkbox-item c-checkbox-card">
                                <input
                                    type="radio"
                                    id="uuid-version-v7"
                                    name="uuid-version"
                                    checked={version === 7}
                                    onChange={() => setVersion(7)}
                                />
                                <label htmlFor="uuid-version-v7">Version 7</label>
                            </div>
                        </div>
                    </fieldset>
                    <div className="uuidg-count-field">
                        <label htmlFor="uuid-count">Count (1–{MAX_UUID_COUNT})</label>
                        <input
                            id="uuid-count"
                            className="c-input uuidg-count"
                            type="number"
                            min={1}
                            max={MAX_UUID_COUNT}
                            inputMode="numeric"
                            value={count}
                            aria-invalid={generateError ? 'true' : 'false'}
                            onInput={(event) => setCount((event.target as HTMLInputElement).value)}
                        />
                    </div>
                    <div className="c-checkbox-item c-checkbox-card">
                        <input
                            type="checkbox"
                            id="uuid-uppercase"
                            checked={uppercase}
                            onChange={(event) => setUppercase((event.target as HTMLInputElement).checked)}
                        />
                        <label htmlFor="uuid-uppercase">Uppercase</label>
                    </div>
                    <div className="c-checkbox-item c-checkbox-card">
                        <input
                            type="checkbox"
                            id="uuid-no-hyphens"
                            checked={noHyphens}
                            onChange={(event) => setNoHyphens((event.target as HTMLInputElement).checked)}
                        />
                        <label htmlFor="uuid-no-hyphens">No hyphens</label>
                    </div>
                </div>
                <div
                    id="uuid-generate-error"
                    className={`c-input-status${generateError ? ' error' : ''}`}
                    role={generateError ? 'alert' : 'status'}
                    aria-live="polite"
                >
                    {generateError}
                </div>
                <div className="c-action-strip">
                    <span className="c-toolbar__spacer" />
                    <button id="uuid-generate" className="c-button" type="button" onClick={runGenerate}>
                        Generate
                        <span className="c-kbd" aria-hidden="true">⌘⏎</span>
                    </button>
                </div>
            </div>

            <div className="o-panel c-surface-card c-surface-panel">
                <div className="o-panel-header c-surface-panel__header">
                    <h3>Generated UUIDs</h3>
                </div>
                <textarea
                    id="uuid-output"
                    ref={outputRef}
                    className="c-input c-input--textarea uuidg-textarea"
                    readOnly
                    placeholder="Generated UUIDs will appear here..."
                    aria-label="Generated UUIDs"
                    value={output}
                />
                <div className="c-action-strip">
                    <span className="c-toolbar__spacer" />
                    <button
                        id="uuid-download"
                        className="c-button c-button--secondary"
                        type="button"
                        onClick={downloadOutput}
                        disabled={!output}
                    >
                        Download
                    </button>
                </div>
            </div>

            <div className="o-panel c-surface-card c-surface-panel">
                <div className="o-panel-header c-surface-panel__header">
                    <h3>Validate</h3>
                </div>
                <textarea
                    id="uuid-validate-input"
                    ref={validateRef}
                    className="c-input c-input--textarea uuidg-textarea"
                    placeholder="Paste one UUID per line..."
                    aria-label="UUID to validate"
                    value={validateInput}
                    onInput={(event) => setValidateInput((event.target as HTMLTextAreaElement).value)}
                />
                <div
                    id="uuid-validate-error"
                    className={`c-input-status${validateError ? ' error' : ''}`}
                    role={validateError ? 'alert' : 'status'}
                    aria-live="polite"
                >
                    {validateError}
                </div>
                <div className="c-action-strip">
                    <button id="uuid-load-sample" className="c-button c-button--ghost" type="button" onClick={loadSample}>
                        Load Sample
                    </button>
                    <span className="c-toolbar__spacer" />
                    <button id="uuid-validate" className="c-button" type="button" onClick={() => runValidate()}>
                        Validate
                    </button>
                </div>
                <div id="uuid-validate-result" aria-live="polite">
                    {validateResults.length > 0 ? <ValidateResultList results={validateResults} /> : null}
                </div>
            </div>

            <div id="notification" className="c-notification" role="status" aria-live="polite" />
        </div>
    );
}

function ValidateResultList({ results }: { results: ParsedUuid[] }): JSX.Element {
    return (
        <ol className="uuidg-results">
            {results.map((item, index) => (
                <li className="uuidg-result c-surface-card" key={`${index}-${item.valid ? item.canonical : 'invalid'}`}>
                    {item.valid === false ? (
                        <p><strong>Not a UUID.</strong> {item.reason}</p>
                    ) : (
                        <>
                            <p><strong>Valid</strong> <code>{item.canonical}</code></p>
                            <p>Version {item.versionLabel}</p>
                            <p>Variant {item.variantLabel}</p>
                            {item.timestampIso ? (
                                <p>Timestamp {item.timestampIso} ({item.timestampMs} ms)</p>
                            ) : null}
                            {item.nil ? <p>Nil UUID</p> : null}
                            {item.max ? <p>Max UUID</p> : null}
                        </>
                    )}
                </li>
            ))}
        </ol>
    );
}

export class UuidGeneratorToolUI {
    constructor(rootSelector = '#uuid-generator-app') {
        const root = document.querySelector(rootSelector) || document.querySelector('#uuid-generator-tool');
        if (!root) {
            throw new Error('UUID Generator root element not found');
        }

        const mount = root.hasChildNodes() ? hydrate : render;
        mount(<UuidGeneratorApp />, root);
    }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', () => {
        mountToolShell({
            title: toolMetadata.title,
            description: toolMetadata.description,
            homeHref: '/'
        });

        new UuidGeneratorToolUI();
    });
}
