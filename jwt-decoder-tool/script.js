import { JWTDecoder } from './JWTDecoder.js';
import { JsonTreeViewRenderer } from './JsonTreeViewRenderer.js';

class JWTDecoderUI {
    constructor() {
        // Instantiate the renderer within the class
        this.jsonRenderer = new JsonTreeViewRenderer();

        // Cache DOM Elements
        this.elements = {
            jwtInput: document.getElementById('jwtInputToken'),
            secretInput: document.getElementById('jwtSecretKey'),
            copyBtn: document.getElementById('jwt-decoder-copy-btn'),
            clearBtn: document.getElementById('jwt-decoder-clear-btn'),
            decodedOutput: document.getElementById('jwtDecodedOutput'), // Hidden textarea
            statusOutput: document.getElementById('jwtSignatureStatus'),
            headerJsonContainer: document.getElementById('headerJson'),
            payloadJsonContainer: document.getElementById('payloadJson'),
            rawJsonViewerContainer: document.getElementById('rawJsonViewer')
        };

        // Debounce timers
        this.decodeTimeout = null;
        this.verifyTimeout = null;
    }

    // --- Initialization ---
    initialize() {
        if (typeof document === 'undefined') return; // Guard against non-browser environments

        this.setupTabs();
        this.setupEventListeners();
        this.preloadData();
        this.decodeAndRender(true); // Initial decode and verify
        this.initializeTooltips();
    }

    // --- UI Setup ---
    setupTabs() {
        const tabs = document.querySelectorAll('.jwt-decoder-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const tabPanes = document.querySelectorAll('.jwt-decoder-tab-pane');
                tabPanes.forEach(pane => pane.classList.remove('active'));

                const tabId = tab.getAttribute('data-tab');
                const targetPane = document.getElementById(`${tabId}Tab`);
                if (targetPane) {
                    targetPane.classList.add('active');
                }
            });
        });
    }

    setupEventListeners() {
        // Debounced Input Handlers
        this.elements.jwtInput.addEventListener('input', this.debounceDecode.bind(this));
        this.elements.jwtInput.addEventListener('paste', this.debounceDecode.bind(this));
        this.elements.secretInput.addEventListener('input', this.debounceVerify.bind(this));
        this.elements.secretInput.addEventListener('paste', this.debounceVerify.bind(this));

        // Button Click Handlers
        // Removed verifyBtn listener
        this.elements.copyBtn.addEventListener('click', this.copyDecoded.bind(this));
        this.elements.clearBtn.addEventListener('click', this.clearAll.bind(this));
    }

    preloadData() {
        // Preload with sample JWT token and secret (optional)
        this.elements.jwtInput.value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        this.elements.secretInput.value = 'your-256-bit-secret';
    }

    initializeTooltips() {
        this.elements.copyBtn.setAttribute('title', 'Copy decoded token to clipboard');
    }

    // --- Core Logic & Rendering ---
    async decodeAndRender(verifySignature = false) {
        const jwt = this.elements.jwtInput.value.trim();
        const secret = this.elements.secretInput.value.trim();

        if (!jwt) {
            this.clearOutputs();
            this.updateStatusOutput('Please enter a JWT token.', 'default');
        } else {
            try {
                const decoder = new JWTDecoder(jwt);

                if (!decoder.isValidFormat) {
                    throw new Error(decoder.getParsingError() || 'Invalid JWT format');
                }

                const header = decoder.getHeader();
                const payload = decoder.getPayload();

                // Render JSON views
                this.jsonRenderer.render(header, this.elements.headerJsonContainer);
                this.jsonRenderer.render(payload, this.elements.payloadJsonContainer);

                const combinedData = { header, payload };
                this.elements.decodedOutput.value = JSON.stringify(combinedData, null, 2); // Update hidden textarea
                this.jsonRenderer.render(combinedData, this.elements.rawJsonViewerContainer); // Update raw view

                this.switchToRawTab();

                // Determine Verify Status and Update Combined Status Output
                if (verifySignature) {
                    if (!secret) {
                        this.updateStatusOutput('Decoded successfully. Secret key required for verification.', 'warning');
                    } else {
                        const isValid = await decoder.verifySignature(secret);
                        this.updateStatusOutput(
                            isValid ? '✓ Decoded successfully. Signature is valid.' : '✗ Decoded successfully. Signature is invalid.',
                            isValid ? 'success' : 'error'
                        );
                    }
                } else {
                    // Use 'warning' style for partially validated state
                    this.updateStatusOutput('Decoded successfully. Signature not verified.', 'warning');
                }

            } catch (e) {
                this.handleProcessingError(e);
            }
        }
    }

    // --- UI Update Helpers ---
    // Removed updateButtonStates, updateDecodeButtonState, updateVerifyButtonState

    updateStatusOutput(message, type = 'default') { // type: 'default', 'success', 'error', 'warning'
        const output = this.elements.statusOutput;
        output.textContent = message;
        output.className = 'jwt-decoder-status'; // Reset classes
        switch (type) {
            case 'success':
                output.classList.add('status-success');
                break;
            case 'error':
                output.classList.add('status-error');
                break;
            case 'warning':
                output.classList.add('status-warning');
                break;
            case 'default':
            default:
                output.classList.add('status-default');
                break;
        }
    }

    clearOutputs() {
        this.elements.decodedOutput.value = '';
        this.elements.headerJsonContainer.innerHTML = '';
        this.elements.payloadJsonContainer.innerHTML = '';
        this.elements.rawJsonViewerContainer.innerHTML = '';
        // Status is updated in decodeAndRender or clearAll
    }

    switchToRawTab() {
        const rawTab = document.querySelector('.jwt-decoder-tab[data-tab="raw"]');
        if (rawTab) rawTab.click();
    }

    handleProcessingError(e) {
        this.elements.decodedOutput.value = `Error: ${e.message}`;
        this.elements.headerJsonContainer.innerHTML = '';
        this.elements.payloadJsonContainer.innerHTML = '';
        this.elements.rawJsonViewerContainer.innerHTML = '';
        this.updateStatusOutput(`Error: ${e.message}`, 'error');
        console.error('JWT Processing Error:', e);
    }

    // --- Event Handlers ---
    debounceDecode() {
        clearTimeout(this.decodeTimeout);
        const token = this.elements.jwtInput.value.trim();

        if (!token) {
            this.clearAll(); // Reset immediately if token is cleared
            return;
        }
        // Auto-decode after a short delay. Trigger verification if a secret is present.
        this.decodeTimeout = setTimeout(() => {
            const shouldVerify = !!this.elements.secretInput.value.trim();
            this.decodeAndRender(shouldVerify);
        }, 300);
    }

    debounceVerify() {
        clearTimeout(this.verifyTimeout);
        // Auto-verify after a short delay if secret is present
        const secret = this.elements.secretInput.value.trim();
        if (secret) {
            this.verifyTimeout = setTimeout(() => this.decodeAndRender(true), 300); // Trigger verification
        } else {
             // If secret is removed, update status to reflect only decode status (which will now be warning)
             this.decodeAndRender(false);
        }
    }

    async copyDecoded() {
        const decodedContent = this.elements.decodedOutput.value;
        const copyBtn = this.elements.copyBtn;

        if (!decodedContent || decodedContent.startsWith('Error:')) {
            copyBtn.setAttribute('title', !decodedContent ? 'No content to copy' : 'Cannot copy error content');
            return;
        }

        try {
            await navigator.clipboard.writeText(decodedContent);
            copyBtn.textContent = 'Copied!';
            copyBtn.style.backgroundColor = 'rgb(40, 167, 69)';

            setTimeout(() => {
                copyBtn.textContent = 'Copy Decoded';
                copyBtn.style.backgroundColor = '';
                copyBtn.setAttribute('title', 'Copy decoded token to clipboard'); // Reset title
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            copyBtn.setAttribute('title', 'Failed to copy to clipboard');
        }
    }

    clearAll() {
        this.elements.jwtInput.value = '';
        this.elements.secretInput.value = '';
        this.clearOutputs();
        this.switchToRawTab();
        this.updateStatusOutput('Cleared. Enter a JWT token.', 'default');
    }
}

// Initialize the UI when the DOM is loaded
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const jwtDecoderApp = new JWTDecoderUI();
        jwtDecoderApp.initialize();
    });
}
