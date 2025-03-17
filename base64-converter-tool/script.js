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
                    if (codec.isBase64(input)) {
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
                    result = codec.decodeText(input, encoding);
                    action = 'Decoded';
                }

                this.elements.result.textContent = result;
                this.elements.status.textContent = `✓ ${action} using ${encoding}`;
                this.elements.copyButton.disabled = false;
            } catch (error) {
                console.error('Processing error:', error);
                this.elements.result.textContent = 'Error processing input';
                this.elements.status.textContent = '⚠ Invalid input or encoding combination';
                this.elements.copyButton.disabled = true;
            }
        },

        async handleFileUpload(e) {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                this.elements.input.value = text;
                this.processInput();
            } catch (error) {
                this.elements.status.textContent = '⚠ Error reading file';
            }
        },

        async handleCopy() {
            try {
                await navigator.clipboard.writeText(this.elements.result.textContent);
                this.elements.copyStatus.textContent = 'Copied!';
                setTimeout(() => {
                    this.elements.copyStatus.textContent = '';
                }, 2000);
            } catch (error) {
                this.elements.copyStatus.textContent = 'Copy failed';
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
