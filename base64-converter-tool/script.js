// Initialize converter namespace to avoid global scope pollution
const Base64Converter = {
    encoder: new TextEncoder(),
    decoder: new TextDecoder(),
    
    elements: {
        input: document.getElementById('base64converter-input'),
        result: document.getElementById('base64converter-result'),
        status: document.getElementById('base64converter-status'),
        copyStatus: document.getElementById('base64converter-copy-status'),
        mode: document.getElementById('base64converter-mode'),
        encoding: document.getElementById('base64converter-encoding'),
        copyButton: document.getElementById('base64converter-copy'),
        fileInput: document.getElementById('base64converter-file')
    },

    isBase64(str) {
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (str.length % 4 !== 0) return false;
        if (!base64Regex.test(str)) return false;
        
        try {
            return btoa(atob(str)) === str;
        } catch (err) {
            return false;
        }
    },

    encodeText(text, encoding) {
        try {
            switch(encoding) {
                case 'ascii':
                    return btoa([...text].map(c => c.charCodeAt(0) < 128 ? c : '?').join(''));
                case 'iso88591':
                    return btoa([...text].map(c => String.fromCharCode(c.charCodeAt(0) & 0xFF)).join(''));
                case 'ucs2':
                    const ucs2Array = new Uint16Array([...text].map(c => c.charCodeAt(0)));
                    return btoa(String.fromCharCode(...new Uint8Array(ucs2Array.buffer)));
                case 'utf8':
                default:
                    return btoa(unescape(encodeURIComponent(text)));
            }
        } catch (error) {
            throw new Error('Encoding failed');
        }
    },

    decodeText(base64Str, encoding) {
        try {
            const decoded = atob(base64Str);
            switch(encoding) {
                case 'ascii':
                    return decoded;
                case 'iso88591':
                    return decoded;
                case 'ucs2':
                    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
                    return String.fromCharCode(...new Uint16Array(bytes.buffer));
                case 'utf8':
                default:
                    return decodeURIComponent(escape(decoded));
            }
        } catch (error) {
            throw new Error('Decoding failed');
        }
    },

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
                if (this.isBase64(input)) {
                    result = this.decodeText(input, encoding);
                    action = 'Decoded';
                } else {
                    result = this.encodeText(input, encoding);
                    action = 'Encoded';
                }
            } else if (mode === 'encode') {
                result = this.encodeText(input, encoding);
                action = 'Encoded';
            } else {
                result = this.decodeText(input, encoding);
                action = 'Decoded';
            }

            this.elements.result.textContent = result;
            this.elements.status.textContent = `✓ ${action} using ${encoding}`;
            this.elements.copyButton.disabled = false;
        } catch (error) {
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
    },

    init() {
        // Bind event handlers
        this.elements.input.addEventListener('input', () => this.processInput());
        this.elements.mode.addEventListener('change', () => this.processInput());
        this.elements.encoding.addEventListener('change', () => this.processInput());
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.elements.copyButton.addEventListener('click', () => this.handleCopy());
    }
};

// Initialize the converter
Base64Converter.init();
