import { hydrate, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { trackToolUsed, utf8ByteLength, type ToolUsedOutcome, type ToolUsedTrigger } from '../common/analytics-events';
import { buildSiteHref } from '../common/siteBaseUrl';
import ClearButton from '../common/clear-button/ClearButton';
import CopyButton from '../common/copy-button/CopyButton';
import { NotificationManager } from '../common/notification-manager';
import { registerPrimaryActionShortcut } from '../common/shortcut-utils';
import {
    COMMON_TIME_ZONES,
    WORKED_EXAMPLE_EPOCH,
    WORKED_EXAMPLE_ZONE,
    conversionLines,
    convertDate,
    convertEpoch,
    convertJwtNumericDate,
    type ConversionResult,
    type TimestampUnitChoice
} from './timestamp';
import toolMetadata from './tool.meta.json';

const ANALYTICS_TOOL_ID = 'timestamp-converter';

function browserTimeZone(): string {
    try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return typeof zone === 'string' && zone.length > 0 ? zone : 'UTC';
    } catch {
        return 'UTC';
    }
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

export function TimestampConverterApp(): JSX.Element {
    const [nowSeconds, setNowSeconds] = useState('');
    const [nowIso, setNowIso] = useState('');
    const [epochInput, setEpochInput] = useState('');
    const [unit, setUnit] = useState<TimestampUnitChoice>('auto');
    const [timeZone, setTimeZone] = useState('UTC');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [millisecond, setMillisecond] = useState('');
    const [jwtInput, setJwtInput] = useState('');
    const [error, setError] = useState('');
    const [lines, setLines] = useState<string[]>([]);
    const [report, setReport] = useState('');
    const epochRef = useRef<HTMLTextAreaElement>(null);
    const outputRef = useRef<HTMLTextAreaElement>(null);
    const clearButtonRef = useRef<ClearButton | null>(null);
    const copyButtonRef = useRef<CopyButton | null>(null);

    useEffect(() => {
        const tick = () => {
            const now = Date.now();
            setNowSeconds(String(Math.floor(now / 1000)));
            setNowIso(new Date(now).toISOString());
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!(epochRef.current instanceof HTMLTextAreaElement)) {
            return undefined;
        }

        const inputEl = epochRef.current;
        clearButtonRef.current = new ClearButton(inputEl);

        const handleTextCleared = () => {
            setEpochInput('');
            setError('');
            setLines([]);
            setReport('');
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
    }, [epochInput]);

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
    }, [report]);

    useEffect(() => {
        const primaryButton = document.getElementById('tsc-convert');
        if (!primaryButton) {
            return undefined;
        }
        return registerPrimaryActionShortcut(primaryButton);
    }, []);

    const showResult = (result: ConversionResult, action: string, trigger: ToolUsedTrigger, input: string) => {
        if (result.ok === false) {
            setLines([]);
            setReport('');
            setError(result.message);
            reportToolUsed(action, 'error', trigger, utf8ByteLength(input));
            return;
        }

        const nextLines = conversionLines(result.value);
        setError('');
        setLines(nextLines);
        setReport(nextLines.join('\n'));
        reportToolUsed(action, 'success', trigger, utf8ByteLength(input));
        NotificationManager.show('Converted', 2000, { type: 'success' });
    };

    const runEpoch = (input: string, unitChoice: TimestampUnitChoice, zone: string, trigger: ToolUsedTrigger) => {
        if (input.trim().length === 0) {
            setLines([]);
            setReport('');
            setError('Enter a timestamp.');
            return;
        }

        showResult(convertEpoch({
            input,
            unit: unitChoice,
            timeZone: zone,
            localTimeZone: browserTimeZone(),
            nowMs: Date.now()
        }), 'convert-epoch', trigger, input);
    };

    const runDate = () => {
        if (date.trim().length === 0 || time.trim().length === 0) {
            setLines([]);
            setReport('');
            setError('Enter a date and time.');
            return;
        }

        showResult(convertDate({
            date,
            time,
            millisecond,
            timeZone,
            localTimeZone: browserTimeZone(),
            nowMs: Date.now()
        }), 'convert-date', 'user', `${date}T${time}`);
    };

    const runJwt = () => {
        if (jwtInput.trim().length === 0) {
            setLines([]);
            setReport('');
            setError('Enter a JWT exp, iat, or nbf value in seconds.');
            return;
        }

        showResult(convertJwtNumericDate({
            input: jwtInput,
            unit: 'seconds',
            timeZone,
            localTimeZone: browserTimeZone(),
            nowMs: Date.now()
        }), 'convert-jwt', 'user', jwtInput);
    };

    const useCurrentTime = () => {
        const seconds = String(Math.floor(Date.now() / 1000));
        setEpochInput(seconds);
        setUnit('seconds');
        runEpoch(seconds, 'seconds', timeZone, 'user');
    };

    const loadSample = () => {
        setEpochInput(WORKED_EXAMPLE_EPOCH);
        setUnit('auto');
        setTimeZone(WORKED_EXAMPLE_ZONE);
        runEpoch(WORKED_EXAMPLE_EPOCH, 'auto', WORKED_EXAMPLE_ZONE, 'sample');
    };

    return (
        <div id="timestamp-converter-tool" className="timestamp-converter-container tool-container tsc-tool c-tool-stack">
            <div className="o-panel c-surface-card c-surface-panel">
                <div className="o-panel-header c-surface-panel__header">
                    <h3>Current Unix time</h3>
                </div>
                <p id="tsc-now" className="tsc-now">{nowSeconds ? `${nowSeconds} · ${nowIso}` : '—'}</p>
                <div className="c-action-strip">
                    <span className="c-toolbar__spacer" />
                    <button id="tsc-use-now" className="c-button c-button--secondary" type="button" onClick={useCurrentTime}>
                        Use this time
                    </button>
                </div>
            </div>

            <div className="o-panel c-surface-card c-surface-panel">
                <div className="o-panel-header c-surface-panel__header">
                    <h3>Epoch to date</h3>
                </div>
                <div className="tsc-options">
                    <div className="tsc-field">
                        <label htmlFor="tsc-unit">Unit</label>
                        <select
                            id="tsc-unit"
                            className="c-input tsc-unit"
                            value={unit}
                            onChange={(event) => setUnit((event.target as HTMLSelectElement).value as TimestampUnitChoice)}
                        >
                            <option value="auto">Auto</option>
                            <option value="seconds">Seconds</option>
                            <option value="milliseconds">Milliseconds</option>
                            <option value="microseconds">Microseconds</option>
                            <option value="nanoseconds">Nanoseconds</option>
                        </select>
                    </div>
                    <div className="tsc-field">
                        <label htmlFor="tsc-zone">IANA time zone</label>
                        <input
                            id="tsc-zone"
                            className="c-input tsc-zone"
                            list="tsc-zone-list"
                            value={timeZone}
                            autoComplete="off"
                            spellcheck={false}
                            onInput={(event) => setTimeZone((event.target as HTMLInputElement).value)}
                        />
                        <datalist id="tsc-zone-list">
                            {COMMON_TIME_ZONES.map((zone) => <option value={zone} key={zone} />)}
                        </datalist>
                    </div>
                </div>
                <textarea
                    id="tsc-epoch"
                    ref={epochRef}
                    className="c-input c-input--textarea tsc-textarea"
                    placeholder="1700000000"
                    aria-label="Unix timestamp"
                    value={epochInput}
                    onInput={(event) => setEpochInput((event.target as HTMLTextAreaElement).value)}
                />
                <div className="c-action-strip">
                    <button id="tsc-load-sample" className="c-button c-button--ghost" type="button" onClick={loadSample}>
                        Load Sample
                    </button>
                    <span className="c-toolbar__spacer" />
                    <button id="tsc-convert" className="c-button" type="button" onClick={() => runEpoch(epochInput, unit, timeZone, 'user')}>
                        Convert timestamp
                        <span className="c-kbd" aria-hidden="true">⌘⏎</span>
                    </button>
                </div>
            </div>

            <div className="o-panel c-surface-card c-surface-panel">
                <div className="o-panel-header c-surface-panel__header">
                    <h3>Date to epoch</h3>
                </div>
                <div className="tsc-date-fields">
                    <div className="tsc-field">
                        <label htmlFor="tsc-date">Date</label>
                        <input
                            id="tsc-date"
                            className="c-input tsc-date"
                            type="date"
                            value={date}
                            onInput={(event) => setDate((event.target as HTMLInputElement).value)}
                        />
                    </div>
                    <div className="tsc-field">
                        <label htmlFor="tsc-time">Time</label>
                        <input
                            id="tsc-time"
                            className="c-input tsc-time"
                            type="time"
                            step={1}
                            value={time}
                            onInput={(event) => setTime((event.target as HTMLInputElement).value)}
                        />
                    </div>
                    <div className="tsc-field">
                        <label htmlFor="tsc-millisecond">Milliseconds</label>
                        <input
                            id="tsc-millisecond"
                            className="c-input tsc-ms"
                            inputMode="numeric"
                            value={millisecond}
                            placeholder="0"
                            onInput={(event) => setMillisecond((event.target as HTMLInputElement).value)}
                        />
                    </div>
                </div>
                <div className="c-action-strip">
                    <span className="c-toolbar__spacer" />
                    <button id="tsc-convert-date" className="c-button" type="button" onClick={runDate}>
                        Convert date
                    </button>
                </div>
            </div>

            <div className="o-panel c-surface-card c-surface-panel">
                <div className="o-panel-header c-surface-panel__header">
                    <h3>JWT exp / iat</h3>
                </div>
                <p>
                    exp, iat, and nbf are Unix seconds. This field does not switch units by digit count, and it does not decode a token.
                    {' '}
                    <a href={buildSiteHref('/jwt-decoder/')}>Open the JWT Decoder</a>.
                </p>
                <textarea
                    id="tsc-jwt"
                    className="c-input c-input--textarea tsc-textarea"
                    placeholder="1700000000"
                    aria-label="JWT exp, iat, or nbf in seconds"
                    value={jwtInput}
                    onInput={(event) => setJwtInput((event.target as HTMLTextAreaElement).value)}
                />
                <div className="c-action-strip">
                    <span className="c-toolbar__spacer" />
                    <button id="tsc-convert-jwt" className="c-button" type="button" onClick={runJwt}>
                        Convert JWT time
                    </button>
                </div>
            </div>

            <div
                id="tsc-error"
                className={`c-input-status${error ? ' error' : ''}`}
                role={error ? 'alert' : 'status'}
                aria-live="polite"
            >
                {error}
            </div>

            <div className="o-panel c-surface-card c-surface-panel">
                <div className="o-panel-header c-surface-panel__header">
                    <h3>Result</h3>
                </div>
                {lines.length > 0 ? <ResultLines lines={lines} /> : null}
                <textarea
                    id="tsc-output"
                    ref={outputRef}
                    className="c-input c-input--textarea tsc-textarea tsc-output"
                    readOnly
                    placeholder="The converted time will appear here..."
                    aria-label="Converted timestamp"
                    value={report}
                />
            </div>

            <div id="notification" className="c-notification" role="status" aria-live="polite" />
        </div>
    );
}

function ResultLines({ lines }: { lines: string[] }): JSX.Element {
    return (
        <dl id="tsc-result" className="tsc-result">
            {lines.map((line) => {
                const splitAt = line.indexOf(': ');

                if (splitAt === -1) {
                    return <p className="tsc-note" key={line}>{line}</p>;
                }

                const label = line.slice(0, splitAt);
                const text = line.slice(splitAt + 2);

                return (
                    <div key={label}>
                        <dt>{label}</dt>
                        <dd>{text}</dd>
                    </div>
                );
            })}
        </dl>
    );
}

export class TimestampConverterToolUI {
    constructor(rootSelector = '#timestamp-converter-app') {
        const root = document.querySelector(rootSelector) || document.querySelector('#timestamp-converter-tool');
        if (!root) {
            throw new Error('Unix Timestamp Converter root element not found');
        }

        const mount = root.hasChildNodes() ? hydrate : render;
        mount(<TimestampConverterApp />, root);
    }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', () => {
        mountToolShell({
            title: toolMetadata.title,
            description: toolMetadata.description,
            homeHref: '/'
        });

        new TimestampConverterToolUI();
    });
}
