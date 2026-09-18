/**
 * DownloadManager class provides functionality for managing file downloads in the browser.
 * It handles creating downloadable blobs and triggering downloads.
 */
type DownloadContent = string | ArrayBuffer | Blob;

class DownloadManager {
  /**
   * Downloads content as a file.
   * @param {string|ArrayBuffer|Blob} content - The content to download.
   * @param {string} filename - The name of the file to download.
   * @param {string} [mimeType='text/plain'] - The MIME type of the file.
   */
  downloadFile(content: DownloadContent, filename: string, mimeType = 'text/plain'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 10000); // Revoke after 10 seconds
  }
}

export default DownloadManager;
