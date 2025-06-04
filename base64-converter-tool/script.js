// Import dependencies
const Base64Codec = require('./Base64Codec.js');

// Initialize converter
const initConverter = () => {
    // Create Base64Codec instance
    const codec = new Base64Codec();
    
    return {
        elements: {},

        processInput() {
            const input = this.elements.input.value.trim();
            const mode = this.elements.mode.value;
            const encoding = this.elements.encoding.value;

            if (!input) {
                this.elements.result.textContent = '';
                this.elements.status.textContent = '';
                this.elements.copyButton.disabled = true;
                return;
            }

            try {
                let result;
                let action;

                if (mode === 'auto') {
                    // In auto mode, first validate if it's a valid base64 string
                    const isBase64Input = codec.isBase64(input);
                    if (isBase64Input) {
                        result = codec.decodeText(input, encoding);
                        action = 'Decoded';
                    } else {
                        result = codec.encodeText(input, encoding);
                        action = 'Encoded';
                    }
                } else if (mode === 'encode') {
                    result = codec.encodeText(input, encoding);
                    action = 'Encoded';
                } else {
                    // In decode mode, explicitly validate base64 input
                    if (!codec.isBase64(input)) {
                        throw new Error('Invalid base64 input string');
                    }
                    result = codec.decodeText(input, encoding);
                    action = 'Decoded';
                }

                this.elements.result.textContent = result;
                this.elements.status.textContent = `✓ ${action} using ${encoding}`;
                this.elements.status.className = 'success';
                this.elements.copyButton.disabled = false;
            } catch (error) {
                console.error('Processing error:', error);
                this.elements.result.textContent = '';
                
                // Provide more specific error messages
                let errorMessage = '⚠ ';
                if (error.message.includes('base64')) {
                    errorMessage += 'Invalid base64 input - Please check your input string';
                } else if (error.message.includes('UCS-2')) {
                    errorMessage += 'Invalid UCS-2 sequence - The input may be corrupted';
                } else if (error.message.includes('empty')) {
                    errorMessage += 'Input cannot be empty';
                } else if (error.message.includes('undefined')) {
                    errorMessage += 'Invalid input format';
                } else {
                    errorMessage += `Error: ${error.message}`;
                }
                
                this.elements.status.textContent = errorMessage;
                this.elements.status.className = 'error';
                this.elements.copyButton.disabled = true;
            }
        },

        async handleFileUpload(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = () => {
                try {
                    const dataUrl = reader.result;
                    const commaIndex = dataUrl.indexOf(',');

                    if (commaIndex === -1) {
                        throw new Error('Invalid Data URL format: missing comma.');
                    }
                    
                    const base64String = dataUrl.substring(commaIndex + 1);

                    if (!base64String) { // Handles cases like "data:,"
                        throw new Error('Invalid Data URL format: empty Base64 content.');
                    }

                    this.elements.result.textContent = base64String;
                    this.elements.input.value = `[File: ${file.name} uploaded and encoded to output]`; // Or clear it: this.elements.input.value = '';
                    this.elements.status.textContent = `✓ Encoded file: ${file.name}`;
                    this.elements.status.className = 'success';
                    this.elements.copyButton.disabled = false;
                } catch (error) {
                    console.error('File processing error after read:', error);
                    this.elements.result.textContent = '';
                    this.elements.input.value = '';
                    this.elements.status.textContent = '⚠ Error processing file: ' + error.message;
                    this.elements.status.className = 'error';
                    this.elements.copyButton.disabled = true;
                } finally {
                    // Reset file input to allow uploading the same file again
                    e.target.value = null;
                }
            };

            reader.onerror = () => {
                console.error('File reading error:', reader.error);
                this.elements.result.textContent = '';
                this.elements.input.value = '';
                this.elements.status.textContent = '⚠ Error reading file: ' + reader.error.message;
                this.elements.status.className = 'error';
                this.elements.copyButton.disabled = true;
                // Reset file input
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
            clearButton: document.getElementById('base64converter-clear')
        };

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
        });

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
