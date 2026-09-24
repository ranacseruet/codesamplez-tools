import { formatBytes } from './format-utils';

describe('formatBytes', () => {
    test('formats bytes, KiB, and MB, dropping the decimal on whole values', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(2048)).toBe('2 KiB');
        expect(formatBytes(1536)).toBe('1.5 KiB');
        expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
        expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
    });

    test('formats very large byte sizes and stops at TB', () => {
        expect(formatBytes(1024 ** 3)).toBe('1 GB');
        expect(formatBytes(1024 ** 4)).toBe('1 TB');
        expect(formatBytes(1024 ** 5)).toBe('1024 TB');
    });

    test('renders unmeasurable sizes as unknown instead of NaN/Infinity text', () => {
        expect(formatBytes(Number.NaN)).toBe('unknown size');
        expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('unknown size');
        expect(formatBytes(-1024)).toBe('unknown size');
    });
});
