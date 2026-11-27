import { hydrate, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { trackCopyOutput, trackToolUsed, utf8ByteLength, type ToolUsedOutcome, type ToolUsedTrigger } from '../common/analytics-events';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { buildSiteHref } from '../common/siteBaseUrl';
import ClearButton from '../common/clear-button/ClearButton';
import { copyTextToClipboard } from '../common/clipboard';
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
    type ConvertedTimestamp,
    type TimestampUnit,
    type TimestampUnitChoice
} from './timestamp';
import toolMetadata from './tool.meta.json';

const ANALYTICS_TOOL_ID = 'timestamp-converter';

type ConversionMode = 'epoch' | 'date' | 'jwt';

interface SegmentOption<T extends string> {
    id: string;
    value: T;
    label: string;
}

interface ShownResult {
    value: ConvertedTimestamp;
    chip: string;
}

interface ResultRow {
    label: string;
    text: string;
}

const MODES: ReadonlyArray<SegmentOption<ConversionMode>> = [
    { id: 'tsc-mode-epoch', value: 'epoch', label: 'Epoch to date' },
    { id: 'tsc-mode-date', value: 'date', label: 'Date to epoch' },
    { id: 'tsc-mode-jwt', value: 'jwt', label: 'JWT exp/iat' }
];

const UNITS: ReadonlyArray<SegmentOption<TimestampUnitChoice>> = [
    { id: 'tsc-unit-auto', value: 'auto', label: 'Auto' },
    { id: 'tsc-unit-seconds', value: 'seconds', label: 'Seconds' },
    { id: 'tsc-unit-milliseconds', value: 'milliseconds', label: 'Milliseconds' },
    { id: 'tsc-unit-microseconds', value: 'microseconds', label: 'Microseconds' },
    { id: 'tsc-unit-nanoseconds', value: 'nanoseconds', label: 'Nanoseconds' }
];

const UNIT_LABELS: Record<TimestampUnit, string> = {
    seconds: 'Seconds',
    milliseconds: 'Milliseconds',
    microseconds: 'Microseconds',
    nanoseconds: 'Nanoseconds'
};

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

function nextInList<T extends string>(items: readonly T[], current: T, key: string): T | null {
    const index = items.indexOf(current);

    if (key === 'Home') {
        return items[0];
    }

    if (key === 'End') {
        return items[items.length - 1];
    }

    if (key === 'ArrowRight' || key === 'ArrowDown') {
        return items[(index + 1) % items.length];
    }

    if (key === 'ArrowLeft' || key === 'ArrowUp') {
        return items[(index - 1 + items.length) % items.length];
    }

    return null;
}

function invalidFieldIds(mode: ConversionMode, message: string): Set<string> {
    if (message.length === 0) {
        return new Set();
    }

    if (message.includes('IANA time zone')) {
        return new Set(['tsc-zone']);
    }

    if (mode === 'epoch') {
        return new Set(['tsc-epoch']);
    }

    if (mode === 'jwt') {
        return new Set(['tsc-jwt']);
    }

    if (message.includes('00:00:00')) {
        return new Set(['tsc-time', 'tsc-millisecond']);
    }

    return new Set(['tsc-date', 'tsc-time']);
}

function modeLabel(mode: ConversionMode): string {
    if (mode === 'date') {
        return 'Date to epoch';
    }

    if (mode === 'jwt') {
        return 'JWT exp/iat';
    }

    return 'Epoch to date';
}

function resultChip(unitChoice: TimestampUnitChoice | null, detected: TimestampUnit): string {
    const label = UNIT_LABELS[detected];
    return unitChoice === 'auto' ? `Auto · ${label}` : label;
}

function resultRows(value: ConvertedTimestamp): ResultRow[] {
    const rows: ResultRow[] = [
        { label: 'Unix seconds', text: value.unixSeconds },
        { label: 'Unix milliseconds', text: value.unixMilliseconds },
        { label: 'Unix microseconds', text: value.unixMicroseconds },
        { label: 'Unix nanoseconds', text: value.unixNanoseconds }
    ];

    if (value.iso8601) {
        rows.push({ label: 'ISO 8601', text: value.iso8601 });
    }

    if (value.rfc2822) {
        rows.push({ label: 'RFC 2822', text: value.rfc2822 });
    }

    if (value.utc) {
        rows.push({ label: 'UTC', text: value.utc });
    }

    if (value.local) {
        rows.push({ label: `Local (${value.localTimeZone})`, text: value.local });
    }

    if (value.zoned) {
        rows.push({ label: `Time zone (${value.timeZone})`, text: value.zoned });
    }

    if (value.relative) {
        rows.push({ label: 'Relative', text: value.relative });
    }

    return rows;
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

function SegmentedControl<T extends string>({
    label,
    className,
    value,
    options,
    onSelect
}: {
    label: string;
    className: string;
    value: T;
    options: ReadonlyArray<SegmentOption<T>>;
    onSelect: (next: T) => void;
}): JSX.Element {
    const onKeyDown = (event: KeyboardEvent) => {
        const next = nextInList(options.map((option) => option.value), value, event.key);

        if (next === null) {
            return;
        }

        event.preventDefault();
        onSelect(next);
        const nextOption = options.find((option) => option.value === next) as SegmentOption<T>;
        document.getElementById(nextOption.id)?.focus();
    };

    return (
        <div className={`c-tab-list ${className}`} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
            {options.map((option) => {
                const selected = value === option.value;

                return (
                    <button
                        id={option.id}
                        key={option.id}
                        className={`c-tab-button${selected ? ' active' : ''}`}
                        type="button"
                        role="radio"
                        aria-checked={selected ? 'true' : 'false'}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onSelect(option.value)}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

function FieldError({ message }: { message: string }): JSX.Element {
    return (
        <div
            id="tsc-error"
            className="c-input-status error c-status-banner status-error"
            role="alert"
            aria-live="polite"
        >
            {message}
        </div>
    );
}

function ResultBody({ result }: { result: ShownResult }): JSX.Element {
    const rows = resultRows(result.value);

    return (
        <div id="tsc-result" className="c-stats-panel">
            {rows.map((row) => (
                <div className="c-stat-row tsc-stat" key={row.label}>
                    <span className="tsc-stat-label">{row.label}</span>
                    <span className="tsc-stat-value">{row.text}</span>
                    <button
                        className="c-button c-button--secondary"
                        type="button"
                        aria-label={`Copy ${row.label}`}
                        onClick={() => { void copyValue(row.text); }}
                    >
                        Copy
                    </button>
                </div>
            ))}
            {result.value.calendarNote ? <p className="tsc-note">{result.value.calendarNote}</p> : null}
        </div>
    );
}

export function TimestampConverterApp(): JSX.Element {
    const [mode, setMode] = useState<ConversionMode>('epoch');
    const [nowSeconds, setNowSeconds] = useState('');
    const [nowIso, setNowIso] = useState('');
    const [epochInput, setEpochInput] = useState('');
    const [unit, setUnit] = useState<TimestampUnitChoice>('auto');
    const [timeZone, setTimeZone] = useState('UTC');
    const [localZone, setLocalZone] = useState('UTC');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [millisecond, setMillisecond] = useState('');
    const [jwtInput, setJwtInput] = useState('');
    const [error, setError] = useState('');
    const [result, setResult] = useState<ShownResult | null>(null);
    const epochRef = useRef<HTMLTextAreaElement>(null);
    const clearButtonRef = useRef<ClearButton | null>(null);
    const invalidIds = invalidFieldIds(mode, error);
    const zoneInvalid = invalidIds.has('tsc-zone');

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
        setLocalZone(browserTimeZone());
    }, []);

    useEffect(() => {
        if (mode !== 'epoch') {
            return undefined;
        }

        const inputEl = epochRef.current as HTMLTextAreaElement;
        clearButtonRef.current = new ClearButton(inputEl);

        const handleTextCleared = () => {
            setEpochInput('');
            setError('');
            setResult(null);
            NotificationManager.show('Input cleared', 2000, { type: 'success' });
        };

        inputEl.addEventListener('textCleared', handleTextCleared);

        return () => {
            inputEl.removeEventListener('textCleared', handleTextCleared);
            const button = clearButtonRef.current as ClearButton;
            button.disconnect();
            clearButtonRef.current = null;
        };
    }, [mode]);

    useEffect(() => {
        clearButtonRef.current?.updateVisibility?.();
    }, [epochInput, mode]);

    useEffect(() => {
        return registerPrimaryActionShortcut(document.getElementById('tsc-convert') as HTMLElement);
    }, []);

    const showResult = (
        conversion: ConversionResult,
        action: string,
        trigger: ToolUsedTrigger,
        input: string,
        unitChoice: TimestampUnitChoice | null,
        notify: boolean
    ) => {
        if (conversion.ok === false) {
            setResult(null);
            setError(conversion.message);
            reportToolUsed(action, 'error', trigger, utf8ByteLength(input));
            return;
        }

        setError('');
        setResult({
            value: conversion.value,
            chip: resultChip(unitChoice, conversion.value.unit)
        });
        reportToolUsed(action, 'success', trigger, utf8ByteLength(input));

        if (notify) {
            NotificationManager.show('Converted', 2000, { type: 'success' });
        }
    };

    const applyEpoch = (
        input: string,
        unitChoice: TimestampUnitChoice,
        zone: string,
        trigger: ToolUsedTrigger,
        explicit: boolean,
        notify: boolean
    ) => {
        if (input.trim().length === 0) {
            setResult(null);
            setError(explicit ? 'Enter a timestamp.' : '');
            return;
        }

        showResult(convertEpoch({
            input,
            unit: unitChoice,
            timeZone: zone,
            localTimeZone: browserTimeZone(),
            nowMs: Date.now()
        }), 'convert-epoch', trigger, input, unitChoice, notify);
    };

    const applyDate = (
        nextDate: string,
        nextTime: string,
        nextMillisecond: string,
        zone: string,
        trigger: ToolUsedTrigger,
        explicit: boolean,
        notify: boolean
    ) => {
        const dateEmpty = nextDate.trim().length === 0 && nextTime.trim().length === 0 && nextMillisecond.trim().length === 0;

        if (!explicit && dateEmpty) {
            setResult(null);
            setError('');
            return;
        }

        if (nextDate.trim().length === 0 || nextTime.trim().length === 0) {
            setResult(null);
            setError('Enter a date and time.');
            return;
        }

        showResult(convertDate({
            date: nextDate,
            time: nextTime,
            millisecond: nextMillisecond,
            timeZone: zone,
            localTimeZone: browserTimeZone(),
            nowMs: Date.now()
        }), 'convert-date', trigger, `${nextDate}T${nextTime}`, null, notify);
    };

    const applyJwt = (
        input: string,
        zone: string,
        trigger: ToolUsedTrigger,
        explicit: boolean,
        notify: boolean
    ) => {
        if (input.trim().length === 0) {
            setResult(null);
            setError(explicit ? 'Enter a JWT exp, iat, or nbf value in seconds.' : '');
            return;
        }

        showResult(convertJwtNumericDate({
            input,
            unit: 'seconds',
            timeZone: zone,
            localTimeZone: browserTimeZone(),
            nowMs: Date.now()
        }), 'convert-jwt', trigger, input, null, notify);
    };

    const applyActive = (
        nextMode: ConversionMode,
        zone: string,
        explicit: boolean,
        notify: boolean,
        trigger: ToolUsedTrigger = 'user'
    ) => {
        if (nextMode === 'epoch') {
            applyEpoch(epochInput, unit, zone, trigger, explicit, notify);
            return;
        }

        if (nextMode === 'date') {
            applyDate(date, time, millisecond, zone, trigger, explicit, notify);
            return;
        }

        applyJwt(jwtInput, zone, trigger, explicit, notify);
    };

    const selectMode = (next: ConversionMode) => {
        setMode(next);
        applyActive(next, timeZone, false, false);
    };

    const selectUnit = (next: TimestampUnitChoice) => {
        setUnit(next);
        applyEpoch(epochInput, next, timeZone, 'user', false, false);
    };

    const onZoneInput = (zone: string) => {
        setTimeZone(zone);
        applyActive(mode, zone, false, false);
    };

    const useLocalZone = () => {
        setTimeZone(localZone);
        applyActive(mode, localZone, false, false);
    };

    const runActive = () => {
        applyActive(mode, timeZone, true, true);
    };

    const useCurrentTime = () => {
        const seconds = String(Math.floor(Date.now() / 1000));
        setMode('epoch');
        setUnit('seconds');
        setEpochInput(seconds);
        applyEpoch(seconds, 'seconds', timeZone, 'user', true, true);
    };

    const loadSample = () => {
        setMode('epoch');
        setUnit('auto');
        setTimeZone(WORKED_EXAMPLE_ZONE);
        setEpochInput(WORKED_EXAMPLE_EPOCH);
        applyEpoch(WORKED_EXAMPLE_EPOCH, 'auto', WORKED_EXAMPLE_ZONE, 'sample', true, true);
    };

    const copySeconds = () => {
        if (!nowSeconds) {
            return;
        }

        void copyValue(nowSeconds);
    };

    const copyIso = () => {
        if (!nowIso) {
            return;
        }

        void copyValue(nowIso);
    };

    const copyAll = () => {
        if (!result) {
            return;
        }

        void copyValue(conversionLines(result.value).join('\n'));
    };

    const describedBy = (id: string): string | undefined => (invalidIds.has(id) ? 'tsc-error' : undefined);

    return (
        <div id="timestamp-converter-tool" className="timestamp-converter-container tool-container tsc-tool c-tool-stack">
            <div className="c-workbench c-workbench--two-col tsc-workbench">
                <header className="tsc-clock c-surface-card" aria-labelledby="tsc-clock-heading">
                    <div className="tsc-clock-readout" id="tsc-now">
                        <h3 id="tsc-clock-heading" className="tsc-clock-kicker">Current Unix time</h3>
                        <p id="tsc-now-seconds" className="tsc-clock-seconds">{nowSeconds || '—'}</p>
                        <p id="tsc-now-iso" className="tsc-clock-iso">{nowIso || '—'}</p>
                    </div>
                    <div className="tsc-clock-actions">
                        <button
                            id="tsc-copy-seconds"
                            className="c-button c-button--secondary"
                            type="button"
                            aria-label="Copy current Unix seconds"
                            onClick={copySeconds}
                            disabled={!nowSeconds}
                        >
                            Copy seconds
                        </button>
                        <button
                            id="tsc-copy-iso"
                            className="c-button c-button--secondary"
                            type="button"
                            aria-label="Copy current ISO-8601 time"
                            onClick={copyIso}
                            disabled={!nowIso}
                        >
                            Copy ISO
                        </button>
                        <button id="tsc-use-now" className="c-button c-button--secondary" type="button" onClick={useCurrentTime}>
                            Use this time
                        </button>
                    </div>
                </header>

                <div className="tsc-toolbar c-action-strip c-toolbar">
                    <SegmentedControl
                        label="Conversion mode"
                        className="tsc-mode-tabs"
                        value={mode}
                        options={MODES}
                        onSelect={selectMode}
                    />
                    <div className="tsc-zone-field">
                        <label htmlFor="tsc-zone">IANA time zone</label>
                        <input
                            id="tsc-zone"
                            className={`c-input tsc-zone${zoneInvalid ? ' c-input--error' : ''}`}
                            list="tsc-zone-list"
                            value={timeZone}
                            autoComplete="off"
                            spellcheck={false}
                            aria-invalid={zoneInvalid ? 'true' : 'false'}
                            aria-describedby={describedBy('tsc-zone')}
                            onInput={(event) => onZoneInput((event.target as HTMLInputElement).value)}
                        />
                        <datalist id="tsc-zone-list">
                            {COMMON_TIME_ZONES.map((zone) => <option value={zone} key={zone} />)}
                        </datalist>
                    </div>
                    <button
                        id="tsc-local-zone"
                        className="c-status-chip tsc-zone-chip"
                        type="button"
                        aria-label={`Use local time zone ${localZone}`}
                        onClick={useLocalZone}
                    >
                        {localZone}
                    </button>
                    {zoneInvalid ? <FieldError message={error} /> : null}
                </div>

                <section className="o-panel c-surface-card c-surface-panel tsc-form-panel" aria-labelledby="tsc-form-heading">
                    <div className="o-panel-header c-surface-panel__header">
                        <h3 id="tsc-form-heading">{modeLabel(mode)}</h3>
                    </div>
                    <div className="o-panel-content c-surface-panel__content">
                        {mode === 'epoch' ? (
                            <>
                                <SegmentedControl
                                    label="Timestamp unit"
                                    className="tsc-unit-tabs"
                                    value={unit}
                                    options={UNITS}
                                    onSelect={selectUnit}
                                />
                                <textarea
                                    id="tsc-epoch"
                                    ref={epochRef}
                                    className={`c-input c-input--textarea tsc-epoch${invalidIds.has('tsc-epoch') ? ' c-input--error' : ''}`}
                                    placeholder="1700000000"
                                    aria-label="Unix timestamp"
                                    aria-invalid={invalidIds.has('tsc-epoch') ? 'true' : 'false'}
                                    aria-describedby={describedBy('tsc-epoch')}
                                    spellcheck={false}
                                    rows={1}
                                    value={epochInput}
                                    onInput={(event) => {
                                        const value = (event.target as HTMLTextAreaElement).value;
                                        setEpochInput(value);
                                        applyEpoch(value, unit, timeZone, 'user', false, false);
                                    }}
                                />
                            </>
                        ) : null}
                        {mode === 'date' ? (
                            <div className="tsc-date-fields">
                                <div className="tsc-field">
                                    <label htmlFor="tsc-date">Date</label>
                                    <input
                                        id="tsc-date"
                                        className={`c-input tsc-date${invalidIds.has('tsc-date') ? ' c-input--error' : ''}`}
                                        type="date"
                                        value={date}
                                        aria-invalid={invalidIds.has('tsc-date') ? 'true' : 'false'}
                                        aria-describedby={describedBy('tsc-date')}
                                        onInput={(event) => {
                                            const value = (event.target as HTMLInputElement).value;
                                            setDate(value);
                                            applyDate(value, time, millisecond, timeZone, 'user', false, false);
                                        }}
                                    />
                                </div>
                                <div className="tsc-field">
                                    <label htmlFor="tsc-time">Time</label>
                                    <input
                                        id="tsc-time"
                                        className={`c-input tsc-time${invalidIds.has('tsc-time') ? ' c-input--error' : ''}`}
                                        type="time"
                                        step={1}
                                        value={time}
                                        aria-invalid={invalidIds.has('tsc-time') ? 'true' : 'false'}
                                        aria-describedby={describedBy('tsc-time')}
                                        onInput={(event) => {
                                            const value = (event.target as HTMLInputElement).value;
                                            setTime(value);
                                            applyDate(date, value, millisecond, timeZone, 'user', false, false);
                                        }}
                                    />
                                </div>
                                <div className="tsc-field tsc-ms-field">
                                    <label htmlFor="tsc-millisecond">Milliseconds</label>
                                    <input
                                        id="tsc-millisecond"
                                        className={`c-input tsc-ms${invalidIds.has('tsc-millisecond') ? ' c-input--error' : ''}`}
                                        inputMode="numeric"
                                        value={millisecond}
                                        placeholder="0"
                                        aria-invalid={invalidIds.has('tsc-millisecond') ? 'true' : 'false'}
                                        aria-describedby={describedBy('tsc-millisecond')}
                                        onInput={(event) => {
                                            const value = (event.target as HTMLInputElement).value;
                                            setMillisecond(value);
                                            applyDate(date, time, value, timeZone, 'user', false, false);
                                        }}
                                    />
                                </div>
                            </div>
                        ) : null}
                        {mode === 'jwt' ? (
                            <>
                                <p className="tsc-jwt-note">
                                    exp, iat, and nbf are Unix seconds. This field does not switch units by digit count, and it does not decode a token.
                                    {' '}
                                    <a href={buildSiteHref('/jwt-decoder/')}>Open the JWT Decoder</a>.
                                </p>
                                <textarea
                                    id="tsc-jwt"
                                    className={`c-input c-input--textarea tsc-jwt${invalidIds.has('tsc-jwt') ? ' c-input--error' : ''}`}
                                    placeholder="1700000000"
                                    aria-label="JWT exp, iat, or nbf in seconds"
                                    aria-invalid={invalidIds.has('tsc-jwt') ? 'true' : 'false'}
                                    aria-describedby={describedBy('tsc-jwt')}
                                    spellcheck={false}
                                    rows={1}
                                    value={jwtInput}
                                    onInput={(event) => {
                                        const value = (event.target as HTMLTextAreaElement).value;
                                        setJwtInput(value);
                                        applyJwt(value, timeZone, 'user', false, false);
                                    }}
                                />
                            </>
                        ) : null}
                        {error && !zoneInvalid ? <FieldError message={error} /> : null}
                        <div className="c-toolbar tsc-form-actions">
                            <button id="tsc-load-sample" className="c-button c-button--ghost" type="button" onClick={loadSample}>
                                Load Sample
                            </button>
                            <span className="c-toolbar__spacer" />
                            <button id="tsc-convert" className="c-button" type="button" onClick={runActive}>
                                Convert
                                <span className="c-kbd" aria-hidden="true">⌘⏎</span>
                            </button>
                        </div>
                    </div>
                </section>

                <section className="o-panel c-surface-card c-surface-panel tsc-result-panel" aria-labelledby="tsc-result-heading">
                    <div className="o-panel-header c-surface-panel__header tsc-result-header">
                        <h3 id="tsc-result-heading">Result</h3>
                        <div className="tsc-result-toolbar">
                            {result ? <span className="c-status-chip" id="tsc-unit-chip">{result.chip}</span> : null}
                            <button
                                id="tsc-copy-all"
                                className="c-button c-button--secondary"
                                type="button"
                                onClick={copyAll}
                                disabled={!result}
                            >
                                Copy all
                            </button>
                        </div>
                    </div>
                    <div className="o-panel-content c-surface-panel__content tsc-result-content" aria-live="polite">
                        {result ? <ResultBody result={result} /> : (
                            <div className="c-empty-state" id="tsc-empty-state">
                                <span className="c-empty-state__icon" aria-hidden="true">
                                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="9" />
                                        <path d="M12 7v5l3 2" />
                                    </svg>
                                </span>
                                <p className="c-empty-state__message">Converted time will appear here</p>
                                <p className="c-empty-state__hint">Enter a timestamp, a date, or a JWT time. It converts as you type.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <div id="notification" className="c-notification" role="status" aria-live="polite" />
        </div>
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
