// Import dependencies
const Base64Codec = require('./Base64Codec.js');

// Initialize converter
const initConverter = () => {
    // Create Base64Codec instance
    const codec = new Base64Codec();
    
    return {
        elements: {},
        currentMimeType: null, // To store MIME type from Data URL

        processInput() {
            const rawInput = this.elements.input.value.trim();
            
            // If the input is the file upload placeholder, do not process it as text for encoding/decoding.
            // The result and status should already be set by handleFileUpload.
            if (rawInput.startsWith('[File:') && rawInput.endsWith('uploaded and encoded to output]')) {
                this.elements.copyButton.disabled = false;
                this.elements.downloadDecodedButton.disabled = false;
                return; 
            }

            this.currentMimeType = null; // Reset MIME type, will be set if Data URI
            this.elements.downloadDecodedButton.disabled = true;
            this.elements.copyButton.disabled = true;

            if (!rawInput) {
                this.elements.result.textContent = '';
                this.elements.status.textContent = '';
                return;
            }

            let base64Payload = rawInput;
            let detectedMimeType = null; // MIME type from Data URI, if present

            if (rawInput.startsWith('data:')) {
                const parts = rawInput.match(/^data:([a-zA-Z0-9/\-+.-\w]+)?(?:;charset=([a-zA-Z0-9/\-+.-\w]+))?;base64,(.*)$/);
                if (parts && typeof parts[3] === 'string') { // parts[3] is the payload
                    detectedMimeType = parts[1] || null; // e.g., 'image/png', 'text/plain'
                    base64Payload = parts[3].trim(); // Trim the extracted base64 payload
                    this.currentMimeType = detectedMimeType; // Persist for download
                } else {
                    this.elements.result.textContent = '';
                    this.elements.status.textContent = '⚠ Invalid Data URI format.';
                    this.elements.status.className = 'error';
                    return;
                }
            }
            
            const mode = this.elements.mode.value;
            let encoding = this.elements.encoding.value; // For text decoding

            // Map UI encoding names to Base64Codec expected names
            if (encoding === 'UTF-8') {
                encoding = 'utf8';
            } else if (encoding === 'UTF-16') {
                encoding = 'ucs2';
            }
            // Add other mappings if necessary (e.g., 'ASCII' to 'ascii', 'ISO-8859-1' to 'iso88591')

            try {
                let resultText;
                let statusActionMessage;

                if (mode === 'encode') {
                    statusActionMessage = 'Encoded';
                    resultText = codec.encodeText(rawInput, encoding);
                } else { // mode is 'decode' or 'auto'
                    const isPayloadBase64 = codec.isBase64(base64Payload);

                    if (mode === 'auto') {
                        if (isPayloadBase64) {
                            statusActionMessage = 'Decoded';
                            // If it's a Data URI for a known binary type, show placeholder.
                            if (detectedMimeType && 
                                !detectedMimeType.startsWith('text/') && 
                                detectedMimeType !== 'application/json' && 
                                detectedMimeType !== 'application/xml' && 
                                !detectedMimeType.startsWith('application/javascript')) {
                                resultText = `[Binary content (${detectedMimeType}). Use Download button.]`;
                                this.elements.downloadDecodedButton.disabled = false;
                            } else {
                                // It's a text Data URI, or raw Base64. Attempt text decode.
                                try {
                                    resultText = codec.decodeText(base64Payload, encoding);
                                    // Check if the decoded text is likely binary (e.g., contains null chars often indicative of binary)
                                    // A simple check for null character, as it's a strong indicator for non-text data.
                                    if (resultText.includes('\u0000')) { 
                                        resultText = `[Decoded content (likely binary, not ${encoding} text). Use Download button.]`;
                                    }
                                    this.elements.downloadDecodedButton.disabled = false;
                                } catch (decodeError) {
                                    // If text decoding fails, assume it's binary or corrupted text.
                                    // Check for common error messages or error types indicative of decoding failure.
                                    const msg = decodeError.message ? decodeError.message.toLowerCase() : "";
                                    if (msg.includes('utf-8') || msg.includes('ucs-2') || 
                                        msg.includes('malformed') || msg.includes('invalid sequence') || 
                                        msg.includes('data was not valid') || msg.includes('valid utf') || /* for TextDecoder polyfill */
                                        decodeError instanceof TypeError) { // TextDecoder often throws TypeError
                                        resultText = `[Decoded content (likely binary, not ${encoding} text). Use Download button.]`;
                                        this.elements.downloadDecodedButton.disabled = false;
                                    } else {
                                        throw decodeError; // Re-throw other errors
                                    }
                                }
                            }
                        } else {
                            statusActionMessage = 'Encoded';
                            resultText = codec.encodeText(rawInput, encoding);
                        }
                    } else { // mode === 'decode'
                        statusActionMessage = 'Decoded';
                        if (!isPayloadBase64) {
                            throw new Error('Invalid base64 input string');
                        }
                        // Always attempt text decode in explicit decode mode
                        resultText = codec.decodeText(base64Payload, encoding);
                        this.elements.downloadDecodedButton.disabled = false;
                    }
                }

                this.elements.result.textContent = resultText;
                if (statusActionMessage === 'Decoded' && detectedMimeType && !detectedMimeType.startsWith('text/')) {
                    this.elements.status.textContent = `✓ ${statusActionMessage}. MIME: ${detectedMimeType}. Selected encoding (${this.elements.encoding.value}) ignored for binary display.`;
                } else if (statusActionMessage === 'Decoded' && !detectedMimeType && (resultText.startsWith('[Decoded content (likely binary') || resultText.startsWith('[Binary content'))) {
                    this.elements.status.textContent = `✓ ${statusActionMessage}. Selected encoding (${this.elements.encoding.value}) failed for display. Use Download.`;
                }
                else {
                    this.elements.status.textContent = `✓ ${statusActionMessage} using ${this.elements.encoding.value}`;
                }
                this.elements.status.className = 'success';
                this.elements.copyButton.disabled = false; // Always enable copy if there's a result
                this.elements.downloadDecodedButton.disabled = false; // Always enable download if there's a result

            } catch (error) {
                console.error('Processing error:', error);
                this.elements.result.textContent = '';
                let errorMessage = '⚠ ';
                if (error.message.includes('Invalid base64 input string')) {
                    errorMessage += 'Invalid base64 input';
                } else if (error.message.includes('Invalid Data URI format')) {
                    errorMessage += 'Invalid Data URI format.';
                } else if (error.message.includes('UCS-2')) {
                    errorMessage += 'Invalid UCS-2 sequence - Input may be corrupted or not UCS-2 text.';
                } else if (error.message.includes('UTF-8')) {
                    errorMessage += 'Invalid UTF-8 sequence - Input may be corrupted or not UTF-8 text. Try a different encoding, or Download if binary.';
                } else if (error.message.includes('empty')) {
                    errorMessage += 'Input cannot be empty.';
                } else {
                    errorMessage += `Processing failed: ${error.message}`;
                }
                this.elements.status.textContent = errorMessage;
                this.elements.status.className = 'error';
                this.elements.downloadDecodedButton.disabled = true;
                this.elements.copyButton.disabled = true; // Disable copy on error
            }
        },

        detectMimeTypeFromBinary(bytes) {
            // File signature detection for common formats
            const signatures = [
                // Images
                { signature: [0xFF, 0xD8, 0xFF], mimeType: 'image/jpeg', offset: 0 },
                { 
                    signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 
                    mimeType: 'image/png', 
                    offset: 0
                },
                { signature: [0x47, 0x49, 0x46, 0x38], mimeType: 'image/gif', offset: 0 },
                { signature: [0x52, 0x49, 0x46, 0x46], mimeType: 'image/webp', offset: 0, additionalCheck: (bytes) => bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 },
                { signature: [0x42, 0x4D], mimeType: 'image/bmp', offset: 0 },
                { signature: [0x49, 0x49, 0x2A, 0x00], mimeType: 'image/tiff', offset: 0 },
                { signature: [0x4D, 0x4D, 0x00, 0x2A], mimeType: 'image/tiff', offset: 0 },
                
                // Documents
                { signature: [0x25, 0x50, 0x44, 0x46], mimeType: 'application/pdf', offset: 0 },
                { signature: [0x50, 0x4B, 0x03, 0x04], mimeType: 'application/zip', offset: 0 },
                { signature: [0x50, 0x4B, 0x05, 0x06], mimeType: 'application/zip', offset: 0 },
                { signature: [0x50, 0x4B, 0x07, 0x08], mimeType: 'application/zip', offset: 0 },
                
                // Office documents (also ZIP-based)
                { signature: [0x50, 0x4B, 0x03, 0x04], mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', offset: 0, 
                  additionalCheck: (bytes) => {
                      const str = String.fromCharCode(...bytes.slice(30, 100));
                      return str.includes('word/');
                  }
                },
                { signature: [0x50, 0x4B, 0x03, 0x04], mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', offset: 0,
                  additionalCheck: (bytes) => {
                      const str = String.fromCharCode(...bytes.slice(30, 100));
                      return str.includes('xl/');
                  }
                },
                { signature: [0x50, 0x4B, 0x03, 0x04], mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', offset: 0,
                  additionalCheck: (bytes) => {
                      const str = String.fromCharCode(...bytes.slice(30, 100));
                      return str.includes('ppt/');
                  }
                },
                
                // Audio
                { signature: [0xFF, 0xFB], mimeType: 'audio/mpeg', offset: 0 },
                { signature: [0xFF, 0xF3], mimeType: 'audio/mpeg', offset: 0 },
                { signature: [0xFF, 0xF2], mimeType: 'audio/mpeg', offset: 0 },
                { signature: [0x49, 0x44, 0x33], mimeType: 'audio/mpeg', offset: 0 },
                { signature: [0x52, 0x49, 0x46, 0x46], mimeType: 'audio/wav', offset: 0, additionalCheck: (bytes) => bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45 },
                { signature: [0x4F, 0x67, 0x67, 0x53], mimeType: 'audio/ogg', offset: 0 },
                { signature: [0x66, 0x4C, 0x61, 0x43], mimeType: 'audio/flac', offset: 0 },
                
                // Video
                { signature: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], mimeType: 'video/mp4', offset: 0 },
                { signature: [0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70], mimeType: 'video/mp4', offset: 0 },
                { signature: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], mimeType: 'video/mp4', offset: 0 },
                { signature: [0x1A, 0x45, 0xDF, 0xA3], mimeType: 'video/webm', offset: 0 },
                { signature: [0x46, 0x4C, 0x56, 0x01], mimeType: 'video/x-flv', offset: 0 },
                
                // Archives
                { signature: [0x1F, 0x8B, 0x08], mimeType: 'application/gzip', offset: 0 },
                { signature: [0x42, 0x5A, 0x68], mimeType: 'application/x-bzip2', offset: 0 },
                { signature: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], mimeType: 'application/x-7z-compressed', offset: 0 },
                { signature: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00], mimeType: 'application/x-rar-compressed', offset: 0 },
                
                // Executables
                { signature: [0x4D, 0x5A], mimeType: 'application/x-msdownload', offset: 0 },
                { signature: [0x7F, 0x45, 0x4C, 0x46], mimeType: 'application/x-executable', offset: 0 },
                
                // Fonts
                { signature: [0x00, 0x01, 0x00, 0x00], mimeType: 'font/ttf', offset: 0 },
                { signature: [0x4F, 0x54, 0x54, 0x4F], mimeType: 'font/otf', offset: 0 },
                { signature: [0x77, 0x4F, 0x46, 0x46], mimeType: 'font/woff', offset: 0 },
                { signature: [0x77, 0x4F, 0x46, 0x32], mimeType: 'font/woff2', offset: 0 },
            ];

            for (const sig of signatures) {
                if (bytes.length >= sig.signature.length + sig.offset) {
                    let matches = true;
                    for (let i = 0; i < sig.signature.length; i++) {
                        if (bytes[sig.offset + i] !== sig.signature[i]) {
                            matches = false;
                            break;
                        }
                    }
                    if (matches && (!sig.additionalCheck || sig.additionalCheck(bytes))) {
                        return sig.mimeType;
                    }
                }
            }

            // Handle empty input
            if (bytes.length === 0) {
                return 'application/octet-stream';
            }

            // Check for text content - adjusted validation
            const textSample = bytes.slice(0, Math.min(1024, bytes.length));
            let isText = true;
            let hasNonAscii = false;
            let printableCount = 0;
            
            for (let i = 0; i < textSample.length; i++) {
                const byte = textSample[i];
                // Null byte means definitely not text
                if (byte === 0) {
                    isText = false;
                    break;
                }
                // Track non-ASCII bytes
                if (byte > 127) {
                    hasNonAscii = true;
                }
                // Control characters (except whitespace)
                if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
                    isText = false;
                    break;
                }
                // Count printable ASCII characters
                if (byte >= 32 && byte <= 126) {
                    printableCount++;
                }
            }
            
            // Adjust thresholds based on content
            if (isText) {
                // For UTF-8 text with non-ASCII, be more lenient (50% printable)
                if (hasNonAscii && (printableCount / textSample.length) < 0.5) {
                    isText = false;
                } 
                // For ASCII text, maintain higher standard (70% printable)
                else if (!hasNonAscii && (printableCount / textSample.length) < 0.7) {
                    isText = false;
                }
            }

            // Additional UTF-8 validation for text with non-ASCII
            if (isText && hasNonAscii) {
                try {
                    const decoder = new TextDecoder('utf-8', { fatal: true });
                    decoder.decode(new Uint8Array(textSample));
                } catch (e) {
                    isText = false;
                }
            }

            if (isText) {
                const textContent = String.fromCharCode(...textSample);
                
                // Check for specific text formats
                if (textContent.trim().startsWith('<!DOCTYPE html') || textContent.trim().startsWith('<html')) {
                    return 'text/html';
                }
                if (textContent.trim().startsWith('<?xml')) {
                    return 'application/xml';
                }
                if (textContent.trim().startsWith('<svg')) {
                    return 'image/svg+xml';
                }
                
                // Try to parse as JSON
                try {
                    JSON.parse(textContent);
                    return 'application/json';
                } catch (e) {
                    // Not JSON
                }
                
                // Check for CSS
                if (textContent.includes('{') && textContent.includes('}') && 
                    (textContent.includes(':') || textContent.includes('@'))) {
                    return 'text/css';
                }
                
                // Check for JavaScript
                if (textContent.includes('function') || textContent.includes('=>') || 
                    textContent.includes('var ') || textContent.includes('let ') || 
                    textContent.includes('const ') || textContent.includes('console.')) {
                    return 'text/javascript';
                }
                
                return hasNonAscii ? 'text/plain; charset=utf-8' : 'text/plain';
            }

            return 'application/octet-stream';
        },

        getFileExtensionFromMimeType(mimeType) {
            const extensionMap = {
                // Images
                'image/jpeg': 'jpg',
                'image/jpg': 'jpg',
                'image/png': 'png',
                'image/gif': 'gif',
                'image/svg+xml': 'svg',
                'image/webp': 'webp',
                'image/bmp': 'bmp',
                'image/tiff': 'tiff',
                'image/tif': 'tif',
                'image/ico': 'ico',
                'image/icon': 'ico',
                'image/x-icon': 'ico',
                
                // Documents
                'application/pdf': 'pdf',
                'application/msword': 'doc',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                'application/vnd.ms-excel': 'xls',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
                'application/vnd.ms-powerpoint': 'ppt',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
                'application/rtf': 'rtf',
                
                // Text
                'text/plain': 'txt',
                'text/html': 'html',
                'text/css': 'css',
                'text/javascript': 'js',
                'text/csv': 'csv',
                'text/xml': 'xml',
                'text/markdown': 'md',
                'text/x-markdown': 'md',
                
                // Data
                'application/json': 'json',
                'application/xml': 'xml',
                'application/yaml': 'yml',
                'application/x-yaml': 'yml',
                'text/yaml': 'yml',
                'text/x-yaml': 'yml',
                
                // Archives
                'application/zip': 'zip',
                'application/x-zip-compressed': 'zip',
                'application/gzip': 'gz',
                'application/x-gzip': 'gz',
                'application/x-tar': 'tar',
                'application/x-bzip2': 'bz2',
                'application/x-7z-compressed': '7z',
                'application/x-rar-compressed': 'rar',
                
                // Audio
                'audio/mpeg': 'mp3',
                'audio/mp3': 'mp3',
                'audio/wav': 'wav',
                'audio/wave': 'wav',
                'audio/x-wav': 'wav',
                'audio/ogg': 'ogg',
                'audio/flac': 'flac',
                'audio/aac': 'aac',
                'audio/mp4': 'm4a',
                'audio/x-m4a': 'm4a',
                'audio/webm': 'webm',
                
                // Video
                'video/mp4': 'mp4',
                'video/mpeg': 'mpg',
                'video/quicktime': 'mov',
                'video/x-msvideo': 'avi',
                'video/webm': 'webm',
                'video/x-flv': 'flv',
                'video/3gpp': '3gp',
                'video/x-ms-wmv': 'wmv',
                
                // Fonts
                'font/ttf': 'ttf',
                'font/otf': 'otf',
                'font/woff': 'woff',
                'font/woff2': 'woff2',
                'application/font-woff': 'woff',
                'application/font-woff2': 'woff2',
                'application/x-font-ttf': 'ttf',
                'application/x-font-otf': 'otf',
                
                // Executables
                'application/x-msdownload': 'exe',
                'application/x-executable': 'bin',
                'application/x-mach-binary': 'bin',
                
                // Default
                'application/octet-stream': 'dat'
            };

            // Direct lookup
            if (extensionMap[mimeType]) {
                return extensionMap[mimeType];
            }

            // Handle null/undefined mimeType
            if (!mimeType) {
                return 'dat';
            }

            // Handle charset specifications
            const baseType = mimeType.split(';')[0].trim();
            if (extensionMap[baseType]) {
                return extensionMap[baseType];
            }

            // Fallback: return 'dat' for unknown types
            return 'dat';
        },

        async handleDownload() {
            const outputContent = this.elements.result.textContent.trim();
            const rawInputValue = this.elements.input.value.trim();

            if (!outputContent) {
                this.elements.status.textContent = '⚠ No content to download.';
                this.elements.status.className = 'error';
                return;
            }

            // Check if output is a binary placeholder - if so, download from input Base64
            if (outputContent.startsWith('[Binary content') || outputContent.startsWith('[Decoded content (likely binary')) {
                return this.handleBinaryDownload(rawInputValue);
            }

            // For regular text content, download as text file
            return this.handleTextDownload(outputContent);
        },

        async handleBinaryDownload(rawInputValue) {
            let actualBase64Payload;
            let actualMimeType = this.currentMimeType; // Start with MIME type determined by processInput

            if (rawInputValue.startsWith('data:')) {
                const parts = rawInputValue.match(/^data:([a-zA-Z0-9/\-+.-\w]+)?(?:;charset=([a-zA-Z0-9/\-+.-\w]+))?;base64,(.*)$/);
                if (parts && typeof parts[3] === 'string') {
                    actualBase64Payload = parts[3].trim(); // Trim Data URI payload
                    // Prioritize MIME from Data URI for download, ensuring it's consistent
                    actualMimeType = parts[1] || 'application/octet-stream'; 
                } else {
                    this.elements.status.textContent = '⚠ Invalid Data URI format for download.';
                    this.elements.status.className = 'error';
                    return;
                }
            } else {
                actualBase64Payload = rawInputValue.trim(); // Trim raw input payload
                // If no MIME type is available, try to detect it from the binary content
                if (!actualMimeType) {
                    try {
                        const binaryString = atob(actualBase64Payload);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        actualMimeType = this.detectMimeTypeFromBinary(bytes);
                    } catch (e) {
                        actualMimeType = 'application/octet-stream';
                    }
                }
            }

            if (!codec.isBase64(actualBase64Payload)) {
                this.elements.status.textContent = '⚠ Input is not valid Base64 for download.';
                this.elements.status.className = 'error';
                return;
            }

            // Generate filename with proper extension
            const extension = this.getFileExtensionFromMimeType(actualMimeType);
            const filename = `decoded_file.${extension}`;

            try {
                // Standard binary data reconstruction from Base64
                const binaryString = atob(actualBase64Payload);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                const blob = new Blob([bytes], { type: actualMimeType });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                this.elements.status.textContent = `✓ File downloaded as "${filename}" (MIME: ${actualMimeType})`;
                this.elements.status.className = 'success';

            } catch (error) {
                console.error('Download error:', error);
                this.elements.status.textContent = '⚠ Error downloading file: ' + error.message;
                this.elements.status.className = 'error';
            }
        },

        async handleTextDownload(textContent) {
            try {
                // Determine appropriate MIME type and extension for text content
                let mimeType = 'text/plain';
                let extension = 'txt';
                let filename = 'output.txt';

                // Try to detect specific text formats
                const trimmedContent = textContent.trim();
                
                if (trimmedContent.startsWith('<!DOCTYPE html') || trimmedContent.startsWith('<html')) {
                    mimeType = 'text/html';
                    extension = 'html';
                    filename = 'output.html';
                } else if (trimmedContent.startsWith('<?xml') || trimmedContent.startsWith('<')) {
                    mimeType = 'application/xml';
                    extension = 'xml';
                    filename = 'output.xml';
                } else if (trimmedContent.startsWith('<svg')) {
                    mimeType = 'image/svg+xml';
                    extension = 'svg';
                    filename = 'output.svg';
                } else {
                    // Try to parse as JSON
                    try {
                        JSON.parse(trimmedContent);
                        mimeType = 'application/json';
                        extension = 'json';
                        filename = 'output.json';
                    } catch (e) {
                        // Check for CSS
                        if (trimmedContent.includes('{') && trimmedContent.includes('}') && 
                            (trimmedContent.includes(':') || trimmedContent.includes('@'))) {
                            mimeType = 'text/css';
                            extension = 'css';
                            filename = 'output.css';
                        }
                        // Check for JavaScript
                        else if (trimmedContent.includes('function') || trimmedContent.includes('=>') || 
                                trimmedContent.includes('var ') || trimmedContent.includes('let ') || 
                                trimmedContent.includes('const ') || trimmedContent.includes('console.')) {
                            mimeType = 'text/javascript';
                            extension = 'js';
                            filename = 'output.js';
                        }
                        // Check if it looks like Base64 (for encoded content)
                        else if (codec.isBase64(trimmedContent)) {
                            filename = 'encoded_output.txt';
                        }
                    }
                }

                const blob = new Blob([textContent], { type: mimeType });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                this.elements.status.textContent = `✓ Content downloaded as "${filename}"`;
                this.elements.status.className = 'success';

            } catch (error) {
                console.error('Download error:', error);
                this.elements.status.textContent = '⚠ Error downloading content: ' + error.message;
                this.elements.status.className = 'error';
            }
        },

        async handleFileUpload(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = () => {
                try {
                    const dataUrl = reader.result; // Full Data URI
                    let base64String;
                    let mimeType;

                    if (dataUrl.startsWith('data:')) {
                        const parts = dataUrl.match(/^data:([a-zA-Z0-9/\-+.-\w]+)?(?:;charset=([a-zA-Z0-9/\-+.-\w]+))?;base64,(.*)$/);
                        if (parts && typeof parts[3] === 'string') {
                            mimeType = parts[1] || 'application/octet-stream';
                            base64String = parts[3].trim(); // Trim Data URI payload
                        } else {
                            throw new Error('Invalid Data URI format');
                        }
                    } else {
                        // If it's not a data URL, assume it's raw base64 (though file upload usually gives data URLs)
                        base64String = dataUrl.trim(); // Trim raw dataUrl if not a Data URI
                        mimeType = 'application/octet-stream'; // Default for raw content
                    }

                    // Set input to a placeholder, output to the Base64 string
                    this.elements.input.value = `[File: ${file.name} uploaded and encoded to output]`;
                    this.elements.result.textContent = base64String; // Display just the base64 part
                    this.currentMimeType = mimeType; // Store for potential download if user copies to input later

                    this.elements.status.textContent = `✓ Encoded file: ${file.name}`;
                    this.elements.status.className = 'success';
                    this.elements.copyButton.disabled = false;
                    this.elements.downloadDecodedButton.disabled = false; // Enable download for encoded output

                } catch (error) {
                    console.error('File processing error after read:', error);
                    this.elements.result.textContent = ''; // Ensure it's cleared
                    this.elements.input.value = '';
                    this.elements.status.textContent = '⚠ Error processing file: ' + error.message;
                    this.elements.status.className = 'error';
                    this.elements.copyButton.disabled = true;
                    this.elements.downloadDecodedButton.disabled = true;
                } finally {
                    e.target.value = null; // Reset file input
                }
            };

            reader.onerror = () => {
                console.error('File reading error:', reader.error);
                this.elements.result.textContent = '';
                this.elements.input.value = '';
                this.elements.status.textContent = '⚠ Error reading file: ' + reader.error.message;
                this.elements.status.className = 'error';
                this.elements.copyButton.disabled = true;
                this.elements.downloadDecodedButton.disabled = true;
                e.target.value = null;
            };

            reader.readAsDataURL(file);
        },

        async handleCopy() {
            try {
                await navigator.clipboard.writeText(this.elements.result.textContent);
                this.elements.copyStatus.textContent = 'Copied!';
                this.elements.copyStatus.className = 'success';
                setTimeout(() => {
                    this.elements.copyStatus.textContent = '';
                }, 2000);
            } catch (error) {
                console.error('Copy error:', error);
                this.elements.copyStatus.textContent = 'Copy failed: ' + error.message;
                this.elements.copyStatus.className = 'error';
            }
        }
    };
};

// Initialize when DOM is loaded
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const converter = initConverter();

        const elements = {
            input: document.getElementById('base64converter-input'),
            result: document.getElementById('base64converter-result'),
            status: document.getElementById('base64converter-status'),
            copyStatus: document.getElementById('base64converter-copy-status'),
            mode: document.getElementById('base64converter-mode'),
            encoding: document.getElementById('base64converter-encoding'),
            copyButton: document.getElementById('base64converter-copy'),
            fileInput: document.getElementById('base64converter-file'),
            convertButton: document.getElementById('base64converter-convert'),
            clearButton: document.getElementById('base64converter-clear'),
            downloadDecodedButton: document.getElementById('base64converter-download-decoded')
        };
        
        // Check all elements, including new ones
        const requiredElementIds = [
            'base64converter-input', 'base64converter-result', 'base64converter-status',
            'base64converter-copy-status', 'base64converter-mode', 'base64converter-encoding',
            'base64converter-copy', 'base64converter-file', 'base64converter-convert',
            'base64converter-clear', 'base64converter-download-decoded'
        ];

        for (const id of requiredElementIds) {
            if (!elements[id.split('-')[1]]) { // elements keys are shortened e.g. 'input' for 'base64converter-input'
                 if (!document.getElementById(id)) {
                    console.error('Some elements not found');
                    // Optionally, disable the tool or show a user-facing error
                    // For now, just log and potentially return to prevent further errors
                    return;
                 }
            }
        }
        // Re-assign elements to ensure all are captured if some were missed by the initial simple check
        elements.input = document.getElementById('base64converter-input');
        elements.result = document.getElementById('base64converter-result');
        elements.status = document.getElementById('base64converter-status');
        elements.copyStatus = document.getElementById('base64converter-copy-status');
        elements.mode = document.getElementById('base64converter-mode');
        elements.encoding = document.getElementById('base64converter-encoding');
        elements.copyButton = document.getElementById('base64converter-copy');
        elements.fileInput = document.getElementById('base64converter-file');
        elements.convertButton = document.getElementById('base64converter-convert');
        elements.clearButton = document.getElementById('base64converter-clear');
        elements.downloadDecodedButton = document.getElementById('base64converter-download-decoded');


        if (!Object.values(elements).every(el => el)) {
            console.error('Some elements not found');
            return;
        }

        // Set up elements
        converter.elements = elements;

        // Event listeners
        elements.convertButton.addEventListener('click', () => {
            console.log('Convert clicked');
            converter.processInput();
        });

        elements.clearButton.addEventListener('click', () => {
            console.log('Clear clicked');
            elements.input.value = '';
            elements.result.textContent = '';
            elements.status.textContent = '';
            elements.status.className = '';
            elements.copyButton.disabled = true;
            elements.downloadDecodedButton.disabled = true;
        });

        elements.downloadDecodedButton.addEventListener('click', () => converter.handleDownload());
        elements.mode.addEventListener('change', () => converter.processInput());
        elements.encoding.addEventListener('change', () => converter.processInput());
        elements.fileInput.addEventListener('change', (e) => converter.handleFileUpload(e));
        elements.copyButton.addEventListener('click', () => converter.handleCopy());

        // Input handler with debounce
        let debounceTimeout;
        elements.input.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => converter.processInput(), 300);
        });

        // Expose converter globally
        window.Base64Converter = converter;
    });
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = initConverter();
}
