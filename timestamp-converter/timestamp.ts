/**
 * Unix timestamp conversion in the browser.
 *
 * The integer's digit count picks the unit: 1–10 seconds, 11–13 milliseconds,
 * 14–16 microseconds, 17–19 nanoseconds. Values are kept as nanoseconds in
 * BigInt so a current nanosecond count is exact. Number cannot hold it.
 * Calendar lines use the millisecond instant. The ISO 8601 line keeps any
 * finer digits, through nanoseconds. No timestamp library is involved.
 */

export type TimestampUnit = 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds';
export type TimestampUnitChoice = 'auto' | TimestampUnit;

export const MAX_TIMESTAMP_LENGTH = 64;
export const WORKED_EXAMPLE_EPOCH = '1700000000';
export const WORKED_EXAMPLE_ZONE = 'America/New_York';
export const WORKED_EXAMPLE_LOCAL_ZONE = 'America/Chicago';
/** Two hours after the worked instant, so relative time stays fixed in the guide. */
export const WORKED_EXAMPLE_NOW_MS = 1_700_007_200_000;
export const WORKED_EXAMPLE_MILLISECONDS = '1700000000123';
export const WORKED_EXAMPLE_NANOSECONDS = '1700000000123456789';

export const COMMON_TIME_ZONES = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Africa/Cairo',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Pacific/Auckland'
];

const NS_PER_MS = 1_000_000n;
const MIN_DATE_MS = -8_640_000_000_000_000n;
const MAX_DATE_MS = 8_640_000_000_000_000n;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
/** A year in the relative line is 365 days, not a calendar year. */
const MS_PER_YEAR = 365 * MS_PER_DAY;

const UNIT_SCALE_NS: Record<TimestampUnit, bigint> = {
    seconds: 1_000_000_000n,
    milliseconds: 1_000_000n,
    microseconds: 1_000n,
    nanoseconds: 1n
};

const TIMESTAMP_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

const INVALID_TIMESTAMP = 'Enter a Unix timestamp: an optional minus, digits, and an optional fraction.';
const INVALID_ZONE = 'Enter an IANA time zone such as UTC or America/New_York.';
const GAP_MESSAGE = 'That local time does not exist in this time zone.';
const CALENDAR_NOTE = 'This instant is outside the range this page can show as a calendar date. The unit lines above are exact.';

export interface CalendarParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
}

export interface ConvertedTimestamp {
    unit: TimestampUnit;
    unixSeconds: string;
    unixMilliseconds: string;
    unixMicroseconds: string;
    unixNanoseconds: string;
    iso8601: string | null;
    rfc2822: string | null;
    utc: string | null;
    local: string | null;
    localTimeZone: string;
    zoned: string | null;
    timeZone: string;
    relative: string | null;
    calendarNote: string | null;
}

export interface ConversionSuccess {
    ok: true;
    value: ConvertedTimestamp;
}

export interface ConversionFailure {
    ok: false;
    message: string;
}

export type ConversionResult = ConversionSuccess | ConversionFailure;

export interface EpochConversionInput {
    input: string;
    unit: TimestampUnitChoice;
    timeZone: string;
    localTimeZone: string;
    nowMs: number;
}

export interface DateConversionInput {
    date: string;
    time: string;
    millisecond: string;
    timeZone: string;
    localTimeZone: string;
    nowMs: number;
}

interface ParsedTimestamp {
    nanos: bigint;
    unit: TimestampUnit;
}

export function isValidTimeZone(timeZone: string): boolean {
    if (typeof timeZone !== 'string' || timeZone.length === 0 || timeZone.trim() !== timeZone) {
        return false;
    }

    try {
        Intl.DateTimeFormat('en-US', { timeZone });
        return true;
    } catch {
        return false;
    }
}

export function detectUnit(digitCount: number): TimestampUnit | null {
    if (digitCount < 1) {
        return null;
    }

    if (digitCount <= 10) {
        return 'seconds';
    }

    if (digitCount <= 13) {
        return 'milliseconds';
    }

    if (digitCount <= 16) {
        return 'microseconds';
    }

    if (digitCount <= 19) {
        return 'nanoseconds';
    }

    return null;
}

export function formatRelativeTime(targetMs: number, nowMs: number): string | null {
    if (!Number.isSafeInteger(targetMs) || !Number.isSafeInteger(nowMs)) {
        return null;
    }

    const delta = targetMs - nowMs;
    const abs = Math.abs(delta);

    if (abs < MS_PER_SECOND) {
        return 'just now';
    }

    const steps: Array<[number, number, string]> = [
        [MS_PER_MINUTE, MS_PER_SECOND, 'second'],
        [MS_PER_HOUR, MS_PER_MINUTE, 'minute'],
        [MS_PER_DAY, MS_PER_HOUR, 'hour'],
        [MS_PER_YEAR, MS_PER_DAY, 'day'],
        [Number.POSITIVE_INFINITY, MS_PER_YEAR, 'year']
    ];

    let count = 0;
    let unit = 'second';

    for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index];

        if (abs < step[0]) {
            count = Math.round(abs / step[1]);
            unit = step[2];
            break;
        }
    }

    const label = count === 1 ? unit : `${unit}s`;

    return delta > 0 ? `in ${count} ${label}` : `${count} ${label} ago`;
}

export function convertEpoch(options: EpochConversionInput): ConversionResult {
    const parsed = parseTimestamp(options.input, options.unit);

    if (parsed.ok === false) {
        return parsed;
    }

    return finishConversion(parsed.value, options.timeZone, options.localTimeZone, options.nowMs);
}

export function convertJwtNumericDate(options: EpochConversionInput): ConversionResult {
    if (options.input.trim().length === 0) {
        return { ok: false, message: 'Enter a JWT exp, iat, or nbf value in seconds.' };
    }

    return convertEpoch({
        input: options.input,
        unit: 'seconds',
        timeZone: options.timeZone,
        localTimeZone: options.localTimeZone,
        nowMs: options.nowMs
    });
}

export function convertDate(options: DateConversionInput): ConversionResult {
    const zoneError = validateZones(options.timeZone, options.localTimeZone);

    if (zoneError) {
        return zoneError;
    }

    const parts = parseDateParts(options.date, options.time, options.millisecond);

    if (parts.ok === false) {
        return parts;
    }

    let epochMs: number | null;

    try {
        epochMs = zonedPartsToEpochMs(parts.value, options.timeZone);
    } catch {
        return { ok: false, message: INVALID_ZONE };
    }

    if (epochMs === null) {
        return { ok: false, message: GAP_MESSAGE };
    }

    const nanos = BigInt(epochMs) * NS_PER_MS;
    const unit: TimestampUnit = parts.value.millisecond === 0 ? 'seconds' : 'milliseconds';

    return finishConversion(
        { nanos, unit },
        options.timeZone,
        options.localTimeZone,
        options.nowMs
    );
}

export function conversionLines(value: ConvertedTimestamp): string[] {
    const lines = [
        `Detected unit: ${value.unit}`,
        `Unix seconds: ${value.unixSeconds}`,
        `Unix milliseconds: ${value.unixMilliseconds}`,
        `Unix microseconds: ${value.unixMicroseconds}`,
        `Unix nanoseconds: ${value.unixNanoseconds}`
    ];

    if (value.iso8601) {
        lines.push(`ISO 8601: ${value.iso8601}`);
    }

    if (value.rfc2822) {
        lines.push(`RFC 2822: ${value.rfc2822}`);
    }

    if (value.utc) {
        lines.push(`UTC: ${value.utc}`);
    }

    if (value.local) {
        lines.push(`Local (${value.localTimeZone}): ${value.local}`);
    }

    if (value.zoned) {
        lines.push(`Time zone (${value.timeZone}): ${value.zoned}`);
    }

    if (value.relative) {
        lines.push(`Relative: ${value.relative}`);
    }

    if (value.calendarNote) {
        lines.push(value.calendarNote);
    }

    return lines;
}

function parseTimestamp(input: string, unitChoice: TimestampUnitChoice): { ok: true, value: ParsedTimestamp } | ConversionFailure {
    const trimmed = input.trim();

    if (trimmed.length === 0) {
        return { ok: false, message: 'Enter a timestamp.' };
    }

    if (trimmed.length > MAX_TIMESTAMP_LENGTH) {
        return { ok: false, message: 'That timestamp is too long.' };
    }

    const match = TIMESTAMP_PATTERN.exec(trimmed);

    if (!match) {
        return { ok: false, message: INVALID_TIMESTAMP };
    }

    const sign = match[1] === '-' ? -1n : 1n;
    const stripped = match[2].replace(/^0+/, '');
    const digits = stripped.length === 0 ? '0' : stripped;
    const fraction = match[3] || '';
    const unit = unitChoice === 'auto' ? detectUnit(digits.length) : unitChoice;

    if (!unit) {
        return {
            ok: false,
            message: 'That integer has too many digits to be seconds, milliseconds, microseconds, or nanoseconds.'
        };
    }

    const scale = UNIT_SCALE_NS[unit];
    const fractionDigits = scale === 1n ? 0 : scale.toString().length - 1;

    if (fraction.length > fractionDigits) {
        return { ok: false, message: 'That fraction is finer than a nanosecond. This page keeps whole nanoseconds.' };
    }

    const paddedFraction = fraction.padEnd(fractionDigits, '0');
    const whole = BigInt(digits) * scale;
    const fractional = paddedFraction.length === 0 ? 0n : BigInt(paddedFraction);

    return {
        ok: true,
        value: {
            nanos: sign * (whole + fractional),
            unit
        }
    };
}

function finishConversion(parsed: ParsedTimestamp, timeZone: string, localTimeZone: string, nowMs: number): ConversionResult {
    const zoneError = validateZones(timeZone, localTimeZone);

    if (zoneError) {
        return zoneError;
    }

    const value = formatInstant(parsed.nanos, parsed.unit, timeZone, localTimeZone, nowMs);

    if (!value) {
        return { ok: false, message: INVALID_ZONE };
    }

    return { ok: true, value };
}

function validateZones(timeZone: string, localTimeZone: string): ConversionFailure | null {
    if (!isValidTimeZone(timeZone) || !isValidTimeZone(localTimeZone)) {
        return { ok: false, message: INVALID_ZONE };
    }

    return null;
}

function formatInstant(
    nanos: bigint,
    unit: TimestampUnit,
    timeZone: string,
    localTimeZone: string,
    nowMs: number
): ConvertedTimestamp | null {
    const ms = floorDiv(nanos, NS_PER_MS);
    const inRange = ms >= MIN_DATE_MS && ms <= MAX_DATE_MS;
    const epochMs = inRange ? Number(ms) : null;
    let iso8601: string | null = null;
    let rfc2822: string | null = null;
    let utc: string | null = null;
    let local: string | null = null;
    let zoned: string | null = null;
    let relative: string | null = null;

    if (epochMs !== null) {
        try {
            iso8601 = formatIso(nanos, epochMs);
            rfc2822 = new Date(epochMs).toUTCString();
            utc = formatZoneClock(epochMs, 'UTC');
            local = formatZoneClock(epochMs, localTimeZone);
            zoned = formatZoneClock(epochMs, timeZone);
            relative = formatRelativeTime(epochMs, nowMs);
        } catch {
            return null;
        }
    }

    return {
        unit,
        unixSeconds: scaledString(nanos, UNIT_SCALE_NS.seconds),
        unixMilliseconds: scaledString(nanos, UNIT_SCALE_NS.milliseconds),
        unixMicroseconds: scaledString(nanos, UNIT_SCALE_NS.microseconds),
        unixNanoseconds: scaledString(nanos, UNIT_SCALE_NS.nanoseconds),
        iso8601,
        rfc2822,
        utc,
        local,
        localTimeZone,
        zoned,
        timeZone,
        relative,
        calendarNote: epochMs === null ? CALENDAR_NOTE : null
    };
}

function formatIso(nanos: bigint, epochMs: number): string {
    const base = new Date(epochMs).toISOString();
    const ms = BigInt(epochMs);
    const remainder = nanos - (ms * NS_PER_MS);

    if (remainder === 0n) {
        return base;
    }

    const extra = stripTrailingZeros(remainder.toString().padStart(6, '0'));

    return `${base.slice(0, -1)}${extra}Z`;
}

function formatZoneClock(epochMs: number, timeZone: string): string {
    const wall = readWall(epochMs, timeZone);
    const offset = formatOffset(timeZoneOffsetMs(epochMs, timeZone));

    return `${formatYear(wall.year)}-${pad(wall.month)}-${pad(wall.day)} ${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}.${pad(wall.millisecond, 3)} ${offset}`;
}

function formatOffset(offsetMs: number): string {
    const sign = offsetMs >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMs);
    const hours = Math.floor(abs / MS_PER_HOUR);
    const minutes = Math.floor((abs % MS_PER_HOUR) / MS_PER_MINUTE);

    return `UTC${sign}${pad(hours)}:${pad(minutes)}`;
}

function formatYear(year: number): string {
    if (year < 0) {
        return `-${pad(-year, 4)}`;
    }

    return pad(year, 4);
}

function pad(value: number, width = 2): string {
    return String(value).padStart(width, '0');
}

function readWall(epochMs: number, timeZone: string): CalendarParts {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        era: 'short',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const parts = formatter.formatToParts(new Date(epochMs));
    const values: Record<string, string> = {};

    for (let index = 0; index < parts.length; index += 1) {
        const part = parts[index];

        if (part.type !== 'literal') {
            values[part.type] = part.value;
        }
    }

    let hour = Number(values.hour);

    if (hour === 24) {
        hour = 0;
    }

    let year = Number(values.year);

    if (typeof values.era === 'string' && values.era.startsWith('B')) {
        year = 1 - year;
    }

    return {
        year,
        month: Number(values.month),
        day: Number(values.day),
        hour,
        minute: Number(values.minute),
        second: Number(values.second),
        millisecond: new Date(epochMs).getUTCMilliseconds()
    };
}

function utcFromParts(year: number, monthIndex: number, day: number, hour = 0, minute = 0, second = 0, millisecond = 0): number {
    // Date.UTC maps years 0 through 99 onto 1900 through 1999. setUTCFullYear does not.
    const date = new Date(0);
    date.setUTCFullYear(year, monthIndex, day);
    date.setUTCHours(hour, minute, second, millisecond);
    return date.getTime();
}

function timeZoneOffsetMs(epochMs: number, timeZone: string): number {
    const wall = readWall(epochMs, timeZone);

    return utcFromParts(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second, wall.millisecond) - epochMs;
}

function zonedPartsToEpochMs(parts: CalendarParts, timeZone: string): number | null {
    const utcGuess = utcFromParts(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
        parts.millisecond
    );
    const first = utcGuess - timeZoneOffsetMs(utcGuess, timeZone);
    const second = utcGuess - timeZoneOffsetMs(first, timeZone);
    const candidates = first === second ? [first] : [first, second];
    let earliest: number | null = null;

    for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];

        if (!wallClockMatches(candidate, parts, timeZone)) {
            continue;
        }

        if (earliest === null || candidate < earliest) {
            earliest = candidate;
        }
    }

    return earliest;
}

function wallClockMatches(epochMs: number, parts: CalendarParts, timeZone: string): boolean {
    const wall = readWall(epochMs, timeZone);

    return wall.year === parts.year
        && wall.month === parts.month
        && wall.day === parts.day
        && wall.hour === parts.hour
        && wall.minute === parts.minute
        && wall.second === parts.second
        && wall.millisecond === parts.millisecond;
}

function parseDateParts(date: string, time: string, millisecond: string): { ok: true, value: CalendarParts } | ConversionFailure {
    const dateText = date.trim();
    const timeText = time.trim();
    const msText = millisecond.trim();

    if (dateText.length === 0 || timeText.length === 0) {
        return { ok: false, message: 'Enter a date and time.' };
    }

    const dateMatch = DATE_PATTERN.exec(dateText);
    const timeMatch = TIME_PATTERN.exec(timeText);

    if (!dateMatch || !timeMatch) {
        return { ok: false, message: 'Enter a real calendar date.' };
    }

    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    const second = timeMatch[3] === undefined ? 0 : Number(timeMatch[3]);

    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
        return { ok: false, message: 'Enter a real calendar date.' };
    }

    if (hour > 23 || minute > 59 || second > 59) {
        return { ok: false, message: 'Enter a time from 00:00:00.000 through 23:59:59.999.' };
    }

    if (msText.length === 0) {
        return {
            ok: true,
            value: { year, month, day, hour, minute, second, millisecond: 0 }
        };
    }

    if (!/^\d{1,3}$/.test(msText)) {
        return { ok: false, message: 'Enter a time from 00:00:00.000 through 23:59:59.999.' };
    }

    const millisecondValue = Number(msText);

    return {
        ok: true,
        value: { year, month, day, hour, minute, second, millisecond: millisecondValue }
    };
}

function daysInMonth(year: number, month: number): number {
    return new Date(utcFromParts(year, month, 0)).getUTCDate();
}

function scaledString(nanos: bigint, scale: bigint): string {
    const negative = nanos < 0n;
    const abs = negative ? -nanos : nanos;
    const whole = abs / scale;
    const fraction = abs % scale;
    let body = whole.toString();

    if (fraction !== 0n) {
        const width = scale.toString().length - 1;
        const digits = stripTrailingZeros(fraction.toString().padStart(width, '0'));
        body = `${body}.${digits}`;
    }

    return negative ? `-${body}` : body;
}

function stripTrailingZeros(value: string): string {
    let end = value.length;

    while (end > 0 && value.charAt(end - 1) === '0') {
        end -= 1;
    }

    return value.slice(0, end);
}

function floorDiv(value: bigint, divisor: bigint): bigint {
    const quotient = value / divisor;
    const remainder = value % divisor;

    if (remainder !== 0n && value < 0n) {
        return quotient - 1n;
    }

    return quotient;
}

function requireConverted(result: ConversionResult): ConvertedTimestamp {
    if (result.ok === false) {
        // The constants below are fixed inputs. A failure here is a broken build.
        /* istanbul ignore next */
        throw new Error(result.message);
    }

    return result.value;
}

const workedOptions = {
    unit: 'auto' as const,
    timeZone: WORKED_EXAMPLE_ZONE,
    localTimeZone: WORKED_EXAMPLE_LOCAL_ZONE,
    nowMs: WORKED_EXAMPLE_NOW_MS
};

export const WORKED_EXAMPLE = requireConverted(convertEpoch({
    input: WORKED_EXAMPLE_EPOCH,
    ...workedOptions
}));

export const WORKED_EXAMPLE_REPORT = conversionLines(WORKED_EXAMPLE).join('\n');

export const WORKED_EXAMPLE_MS = requireConverted(convertEpoch({
    input: WORKED_EXAMPLE_MILLISECONDS,
    ...workedOptions
}));

export const WORKED_EXAMPLE_NS = requireConverted(convertEpoch({
    input: WORKED_EXAMPLE_NANOSECONDS,
    ...workedOptions
}));

export const WORKED_EXAMPLE_FROM_DATE = requireConverted(convertDate({
    date: '2023-11-14',
    time: '17:13:20',
    millisecond: '0',
    timeZone: WORKED_EXAMPLE_ZONE,
    localTimeZone: WORKED_EXAMPLE_LOCAL_ZONE,
    nowMs: WORKED_EXAMPLE_NOW_MS
}));

export const WORKED_EXAMPLE_NOW_ISO = new Date(WORKED_EXAMPLE_NOW_MS).toISOString();
