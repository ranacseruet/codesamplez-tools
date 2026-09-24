const BYTE_UNITS: readonly string[] = ['B', 'KiB', 'MB', 'GB', 'TB'];

/**
 * Format a byte count as a compact, human-readable size ("512 B", "1.5 KiB",
 * "5 MB"). Whole values drop the decimal so limits read cleanly in toasts
 * ("limit 5 MB", not "5.0 MB"). Non-finite or negative input — a size that
 * could not be measured — renders as "unknown size" rather than "NaN" text.
 */
export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) {
        return 'unknown size';
    }

    if (bytes < 1024) {
        return `${Math.round(bytes)} B`;
    }

    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    // Round before choosing the final unit and format: 1023.99 KiB must read
    // "1 MB", not "1024.0 KiB", and 1.99 KiB rounds to a whole "2 KiB".
    let rounded = Math.round(value * 10) / 10;
    if (rounded >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
        rounded = Math.round((rounded / 1024) * 10) / 10;
        unitIndex += 1;
    }

    return `${rounded % 1 === 0 ? rounded : rounded.toFixed(1)} ${BYTE_UNITS[unitIndex]}`;
}
