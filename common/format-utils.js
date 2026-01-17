/**
 * Format bytes to human readable string
 * @param {number} bytes - The number of bytes to format
 * @returns {string} The formatted string (e.g. "1.50 MB")
 */
export function formatBytes(bytes) {
    if (bytes <= 0) return '0 bytes';
    const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}
