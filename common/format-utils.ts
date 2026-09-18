/**
 * Format bytes to human readable string.
 */
export function formatBytes(bytes: number): string {
    if (bytes <= 0) {
        return '0 bytes';
    }

    const units: readonly string[] = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}
