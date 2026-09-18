import { formatBytes } from './format-utils';

describe('formatBytes', () => {
    test('should format bytes to appropriate units', () => {
        expect(formatBytes(0)).toBe('0 bytes');
        expect(formatBytes(1024)).toBe('1.00 KB');
        expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    });

    test('should format very large byte sizes', () => {
        expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
        expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.00 TB');
        // Current implementation stops at TB
        expect(formatBytes(1024 * 1024 * 1024 * 1024 * 1024)).toBe('1024.00 TB');
    });

    test('should handle negative byte sizes', () => {
        // Negative values should return 0 bytes according to current implementation
        expect(formatBytes(-1024)).toBe('0 bytes');
    });
});
