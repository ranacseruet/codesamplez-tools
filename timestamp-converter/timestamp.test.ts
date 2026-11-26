import {
    COMMON_TIME_ZONES,
    MAX_TIMESTAMP_LENGTH,
    WORKED_EXAMPLE,
    WORKED_EXAMPLE_EPOCH,
    WORKED_EXAMPLE_FROM_DATE,
    WORKED_EXAMPLE_LOCAL_ZONE,
    WORKED_EXAMPLE_MILLISECONDS,
    WORKED_EXAMPLE_MS,
    WORKED_EXAMPLE_NANOSECONDS,
    WORKED_EXAMPLE_NOW_ISO,
    WORKED_EXAMPLE_NOW_MS,
    WORKED_EXAMPLE_NS,
    WORKED_EXAMPLE_REPORT,
    WORKED_EXAMPLE_ZONE,
    conversionLines,
    convertDate,
    convertEpoch,
    convertJwtNumericDate,
    detectUnit,
    formatRelativeTime,
    isValidTimeZone,
    type ConvertedTimestamp
} from './timestamp';

const ZONES = {
    timeZone: WORKED_EXAMPLE_ZONE,
    localTimeZone: WORKED_EXAMPLE_LOCAL_ZONE,
    nowMs: WORKED_EXAMPLE_NOW_MS
};

function epoch(input: string, unit: 'auto' | 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds' = 'auto') {
    return convertEpoch({ input, unit, ...ZONES });
}

function valueOf(input: string, unit: 'auto' | 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds' = 'auto'): ConvertedTimestamp {
    const result = epoch(input, unit);

    if (result.ok === false) {
        throw new Error(result.message);
    }

    return result.value;
}

describe('unix timestamp conversion', () => {
    it('locks the worked example to the converter', () => {
        expect(WORKED_EXAMPLE.unit).toBe('seconds');
        expect(WORKED_EXAMPLE.unixSeconds).toBe('1700000000');
        expect(WORKED_EXAMPLE.unixMilliseconds).toBe('1700000000000');
        expect(WORKED_EXAMPLE.unixMicroseconds).toBe('1700000000000000');
        expect(WORKED_EXAMPLE.unixNanoseconds).toBe('1700000000000000000');
        expect(WORKED_EXAMPLE.iso8601).toBe('2023-11-14T22:13:20.000Z');
        expect(WORKED_EXAMPLE.rfc2822).toBe('Tue, 14 Nov 2023 22:13:20 GMT');
        expect(WORKED_EXAMPLE.utc).toBe('2023-11-14 22:13:20.000 UTC+00:00');
        expect(WORKED_EXAMPLE.zoned).toBe('2023-11-14 17:13:20.000 UTC-05:00');
        expect(WORKED_EXAMPLE.local).toBe('2023-11-14 16:13:20.000 UTC-06:00');
        expect(WORKED_EXAMPLE.timeZone).toBe('America/New_York');
        expect(WORKED_EXAMPLE.localTimeZone).toBe('America/Chicago');
        expect(WORKED_EXAMPLE.relative).toBe('2 hours ago');
        expect(WORKED_EXAMPLE.calendarNote).toBeNull();
        expect(WORKED_EXAMPLE_NOW_ISO).toBe('2023-11-15T00:13:20.000Z');
        expect(WORKED_EXAMPLE_REPORT).toContain('ISO 8601: 2023-11-14T22:13:20.000Z');
        expect(WORKED_EXAMPLE_REPORT).toContain('Time zone (America/New_York): 2023-11-14 17:13:20.000 UTC-05:00');
        expect(WORKED_EXAMPLE_REPORT).toContain('Local (America/Chicago): 2023-11-14 16:13:20.000 UTC-06:00');
        expect(WORKED_EXAMPLE_REPORT).toContain('Relative: 2 hours ago');
        expect(conversionLines(WORKED_EXAMPLE).join('\n')).toBe(WORKED_EXAMPLE_REPORT);

        expect(WORKED_EXAMPLE_MS.unit).toBe('milliseconds');
        expect(WORKED_EXAMPLE_MS.iso8601).toBe('2023-11-14T22:13:20.123Z');
        expect(WORKED_EXAMPLE_MS.unixMilliseconds).toBe(WORKED_EXAMPLE_MILLISECONDS);

        expect(WORKED_EXAMPLE_NS.unit).toBe('nanoseconds');
        expect(WORKED_EXAMPLE_NS.iso8601).toBe('2023-11-14T22:13:20.123456789Z');
        expect(WORKED_EXAMPLE_NS.unixNanoseconds).toBe(WORKED_EXAMPLE_NANOSECONDS);
        expect(WORKED_EXAMPLE_NS.rfc2822).toBe('Tue, 14 Nov 2023 22:13:20 GMT');

        expect(WORKED_EXAMPLE_FROM_DATE.unixSeconds).toBe(WORKED_EXAMPLE_EPOCH);
        expect(WORKED_EXAMPLE_FROM_DATE.iso8601).toBe(WORKED_EXAMPLE.iso8601);
        expect(WORKED_EXAMPLE_FROM_DATE.unit).toBe('seconds');
    });

    it('detects the unit from the integer digit count', () => {
        expect(detectUnit(1)).toBe('seconds');
        expect(detectUnit(10)).toBe('seconds');
        expect(detectUnit(11)).toBe('milliseconds');
        expect(detectUnit(13)).toBe('milliseconds');
        expect(detectUnit(14)).toBe('microseconds');
        expect(detectUnit(16)).toBe('microseconds');
        expect(detectUnit(17)).toBe('nanoseconds');
        expect(detectUnit(19)).toBe('nanoseconds');
        expect(detectUnit(20)).toBeNull();
        expect(detectUnit(0)).toBeNull();

        expect(valueOf('9999999999').unit).toBe('seconds');
        expect(valueOf('10000000000').unit).toBe('milliseconds');
        expect(valueOf('10000000000000').unit).toBe('microseconds');
        expect(valueOf('10000000000000000').unit).toBe('nanoseconds');
        expect(valueOf('0001700000000').unixSeconds).toBe(WORKED_EXAMPLE_EPOCH);
        expect(valueOf(' 1700000000 ').iso8601).toBe(WORKED_EXAMPLE.iso8601);
    });

    it('keeps fractions and negative instants exact', () => {
        const half = valueOf('1.5');
        expect(half.unit).toBe('seconds');
        expect(half.unixSeconds).toBe('1.5');
        expect(half.unixMilliseconds).toBe('1500');
        expect(half.iso8601).toBe('1970-01-01T00:00:01.500Z');

        const negative = valueOf('-1.5');
        expect(negative.unixSeconds).toBe('-1.5');
        expect(negative.iso8601).toBe('1969-12-31T23:59:58.500Z');
        expect(negative.rfc2822).toBe('Wed, 31 Dec 1969 23:59:58 GMT');

        const oneNano = valueOf('-1', 'nanoseconds');
        expect(oneNano.unixNanoseconds).toBe('-1');
        expect(oneNano.iso8601).toBe('1969-12-31T23:59:59.999999999Z');

        expect(valueOf('1700000000.5').iso8601).toBe('2023-11-14T22:13:20.500Z');
        expect(valueOf('1700000000123456').unit).toBe('microseconds');
        expect(valueOf('1700000000123456').iso8601).toBe('2023-11-14T22:13:20.123456Z');
    });

    it('lets the unit menu override the digit count', () => {
        const forced = valueOf('9000000000000', 'seconds');
        expect(forced.unit).toBe('seconds');
        expect(forced.calendarNote).toContain('outside the range');
        expect(forced.iso8601).toBeNull();
        expect(forced.unixSeconds).toBe('9000000000000');
        expect(valueOf(WORKED_EXAMPLE_MILLISECONDS, 'milliseconds').iso8601).toBe('2023-11-14T22:13:20.123Z');
    });

    it('rejects input that is empty, too long, or not a timestamp', () => {
        expect(epoch('').ok).toBe(false);
        expect(epoch('   ')).toEqual({ ok: false, message: 'Enter a timestamp.' });
        expect(epoch('x'.repeat(MAX_TIMESTAMP_LENGTH + 1))).toEqual({
            ok: false,
            message: 'That timestamp is too long.'
        });
        expect(epoch('+1700000000').ok).toBe(false);
        expect(epoch('1,700').ok).toBe(false);
        expect(epoch('1e9').ok).toBe(false);
        expect(epoch('1700000000.').ok).toBe(false);
        expect(epoch('1.2.3').ok).toBe(false);
        expect(epoch('1'.repeat(20))).toEqual({
            ok: false,
            message: 'That integer has too many digits to be seconds, milliseconds, microseconds, or nanoseconds.'
        });
        expect(epoch('1.0000000001')).toEqual({
            ok: false,
            message: 'That fraction is finer than a nanosecond. This page keeps whole nanoseconds.'
        });
        expect(epoch('1.5', 'nanoseconds')).toEqual({
            ok: false,
            message: 'That fraction is finer than a nanosecond. This page keeps whole nanoseconds.'
        });
    });

    it('formats another IANA zone and rejects an unknown name', () => {
        const kolkata = convertEpoch({
            input: WORKED_EXAMPLE_EPOCH,
            unit: 'auto',
            timeZone: 'Asia/Kolkata',
            localTimeZone: 'UTC',
            nowMs: WORKED_EXAMPLE_NOW_MS
        });

        expect(kolkata.ok).toBe(true);
        if (kolkata.ok) {
            expect(kolkata.value.zoned).toBe('2023-11-15 03:43:20.000 UTC+05:30');
            expect(kolkata.value.local).toBe('2023-11-14 22:13:20.000 UTC+00:00');
        }

        expect(isValidTimeZone('UTC')).toBe(true);
        expect(isValidTimeZone('America/New_York')).toBe(true);
        expect(isValidTimeZone('not a zone')).toBe(false);
        expect(isValidTimeZone(' UTC')).toBe(false);
        expect(isValidTimeZone('')).toBe(false);
        expect(COMMON_TIME_ZONES).toContain('UTC');
        expect(COMMON_TIME_ZONES).toContain('Asia/Kolkata');

        expect(convertEpoch({
            input: WORKED_EXAMPLE_EPOCH,
            unit: 'auto',
            timeZone: 'Not/AZone',
            localTimeZone: 'UTC',
            nowMs: WORKED_EXAMPLE_NOW_MS
        })).toEqual({
            ok: false,
            message: 'Enter an IANA time zone such as UTC or America/New_York.'
        });
    });

    it('turns a zoned date back into the worked epoch and rejects a daylight-saving gap', () => {
        const roundTrip = convertDate({
            date: '2023-11-14',
            time: '17:13:20',
            millisecond: '',
            ...ZONES
        });
        expect(roundTrip.ok && roundTrip.value.unixSeconds).toBe(WORKED_EXAMPLE_EPOCH);

        const withMs = convertDate({
            date: '2023-11-14',
            time: '17:13:20',
            millisecond: '123',
            ...ZONES
        });
        expect(withMs.ok && withMs.value.unit).toBe('milliseconds');
        expect(withMs.ok && withMs.value.iso8601).toBe('2023-11-14T22:13:20.123Z');

        const overlap = convertDate({
            date: '2023-11-05',
            time: '01:30:00',
            millisecond: '0',
            timeZone: 'America/New_York',
            localTimeZone: 'UTC',
            nowMs: WORKED_EXAMPLE_NOW_MS
        });
        const earlier = Date.UTC(2023, 10, 5, 5, 30, 0) / 1000;
        const later = Date.UTC(2023, 10, 5, 6, 30, 0) / 1000;
        expect(overlap.ok && overlap.value.unixSeconds).toBe(String(earlier));
        expect(overlap.ok && overlap.value.unixSeconds).not.toBe(String(later));

        expect(convertDate({
            date: '2023-03-12',
            time: '02:30:00',
            millisecond: '0',
            timeZone: 'America/New_York',
            localTimeZone: 'UTC',
            nowMs: WORKED_EXAMPLE_NOW_MS
        })).toEqual({
            ok: false,
            message: 'That local time does not exist in this time zone.'
        });
    });

    it('rejects a date or time that is not on the calendar', () => {
        expect(convertDate({ date: '', time: '', millisecond: '', ...ZONES })).toEqual({
            ok: false,
            message: 'Enter a date and time.'
        });
        expect(convertDate({ date: '2023/11/14', time: '17:13:20', millisecond: '0', ...ZONES }).ok).toBe(false);
        expect(convertDate({ date: '2023-02-29', time: '12:00:00', millisecond: '0', ...ZONES })).toEqual({
            ok: false,
            message: 'Enter a real calendar date.'
        });
        expect(convertDate({ date: '2024-02-29', time: '12:00', millisecond: '0', ...ZONES }).ok).toBe(true);
        expect(convertDate({ date: '2023-11-14', time: '24:00:00', millisecond: '0', ...ZONES })).toEqual({
            ok: false,
            message: 'Enter a time from 00:00:00.000 through 23:59:59.999.'
        });
        expect(convertDate({ date: '2023-11-14', time: '17:13:60', millisecond: '0', ...ZONES }).ok).toBe(false);
        expect(convertDate({ date: '2023-11-14', time: '17:13:20', millisecond: '1000', ...ZONES }).ok).toBe(false);
        expect(convertDate({
            date: '2023-11-14',
            time: '17:13:20',
            millisecond: '0',
            timeZone: 'Not/AZone',
            localTimeZone: 'UTC',
            nowMs: WORKED_EXAMPLE_NOW_MS
        }).ok).toBe(false);
    });

    it('reads a JWT NumericDate as seconds even when it has 13 digits', () => {
        expect(convertJwtNumericDate({ input: '  ', unit: 'seconds', ...ZONES })).toEqual({
            ok: false,
            message: 'Enter a JWT exp, iat, or nbf value in seconds.'
        });

        const jwt = convertJwtNumericDate({ input: WORKED_EXAMPLE_EPOCH, unit: 'seconds', ...ZONES });
        expect(jwt.ok && jwt.value.iso8601).toBe(WORKED_EXAMPLE.iso8601);
        expect(jwt.ok && jwt.value.unit).toBe('seconds');

        const thirteenDigits = convertJwtNumericDate({ input: WORKED_EXAMPLE_MILLISECONDS, unit: 'seconds', ...ZONES });
        expect(thirteenDigits.ok && thirteenDigits.value.unit).toBe('seconds');
        expect(thirteenDigits.ok && thirteenDigits.value.unixSeconds).toBe(WORKED_EXAMPLE_MILLISECONDS);
        expect(thirteenDigits.ok && thirteenDigits.value.iso8601).not.toBe('2023-11-14T22:13:20.123Z');

        const long = convertJwtNumericDate({ input: '9000000000000', unit: 'seconds', ...ZONES });
        expect(long.ok && long.value.unit).toBe('seconds');
        expect(long.ok && long.value.calendarNote).toContain('outside the range');
        expect(long.ok && long.value.unixSeconds).toBe('9000000000000');
    });

    it('shows an astronomical year before 1 AD and a note when the calendar range is exceeded', () => {
        const beforeYearOne = valueOf('-62167219201', 'seconds');
        expect(beforeYearOne.utc).toBe('-0001-12-31 23:59:59.000 UTC+00:00');
        expect(beforeYearOne.iso8601).toBe('-000001-12-31T23:59:59.000Z');
        expect(beforeYearOne.rfc2822).toBe('Fri, 31 Dec -0001 23:59:59 GMT');

        const yearZero = valueOf('-62167219200', 'seconds');
        expect(yearZero.utc).toBe('0000-01-01 00:00:00.000 UTC+00:00');

        const leapDayInYearZero = convertDate({
            date: '0000-02-29',
            time: '00:00:00',
            millisecond: '0',
            timeZone: 'UTC',
            localTimeZone: 'UTC',
            nowMs: WORKED_EXAMPLE_NOW_MS
        });
        expect(leapDayInYearZero.ok && leapDayInYearZero.value.unixSeconds).toBe('-62162121600');
        expect(convertDate({
            date: '0100-02-29',
            time: '00:00:00',
            millisecond: '0',
            timeZone: 'UTC',
            localTimeZone: 'UTC',
            nowMs: WORKED_EXAMPLE_NOW_MS
        })).toEqual({
            ok: false,
            message: 'Enter a real calendar date.'
        });

        const outside = valueOf('9000000000000', 'seconds');
        expect(outside.calendarNote).toContain('outside the range');
        const outsideLines = conversionLines(outside);
        expect(outsideLines[outsideLines.length - 1]).toBe(outside.calendarNote);
        expect(outsideLines.some((line) => line.startsWith('ISO 8601:'))).toBe(false);
    });

    it('rounds relative time and names a single unit', () => {
        const base = WORKED_EXAMPLE_NOW_MS;
        expect(formatRelativeTime(base, base)).toBe('just now');
        expect(formatRelativeTime(base + 400, base)).toBe('just now');
        expect(formatRelativeTime(base - 30_000, base)).toBe('30 seconds ago');
        expect(formatRelativeTime(base + 3 * 86_400_000, base)).toBe('in 3 days');
        expect(formatRelativeTime(base - 86_400_000, base)).toBe('1 day ago');
        expect(formatRelativeTime(base + 365 * 86_400_000, base)).toBe('in 1 year');
        expect(formatRelativeTime(Number.NaN, base)).toBeNull();
        expect(valueOf(WORKED_EXAMPLE_EPOCH).relative).toBe('2 hours ago');
        expect(convertEpoch({
            input: WORKED_EXAMPLE_EPOCH,
            unit: 'auto',
            timeZone: 'UTC',
            localTimeZone: 'UTC',
            nowMs: WORKED_EXAMPLE_NOW_MS - (3 * 86_400_000)
        }).ok).toBe(true);
    });
});
