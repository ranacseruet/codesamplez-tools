import { hydrate, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { trackCopyOutput, trackToolUsed, utf8ByteLength, type ToolUsedOutcome, type ToolUsedTrigger } from '../common/analytics-events';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import ClearButton from '../common/clear-button/ClearButton';
import { copyTextToClipboard } from '../common/clipboard';
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
const VERSION_IDS: Record<UuidVersion, string> = {
    4: 'uuid-version-v4',
    7: 'uuid-version-v7'
};

interface GeneratedBatch {
    lines: string[];
    version: UuidVersion;
}

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

function nextVersion(current: UuidVersion, key: string): UuidVersion | null {
    if (key === 'Home') {
        return 4;
    }
    if (key === 'End') {
        return 7;
    }
    if (key === 'ArrowRight' || key === 'ArrowDown') {
        return current === 4 ? 7 : 4;
    }
    if (key === 'ArrowLeft' || key === 'ArrowUp') {
        return current === 7 ? 4 : 7;
    }
    return null;
}

async function copyValue(value: string): Promise<void> {
    try {
        await copyTextToClipboard(value);
        trackCopyOutput();
        NotificationManager.show('Copied to clipboard!', 2000, { type: 'success' });
    } catch (error) {
        console.error('Copy failed:', error);
        NotificationManager.show('Could not copy', 2000, { type: 'error' });
    }
}

export function UuidGeneratorApp(): JSX.Element {
    const [version, setVersion] = useState<UuidVersion>(4);
    const [count, setCount] = useState('1');
    const [uppercase, setUppercase] = useState(false);
    const [noHyphens, setNoHyphens] = useState(false);
    const [batch, setBatch] = useState<GeneratedBatch | null>(null);
    const [generateError, setGenerateError] = useState('');
    const [validateInput, setValidateInput] = useState('');
    const [validateError, setValidateError] = useState('');
    const [validateResults, setValidateResults] = useState<ParsedUuid[]>([]);
    const validateRef = useRef<HTMLTextAreaElement>(null);
    const clearButtonRef = useRef<ClearButton | null>(null);

    useEffect(() => {
        setBatch({
            lines: generateUuids({
                version: 4,
                count: 1,
                uppercase: false,
                hyphens: true
            }),
            version: 4
        });
    }, []);

    useEffect(() => {
        const inputEl = validateRef.current as HTMLTextAreaElement;
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
        return registerPrimaryActionShortcut(document.getElementById('uuid-generate') as HTMLElement);
    }, []);

    const selectVersion = (next: UuidVersion, moveFocus = false) => {
        setVersion(next);
        if (moveFocus) {
            document.getElementById(VERSION_IDS[next])?.focus();
        }
    };

    const onVersionKeyDown = (event: KeyboardEvent) => {
        const next = nextVersion(version, event.key);
        if (next === null) {
            return;
        }
        event.preventDefault();
        selectVersion(next, true);
    };

    const runGenerate = () => {
        const parsedCount = parseUuidCount(count);
        const action = generateAction(version);

        if (parsedCount.ok === false) {
            setBatch(null);
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

        setGenerateError('');
        setBatch({ lines, version });
        reportToolUsed(action, 'success', 'user', utf8ByteLength(lines.join('\n')));
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
        if (!batch || batch.lines.length === 0) {
            return;
        }

        const downloadManager = new DownloadManager();
        downloadManager.downloadFile(batch.lines.join('\n'), DOWNLOAD_FILENAME, 'text/plain');
        NotificationManager.show('Downloaded uuids.txt', 2000, { type: 'success' });
    };

    const copyAll = () => {
        if (!batch || batch.lines.length === 0) {
            return;
        }
        void copyValue(batch.lines.join('\n'));
    };

    return (
        <div id="uuid-generator-tool" className="uuid-generator-container tool-container uuidg-tool c-tool-stack">
            <div className="c-workbench c-workbench--two-col uuidg-workbench">
                <div className="uuidg-toolbar c-action-strip c-toolbar">
                    <div
                        className="c-tab-list"
                        role="radiogroup"
                        aria-label="UUID version"
                        onKeyDown={onVersionKeyDown}
                    >
                        <button
                            id="uuid-version-v4"
                            className={`c-tab-button${version === 4 ? ' active' : ''}`}
                            type="button"
                            role="radio"
                            aria-checked={version === 4 ? 'true' : 'false'}
                            tabIndex={version === 4 ? 0 : -1}
                            onClick={() => selectVersion(4)}
                        >
                            Version 4
                        </button>
                        <button
                            id="uuid-version-v7"
                            className={`c-tab-button${version === 7 ? ' active' : ''}`}
                            type="button"
                            role="radio"
                            aria-checked={version === 7 ? 'true' : 'false'}
                            tabIndex={version === 7 ? 0 : -1}
                            onClick={() => selectVersion(7)}
                        >
                            Version 7
                        </button>
                    </div>
                    <div className="uuidg-count-field">
                        <label htmlFor="uuid-count">Count (1–{MAX_UUID_COUNT})</label>
                        <input
                            id="uuid-count"
                            className={`c-input uuidg-count${generateError ? ' c-input--error' : ''}`}
                            type="number"
                            min={1}
                            max={MAX_UUID_COUNT}
                            inputMode="numeric"
                            value={count}
                            aria-invalid={generateError ? 'true' : 'false'}
                            aria-describedby={generateError ? 'uuid-generate-error' : undefined}
                            onInput={(event) => setCount((event.target as HTMLInputElement).value)}
                        />
                    </div>
                    <div className="uuidg-format" role="group" aria-label="Format">
                        <div className="c-checkbox-item">
                            <input
                                type="checkbox"
                                id="uuid-uppercase"
                                checked={uppercase}
                                onChange={(event) => setUppercase((event.target as HTMLInputElement).checked)}
                            />
                            <label htmlFor="uuid-uppercase">Uppercase</label>
                        </div>
                        <div className="c-checkbox-item">
                            <input
                                type="checkbox"
                                id="uuid-no-hyphens"
                                checked={noHyphens}
                                onChange={(event) => setNoHyphens((event.target as HTMLInputElement).checked)}
                            />
                            <label htmlFor="uuid-no-hyphens">No hyphens</label>
                        </div>
                    </div>
                    <span className="c-toolbar__spacer" />
                    <button id="uuid-generate" className="c-button" type="button" onClick={runGenerate}>
                        Generate
                        <span className="c-kbd" aria-hidden="true">⌘⏎</span>
                    </button>
                    <div
                        id="uuid-generate-error"
                        className={`c-input-status uuidg-generate-error${generateError ? ' error' : ''}`}
                        role={generateError ? 'alert' : 'status'}
                        aria-live="polite"
                    >
                        {generateError}
                    </div>
                </div>

                <section className="o-panel c-surface-card c-surface-panel uuidg-output-panel" aria-labelledby="uuid-output-heading">
                    <div className="o-panel-header c-surface-panel__header uuidg-output-header">
                        <h3 id="uuid-output-heading">Generated UUIDs</h3>
                        <div className="uuidg-output-toolbar">
                            {batch && batch.lines.length > 0 ? (
                                <span className="c-status-chip" id="uuid-output-chip">{`${batch.lines.length} · Version ${batch.version}`}</span>
                            ) : null}
                            <button
                                id="uuid-copy-all"
                                className="c-button c-button--secondary"
                                type="button"
                                onClick={copyAll}
                                disabled={!batch || batch.lines.length === 0}
                            >
                                Copy all
                            </button>
                            <button
                                id="uuid-download"
                                className="c-button c-button--secondary"
                                type="button"
                                onClick={downloadOutput}
                                disabled={!batch || batch.lines.length === 0}
                            >
                                Download
                            </button>
                        </div>
                    </div>
                    <div className="o-panel-content c-surface-panel__content uuidg-output-content">
                        <div id="uuid-output" className="uuidg-output-well">
                            {batch && batch.lines.length > 0 ? (
                                <ol className="c-code-output uuidg-lines">
                                    {batch.lines.map((line, index) => (
                                        <li className="uuidg-line" key={`${index}-${line}`}>
                                            <code>{line}</code>
                                            <button
                                                className="c-button c-button--secondary"
                                                type="button"
                                                aria-label={`Copy UUID ${line}`}
                                                onClick={() => { void copyValue(line); }}
                                            >
                                                Copy
                                            </button>
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <div className="c-empty-state" id="uuid-empty-state">
                                    <span className="c-empty-state__icon" aria-hidden="true">
                                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <path d="M14 2v6h6" />
                                            <path d="M9 13h6M9 17h6" />
                                        </svg>
                                    </span>
                                    <p className="c-empty-state__message">Generated UUIDs will appear here</p>
                                    <p className="c-empty-state__hint">Choose a version and count, then run Generate.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <section className="o-panel c-surface-card c-surface-panel uuidg-validate-panel" aria-labelledby="uuid-validate-heading">
                    <div className="o-panel-header c-surface-panel__header">
                        <h3 id="uuid-validate-heading">Validate</h3>
                    </div>
                    <div className="o-panel-content c-surface-panel__content">
                        <textarea
                            id="uuid-validate-input"
                            ref={validateRef}
                            className={`c-input c-input--textarea c-editor-fill uuidg-textarea${validateError ? ' c-input--error' : ''}`}
                            placeholder="Paste one UUID per line..."
                            aria-label="UUID to validate"
                            aria-invalid={validateError ? 'true' : 'false'}
                            aria-describedby={validateError ? 'uuid-validate-error' : undefined}
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
                        <div className="c-toolbar uuidg-validate-actions">
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
                </section>
            </div>

            <div id="notification" className="c-notification" role="status" aria-live="polite" />
        </div>
    );
}

function ValidateResultList({ results }: { results: ParsedUuid[] }): JSX.Element {
    return (
        <ol className="uuidg-results">
            {results.map((item, index) => (
                <li className="uuidg-result" key={`${index}-${item.valid ? item.canonical : 'invalid'}`}>
                    {item.valid === false ? (
                        <div className="c-status-banner status-error">
                            <p><strong>Not a UUID.</strong> {item.reason}</p>
                        </div>
                    ) : (
                        <>
                            <div className="c-status-banner status-success uuidg-valid-banner">
                                <p><strong>Valid</strong> <code>{item.canonical}</code></p>
                                <button
                                    className="c-button c-button--secondary"
                                    type="button"
                                    aria-label={`Copy UUID ${item.canonical}`}
                                    onClick={() => { void copyValue(item.canonical); }}
                                >
                                    Copy
                                </button>
                            </div>
                            <div className="c-stats-panel">
                                <div className="c-stat-row">
                                    <span>Version</span>
                                    <span>{` ${item.versionLabel}`}</span>
                                </div>
                                <div className="c-stat-row">
                                    <span>Variant</span>
                                    <span>{` ${item.variantLabel}`}</span>
                                </div>
                                {item.timestampIso ? (
                                    <div className="c-stat-row">
                                        <span>Timestamp</span>
                                        <span>{` ${item.timestampIso} (${item.timestampMs} ms)`}</span>
                                    </div>
                                ) : null}
                            </div>
                            {item.nil || item.max ? (
                                <div className="uuidg-flags">
                                    {item.nil ? <span className="c-status-chip">Nil UUID</span> : null}
                                    {item.max ? <span className="c-status-chip">Max UUID</span> : null}
                                </div>
                            ) : null}
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
