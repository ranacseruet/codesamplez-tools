import {
    MAX_UUID_COUNT,
    V4_BILLION_COLLISION_COUNT,
    buildUuidV4Bytes,
    buildUuidV7Bytes,
    describeV4CollisionOdds,
    formatUuidBytes,
    generateUuidV4Bytes,
    generateUuids,
    parseUuid,
    parseUuidCount,
    parseUuidList
} from './uuid';

const V4_RANDOM = Uint8Array.from([
    0x12, 0x3e, 0x45, 0x67, 0x89, 0xab,
    0x0c, 0xde,
    0x0f, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd
]);

const V7_RANDOM = Uint8Array.from([
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x0a, 0xbc,
    0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88
]);

/** Locked output of buildUuidV4Bytes + formatUuidBytes for V4_RANDOM. */
const LOCKED_V4 = '123e4567-89ab-4cde-8f01-23456789abcd';
const LOCKED_V4_UPPER_PLAIN = '123E456789AB4CDE8F0123456789ABCD';

/** 2026-11-24T15:21:38.000Z, the worked version 7 timestamp. */
const LOCKED_V7_TIMESTAMP_MS = Date.UTC(2026, 10, 24, 15, 21, 38);
const LOCKED_V7 = '01a20e25-f3d0-7abc-9122-334455667788';

describe('uuid bytes and formatting', () => {
    it('locks the version 4 worked example', () => {
        const bytes = buildUuidV4Bytes(V4_RANDOM);

        expect(formatUuidBytes(bytes)).toBe(LOCKED_V4);
        expect(formatUuidBytes(bytes, { uppercase: true, hyphens: false })).toBe(LOCKED_V4_UPPER_PLAIN);
        expect(bytes[6] >> 4).toBe(4);
        expect(bytes[8] & 0xc0).toBe(0x80);
        expect(Array.from(V4_RANDOM)).toEqual([
            0x12, 0x3e, 0x45, 0x67, 0x89, 0xab,
            0x0c, 0xde,
            0x0f, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd
        ]);
    });

    it('locks the version 7 worked example and round-trips the timestamp', () => {
        const bytes = buildUuidV7Bytes(LOCKED_V7_TIMESTAMP_MS, V7_RANDOM);
        const formatted = formatUuidBytes(bytes);
        const parsed = parseUuid(formatted);

        expect(formatted).toBe(LOCKED_V7);
        expect(parsed.valid).toBe(true);
        if (!parsed.valid) {
            return;
        }
        expect(parsed.version).toBe(7);
        expect(parsed.versionLabel).toBe('7 (time-ordered)');
        expect(parsed.variant).toBe('rfc4122');
        expect(parsed.variantLabel).toBe('RFC 4122');
        expect(parsed.timestampMs).toBe(LOCKED_V7_TIMESTAMP_MS);
        expect(parsed.timestampIso).toBe('2026-11-24T15:21:38.000Z');
        expect(parsed.nil).toBe(false);
        expect(parsed.max).toBe(false);
    });

    it('rejects a byte array that is not 16 bytes', () => {
        expect(() => buildUuidV4Bytes(new Uint8Array(15))).toThrow('UUID is 16 bytes');
        expect(() => formatUuidBytes(new Uint8Array(17))).toThrow('UUID is 16 bytes');
    });

    it('rejects a version 7 timestamp outside the 48-bit range', () => {
        expect(() => buildUuidV7Bytes(-1, V7_RANDOM)).toThrow('Timestamp is outside the 48-bit range');
        expect(() => buildUuidV7Bytes(0x1000000000000, V7_RANDOM)).toThrow('Timestamp is outside the 48-bit range');
        expect(() => buildUuidV7Bytes(1.5, V7_RANDOM)).toThrow('Timestamp is outside the 48-bit range');
        expect(formatUuidBytes(buildUuidV7Bytes(0, V7_RANDOM)).startsWith('00000000-0000-7')).toBe(true);
    });
});

describe('parseUuid', () => {
    it('reads a canonical version 4 UUID', () => {
        const parsed = parseUuid(LOCKED_V4);

        expect(parsed.valid).toBe(true);
        if (!parsed.valid) {
            return;
        }
        expect(parsed.canonical).toBe(LOCKED_V4);
        expect(parsed.version).toBe(4);
        expect(parsed.versionLabel).toBe('4 (random)');
        expect(parsed.variantLabel).toBe('RFC 4122');
        expect(parsed.timestampMs).toBeNull();
        expect(parsed.timestampIso).toBeNull();
    });

    it('accepts uppercase, missing hyphens, braces, and a urn prefix', () => {
        const forms = [
            LOCKED_V4_UPPER_PLAIN,
            `{${LOCKED_V4}}`,
            `urn:uuid:${LOCKED_V4}`,
            `URN:UUID:${LOCKED_V4_UPPER_PLAIN}`
        ];

        forms.forEach((form) => {
            const parsed = parseUuid(form);
            expect(parsed.valid).toBe(true);
            if (parsed.valid) {
                expect(parsed.canonical).toBe(LOCKED_V4);
                expect(parsed.version).toBe(4);
            }
        });
    });

    it('names the other variant ranges and the nil and max UUIDs', () => {
        const nil = parseUuid('00000000-0000-0000-0000-000000000000');
        const max = parseUuid('ffffffff-ffff-ffff-ffff-ffffffffffff');
        const microsoft = parseUuid('123e4567-89ab-4cde-c101-23456789abcd');
        const future = parseUuid('123e4567-89ab-4cde-e101-23456789abcd');
        const otherVersion = parseUuid('123e4567-89ab-1cde-8101-23456789abcd');

        expect(nil.valid && nil.nil && nil.versionLabel).toBe('0');
        expect(nil.valid && nil.variant).toBe('ncs');
        expect(max.valid && max.max && max.variant).toBe('future');
        expect(max.valid && max.variantLabel).toBe('Reserved');
        expect(microsoft.valid && microsoft.variant).toBe('microsoft');
        expect(microsoft.valid && microsoft.variantLabel).toBe('Microsoft');
        expect(future.valid && future.variant).toBe('future');
        expect(otherVersion.valid && otherVersion.versionLabel).toBe('1');
        expect(otherVersion.valid && otherVersion.timestampMs).toBeNull();
    });

    it('rejects empty, short, and misplaced-hyphen text', () => {
        expect(parseUuid('   ')).toEqual({ valid: false, reason: 'Enter a UUID.' });
        expect(parseUuid('not-a-uuid').valid).toBe(false);
        expect(parseUuid('123e4567-89ab-4cde-8f01-23456789abc').valid).toBe(false);
        expect(parseUuid('123e456789ab4cde8f0123456789abcg').valid).toBe(false);
        expect(parseUuid('123e4567-89ab-4cde-8f01-23456789abcd-extra').valid).toBe(false);
    });

    it('parses one UUID per line and skips blank lines', () => {
        const parsed = parseUuidList(`\n${LOCKED_V4}\n\nnot-a-uuid\n${LOCKED_V7}\n`);

        expect(parsed).toHaveLength(3);
        expect(parsed[0].valid && parsed[0].version).toBe(4);
        expect(parsed[1].valid).toBe(false);
        expect(parsed[2].valid && parsed[2].timestampIso).toBe('2026-11-24T15:21:38.000Z');
    });
});

describe('generateUuids', () => {
    it('formats a deterministic bulk list from supplied bytes', () => {
        const lines = generateUuids({
            version: 4,
            count: 2,
            uppercase: true,
            hyphens: false,
            randomBytes: () => V4_RANDOM
        });

        expect(lines).toEqual([LOCKED_V4_UPPER_PLAIN, LOCKED_V4_UPPER_PLAIN]);
    });

    it('uses one timestamp for every version 7 value in the call', () => {
        let calls = 0;
        const lines = generateUuids({
            version: 7,
            count: 2,
            timestampMs: LOCKED_V7_TIMESTAMP_MS,
            randomBytes: () => {
                calls += 1;
                return V7_RANDOM;
            }
        });

        expect(calls).toBe(2);
        expect(lines).toEqual([LOCKED_V7, LOCKED_V7]);
    });

    it('rejects a count outside 1 to 100', () => {
        expect(parseUuidCount('0')).toEqual({
            ok: false,
            message: 'Enter a whole number from 1 to 100.'
        });
        expect(parseUuidCount('101').ok).toBe(false);
        expect(parseUuidCount('1.5').ok).toBe(false);
        expect(parseUuidCount('').ok).toBe(false);
        expect(parseUuidCount(' 8 ').ok && parseUuidCount(' 8 ')).toEqual({ ok: true, count: 8 });
        expect(MAX_UUID_COUNT).toBe(100);
        expect(() => generateUuids({ version: 4, count: 0 })).toThrow('Enter a whole number from 1 to 100.');
    });

    it('builds version 4 values with crypto.randomUUID', () => {
        const spy = jest.spyOn(crypto, 'randomUUID').mockReturnValue(LOCKED_V4);

        try {
            const [line] = generateUuids({ version: 4, count: 1, hyphens: false });

            expect(line).toBe(LOCKED_V4.replace(/-/g, ''));
            expect(spy).toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });

    it('falls back to getRandomValues when randomUUID is missing or unusable', () => {
        const originalRandomUuid = crypto.randomUUID;
        const fill = jest.spyOn(crypto, 'getRandomValues').mockImplementation((bytes) => {
            const target = bytes as Uint8Array;
            target.set(V4_RANDOM);
            return bytes;
        });

        try {
            Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
            expect(formatUuidBytes(generateUuidV4Bytes())).toBe(LOCKED_V4);

            Object.defineProperty(crypto, 'randomUUID', {
                configurable: true,
                value: () => 'not-a-uuid'
            });
            expect(formatUuidBytes(generateUuidV4Bytes())).toBe(LOCKED_V4);

            Object.defineProperty(crypto, 'randomUUID', {
                configurable: true,
                value: () => {
                    throw new Error('unavailable');
                }
            });
            expect(formatUuidBytes(generateUuidV4Bytes())).toBe(LOCKED_V4);
        } finally {
            Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: originalRandomUuid });
            fill.mockRestore();
        }
    });

    it('builds a live version 7 UUID from getRandomValues and Date.now', () => {
        const now = LOCKED_V7_TIMESTAMP_MS;
        const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
        const fill = jest.spyOn(crypto, 'getRandomValues').mockImplementation((bytes) => {
            const target = bytes as Uint8Array;
            target.set(V7_RANDOM);
            return bytes;
        });

        try {
            const [line] = generateUuids({ version: 7, count: 1 });
            const parsed = parseUuid(line);

            expect(line).toBe(LOCKED_V7);
            expect(parsed.valid && parsed.timestampMs).toBe(now);
        } finally {
            dateSpy.mockRestore();
            fill.mockRestore();
        }
    });

    it('throws when crypto.getRandomValues is missing', () => {
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

        Object.defineProperty(globalThis, 'crypto', {
            configurable: true,
            value: undefined
        });

        try {
            expect(() => generateUuids({ version: 7, count: 1 })).toThrow('crypto.getRandomValues is not available');
            expect(() => generateUuidV4Bytes()).toThrow('crypto.getRandomValues is not available');
        } finally {
            if (descriptor) {
                Object.defineProperty(globalThis, 'crypto', descriptor);
            }
        }
    });
});

describe('describeV4CollisionOdds', () => {
    it('prints the birthday approximation for 103 trillion version 4 UUIDs', () => {
        expect(V4_BILLION_COLLISION_COUNT).toBe(103_000_000_000_000);
        expect(describeV4CollisionOdds()).toBe(
            'Version 4 uses 122 random bits. Among 103,000,000,000,000 version 4 UUIDs, the birthday approximation puts the chance of one collision at about 1 in 1,002,339,897.'
        );
    });
});
