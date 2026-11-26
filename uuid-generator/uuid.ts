/**
 * UUID version 4 and version 7, plus a parser.
 *
 * Version 4 uses crypto.randomUUID when the browser provides it, and
 * crypto.getRandomValues otherwise. Version 7 is the RFC 9562 layout: a
 * 48-bit Unix timestamp in milliseconds, the version nibble, the RFC 4122
 * variant, and random bits. No UUID library is involved.
 */

export const UUID_BYTE_LENGTH = 16;
export const MAX_UUID_COUNT = 100;
export const V4_RANDOM_BITS = 122;
/** Count at which the v4 birthday approximation is about one in a billion. */
export const V4_BILLION_COLLISION_COUNT = 103_000_000_000_000;

const UNIX_MS_48_BIT_MAX = 0xffffffffffff;

export type UuidVersion = 4 | 7;
export type UuidVariant = 'rfc4122' | 'ncs' | 'microsoft' | 'future';

export interface FormatUuidOptions {
    uppercase?: boolean;
    hyphens?: boolean;
}

export interface GenerateUuidOptions extends FormatUuidOptions {
    version: UuidVersion;
    count: number;
    /** Version 7 timestamp for every value in the call. Defaults to Date.now(). */
    timestampMs?: number;
    /**
     * Sixteen bytes per value, instead of crypto. The worked example and tests
     * pass this. A normal Generate click does not.
     */
    randomBytes?: (index: number) => Uint8Array;
}

export interface ValidUuid {
    valid: true;
    canonical: string;
    bytes: Uint8Array;
    version: number;
    versionLabel: string;
    variant: UuidVariant;
    variantLabel: string;
    nil: boolean;
    max: boolean;
    timestampMs: number | null;
    timestampIso: string | null;
}

export interface InvalidUuid {
    valid: false;
    reason: string;
}

export type ParsedUuid = ValidUuid | InvalidUuid;

export interface UuidCountSuccess {
    ok: true;
    count: number;
}

export interface UuidCountFailure {
    ok: false;
    message: string;
}

const VARIANT_LABELS: Record<UuidVariant, string> = {
    rfc4122: 'RFC 4122',
    ncs: 'NCS',
    microsoft: 'Microsoft',
    future: 'Reserved'
};

const NOT_A_UUID_REASON = 'That is not a UUID. Use 32 hex digits, with or without hyphens.';

/**
 * Birthday approximation for version 4: n² / 2^123, which is n(n−1)/2 divided
 * by 2^122 when n is large. The sentence is what the guide prints.
 */
export function describeV4CollisionOdds(): string {
    const count = V4_BILLION_COLLISION_COUNT;
    const probability = (count * count) / (2 ** (V4_RANDOM_BITS + 1));
    const oneIn = Math.round(1 / probability);
    const countLabel = count.toLocaleString('en-US');
    const oneInLabel = oneIn.toLocaleString('en-US');

    return `Version 4 uses ${V4_RANDOM_BITS} random bits. Among ${countLabel} version 4 UUIDs, the birthday approximation puts the chance of one collision at about 1 in ${oneInLabel}.`;
}

export function versionLabel(version: number): string {
    if (version === 4) {
        return '4 (random)';
    }

    if (version === 7) {
        return '7 (time-ordered)';
    }

    return String(version);
}

export function parseUuidCount(value: string): UuidCountSuccess | UuidCountFailure {
    const message = `Enter a whole number from 1 to ${MAX_UUID_COUNT}.`;
    const trimmed = value.trim();

    if (!/^\d+$/.test(trimmed)) {
        return { ok: false, message };
    }

    const count = Number(trimmed);

    if (count < 1 || count > MAX_UUID_COUNT) {
        return { ok: false, message };
    }

    return { ok: true, count };
}

export function buildUuidV4Bytes(randomBytes: Uint8Array): Uint8Array {
    const bytes = copyUuidBytes(randomBytes);
    stampVersionAndVariant(bytes, 4);
    return bytes;
}

export function buildUuidV7Bytes(timestampMs: number, randomBytes: Uint8Array): Uint8Array {
    const bytes = copyUuidBytes(randomBytes);
    writeUnixTimestamp(bytes, timestampMs);
    stampVersionAndVariant(bytes, 7);
    return bytes;
}

export function formatUuidBytes(bytes: Uint8Array, options: FormatUuidOptions = {}): string {
    if (bytes.length !== UUID_BYTE_LENGTH) {
        throw new Error('UUID is 16 bytes');
    }

    const hex = bytesToHex(bytes);
    const hyphenated = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    const body = options.hyphens === false ? hex : hyphenated;

    return options.uppercase ? body.toUpperCase() : body;
}

export function parseUuid(input: string): ParsedUuid {
    const normalized = stripUuidWrappers(input);

    if (normalized.length === 0) {
        return { valid: false, reason: 'Enter a UUID.' };
    }

    const hex = readUuidHex(normalized);

    if (!hex) {
        return { valid: false, reason: NOT_A_UUID_REASON };
    }

    const bytes = hexToBytes(hex);
    const version = bytes[6] >> 4;
    const variant = readVariant(bytes[8]);
    const nil = isEveryByte(bytes, 0);
    const max = isEveryByte(bytes, 0xff);
    const timestampMs = version === 7 ? readUnixTimestamp(bytes) : null;

    return {
        valid: true,
        canonical: formatUuidBytes(bytes),
        bytes,
        version,
        versionLabel: versionLabel(version),
        variant,
        variantLabel: VARIANT_LABELS[variant],
        nil,
        max,
        timestampMs,
        timestampIso: timestampMs === null ? null : new Date(timestampMs).toISOString()
    };
}

export function parseUuidList(input: string): ParsedUuid[] {
    const lines = input.split(/\r?\n/);
    const parsed: ParsedUuid[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        if (lines[index].trim().length === 0) {
            continue;
        }

        parsed.push(parseUuid(lines[index]));
    }

    return parsed;
}

export function generateUuids(options: GenerateUuidOptions): string[] {
    const parsedCount = parseUuidCount(String(options.count));

    if (parsedCount.ok === false) {
        throw new Error(parsedCount.message);
    }

    const lines: string[] = [];

    for (let index = 0; index < parsedCount.count; index += 1) {
        const bytes = options.randomBytes
            ? (options.version === 7
                ? buildUuidV7Bytes(resolveTimestamp(options.timestampMs), options.randomBytes(index))
                : buildUuidV4Bytes(options.randomBytes(index)))
            : (options.version === 7
                ? buildUuidV7Bytes(resolveTimestamp(options.timestampMs), randomFill())
                : generateUuidV4Bytes());

        lines.push(formatUuidBytes(bytes, options));
    }

    return lines;
}

export function generateUuidV4Bytes(): Uint8Array {
    const fromRandomUuid = tryRandomUuidV4();

    if (fromRandomUuid) {
        return fromRandomUuid;
    }

    return buildUuidV4Bytes(randomFill());
}

function resolveTimestamp(timestampMs: number | undefined): number {
    return typeof timestampMs === 'number' ? timestampMs : Date.now();
}

function tryRandomUuidV4(): Uint8Array | null {
    const webCrypto = readCrypto();

    if (!webCrypto || typeof webCrypto.randomUUID !== 'function') {
        return null;
    }

    try {
        const parsed = parseUuid(webCrypto.randomUUID());

        if (parsed.valid && parsed.version === 4 && parsed.variant === 'rfc4122') {
            return parsed.bytes;
        }
    } catch {
        return null;
    }

    return null;
}

function randomFill(): Uint8Array {
    const webCrypto = readCrypto();

    if (!webCrypto) {
        throw new Error('crypto.getRandomValues is not available');
    }

    const bytes = new Uint8Array(UUID_BYTE_LENGTH);
    webCrypto.getRandomValues(bytes);
    return bytes;
}

function readCrypto(): Crypto | null {
    const value = globalThis.crypto;

    if (!value || typeof value.getRandomValues !== 'function') {
        return null;
    }

    return value;
}

function copyUuidBytes(source: Uint8Array): Uint8Array {
    if (source.length !== UUID_BYTE_LENGTH) {
        throw new Error('UUID is 16 bytes');
    }

    const bytes = new Uint8Array(UUID_BYTE_LENGTH);
    bytes.set(source);
    return bytes;
}

function stampVersionAndVariant(bytes: Uint8Array, version: UuidVersion): void {
    bytes[6] = (bytes[6] & 0x0f) | (version << 4);
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
}

function writeUnixTimestamp(bytes: Uint8Array, timestampMs: number): void {
    if (!Number.isSafeInteger(timestampMs) || timestampMs < 0 || timestampMs > UNIX_MS_48_BIT_MAX) {
        throw new Error('Timestamp is outside the 48-bit range');
    }

    bytes[0] = Math.floor(timestampMs / (2 ** 40)) & 0xff;
    bytes[1] = Math.floor(timestampMs / (2 ** 32)) & 0xff;
    bytes[2] = Math.floor(timestampMs / (2 ** 24)) & 0xff;
    bytes[3] = Math.floor(timestampMs / (2 ** 16)) & 0xff;
    bytes[4] = Math.floor(timestampMs / (2 ** 8)) & 0xff;
    bytes[5] = timestampMs & 0xff;
}

function readUnixTimestamp(bytes: Uint8Array): number {
    return (bytes[0] * (2 ** 40))
        + (bytes[1] * (2 ** 32))
        + (bytes[2] * (2 ** 24))
        + (bytes[3] * (2 ** 16))
        + (bytes[4] * (2 ** 8))
        + bytes[5];
}

function readVariant(variantByte: number): UuidVariant {
    if ((variantByte & 0x80) === 0) {
        return 'ncs';
    }

    if ((variantByte & 0xc0) === 0x80) {
        return 'rfc4122';
    }

    if ((variantByte & 0xe0) === 0xc0) {
        return 'microsoft';
    }

    return 'future';
}

function stripUuidWrappers(input: string): string {
    let value = input.trim();

    if (/^urn:uuid:/i.test(value)) {
        value = value.slice('urn:uuid:'.length).trim();
    }

    if (value.startsWith('{') && value.endsWith('}')) {
        value = value.slice(1, -1).trim();
    }

    return value;
}

function readUuidHex(value: string): string | null {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        return value.replace(/-/g, '').toLowerCase();
    }

    if (/^[0-9a-f]{32}$/i.test(value)) {
        return value.toLowerCase();
    }

    return null;
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(UUID_BYTE_LENGTH);

    for (let index = 0; index < UUID_BYTE_LENGTH; index += 1) {
        bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    }

    return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
    let hex = '';

    for (let index = 0; index < bytes.length; index += 1) {
        hex += bytes[index].toString(16).padStart(2, '0');
    }

    return hex;
}

function isEveryByte(bytes: Uint8Array, expected: number): boolean {
    for (let index = 0; index < bytes.length; index += 1) {
        if (bytes[index] !== expected) {
            return false;
        }
    }

    return true;
}

/** Fixed inputs for the guide and the Validate sample. The strings are formatted by this file. */
export const WORKED_EXAMPLE_V4_RANDOM = Uint8Array.from([
    0x12, 0x3e, 0x45, 0x67, 0x89, 0xab,
    0x0c, 0xde,
    0x0f, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd
]);

export const WORKED_EXAMPLE_V7_RANDOM = Uint8Array.from([
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x0a, 0xbc,
    0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88
]);

export const WORKED_EXAMPLE_V7_TIMESTAMP_MS = Date.UTC(2026, 10, 24, 15, 21, 38);

const workedExampleV4Bytes = buildUuidV4Bytes(WORKED_EXAMPLE_V4_RANDOM);
const workedExampleV7Bytes = buildUuidV7Bytes(WORKED_EXAMPLE_V7_TIMESTAMP_MS, WORKED_EXAMPLE_V7_RANDOM);

export const WORKED_EXAMPLE_V4 = formatUuidBytes(workedExampleV4Bytes);
export const WORKED_EXAMPLE_V4_UPPER_PLAIN = formatUuidBytes(workedExampleV4Bytes, {
    uppercase: true,
    hyphens: false
});
export const WORKED_EXAMPLE_V7 = formatUuidBytes(workedExampleV7Bytes);
