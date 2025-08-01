import { JWTDecoder } from './JWTDecoder.js';
import { JsonTreeViewRenderer } from './JsonTreeViewRenderer.js';
import { NotificationManager } from '../common/notification-manager.js';
import ClearButton from '../common/clear-button/ClearButton.js';

class JWTDecoderUI {
    constructor() {
        // Instantiate the renderer within the class
        this.jsonRenderer = new JsonTreeViewRenderer();

        // Cache DOM Elements
        this.elements = {
            jwtInput: document.getElementById('jwtInputToken'),
            secretInput: document.getElementById('jwtSecretKey'),
            copyBtn: document.getElementById('jwt-decoder-copy-btn'),
            decodedOutput: document.getElementById('jwtDecodedOutput'), // Hidden textarea
            statusOutput: document.getElementById('jwtSignatureStatus'),
            headerJsonContainer: document.getElementById('headerJson'),
            payloadJsonContainer: document.getElementById('payloadJson'),
            rawJsonViewerContainer: document.getElementById('rawJsonViewer')
        };

        // Debounce timers
        this.decodeTimeout = null;
        this.verifyTimeout = null;

        // Clear button component
        this.clearButton = null;
    }

    // --- Initialization ---
    initialize() {
        if (typeof document === 'undefined') return; // Guard against non-browser environments

        this.setupTabs();
        this.setupEventListeners();
        this.preloadData();
        this.decodeAndRender(false, true); // Initial decode only, no signature validation, suppress notification
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
        // Initialize Clear Button component for JWT input
        this.clearButton = new ClearButton(this.elements.jwtInput);

        // Debounced Input Handlers for automatic actions
        this.elements.jwtInput.addEventListener('input', this.debounceDecode.bind(this));
        this.elements.jwtInput.addEventListener('paste', this.debounceDecode.bind(this));
        this.elements.secretInput.addEventListener('input', this.debounceVerify.bind(this));
        this.elements.secretInput.addEventListener('paste', this.debounceVerify.bind(this));

        // Button Click Handlers for manual actions
        this.elements.copyBtn.addEventListener('click', this.copyDecoded.bind(this));
        document.getElementById('jwt-decoder-decode-btn').addEventListener('click', () => this.decodeAndRender(false));
        document.getElementById('jwt-decoder-validate-btn').addEventListener('click', () => this.decodeAndRender(true));
    }

    preloadData() {
        // Preload with sample JWT token and secret (optional)
        this.elements.jwtInput.value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        this.elements.secretInput.value = 'your-256-bit-secret';
        
        // Update clear button visibility after preloading data
        if (this.clearButton) {
            this.clearButton.updateVisibility();
        }
    }

    initializeTooltips() {
        this.elements.copyBtn.setAttribute('title', 'Copy decoded token to clipboard');
        document.getElementById('jwt-decoder-decode-btn').setAttribute('title', 'Decode the JWT token');
        document.getElementById('jwt-decoder-validate-btn').setAttribute('title', 'Decode and validate the JWT signature with the provided secret key');
    }

    // --- Core Logic & Rendering ---
    async decodeAndRender(verifySignature = false, suppressNotification = false) {
        return this.decodeAndRenderWithAutoVerify(verifySignature, false, suppressNotification);
    }

    async decodeAndRenderWithAutoVerify(verifySignature = false, isAuto = false, suppressNotification = false) {
        const jwt = this.elements.jwtInput.value.trim();
        const secret = this.elements.secretInput.value.trim();

        if (!jwt) {
            this.clearOutputs();
            this.updateStatusOutput('Enter a JWT token.', 'default');
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

                // Determine Verify Status and Update Status Output based on action
                if (verifySignature) {
                    if (!secret) {
                        if (isAuto) {
                            this.updateStatusOutput('Decoded successfully. Secret key required for verification.', 'warning', suppressNotification);
                        } else {
                            this.updateStatusOutput('Decoded successfully. Secret key required for signature validation.', 'warning', suppressNotification);
                        }
                    } else {
                        const isValid = await decoder.verifySignature(secret);
                        this.updateStatusOutput(
                            isValid ? '✓ Decoded successfully. Signature is valid.' : '✗ Decoded successfully. Signature is invalid.',
                            isValid ? 'success' : 'error',
                            suppressNotification
                        );
                    }
                } else {
                    // Only show decoding status when not verifying signature, unless it's an auto action
                    if (isAuto) {
                        this.updateStatusOutput('Decoded successfully. Signature not verified.', 'warning', suppressNotification);
                    } else {
                        this.updateStatusOutput('Decoded successfully.', 'success', suppressNotification);
                    }
                }

            } catch (e) {
                this.handleProcessingError(e);
            }
        }
    }

    // --- UI Update Helpers ---
    // Removed updateButtonStates, updateDecodeButtonState, updateVerifyButtonState

    updateStatusOutput(message, type = 'default', suppressNotification = false) { // type: 'default', 'success', 'error', 'warning'
        const output = this.elements.statusOutput;
        output.textContent = message;
        output.className = 'jwt-decoder-status'; // Reset classes
        switch (type) {
            case 'success':
                output.classList.add('status-success');
                if (!suppressNotification) {
                    NotificationManager.show(message, 2000, { type: 'success' });
                }
                break;
            case 'error':
                output.classList.add('status-error');
                if (!suppressNotification) {
                    NotificationManager.show(message, 2000, { type: 'error' });
                }
                break;
            case 'warning':
                output.classList.add('status-warning');
                if (!suppressNotification) {
                    NotificationManager.show(message, 2000, { type: 'warning' });
                }
                break;
            case 'default':
            default:
                output.classList.add('status-default');
                if (!suppressNotification) {
                    NotificationManager.show(message, 2000, { type: 'default' });
                }
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
            this.clearOutputs();
            this.updateStatusOutput('Enter a JWT token.', 'default');
            return;
        }
        // Auto-decode after a short delay, trigger signature validation if secret is present.
        this.decodeTimeout = setTimeout(() => {
            const shouldVerify = !!this.elements.secretInput.value.trim();
            this.decodeAndRenderWithAutoVerify(shouldVerify);
        }, 300);
    }

    debounceVerify() {
        clearTimeout(this.verifyTimeout);
        // Auto-verify on secret input change if secret is present.
        const secret = this.elements.secretInput.value.trim();
        if (secret) {
            this.verifyTimeout = setTimeout(() => this.decodeAndRenderWithAutoVerify(true), 300);
        } else {
            this.verifyTimeout = setTimeout(() => this.decodeAndRenderWithAutoVerify(false), 300);
        }
    }

    async copyDecoded() {
        const decodedContent = this.elements.decodedOutput.value;
        const copyBtn = this.elements.copyBtn;

        if (!decodedContent || decodedContent.startsWith('Error:')) {
            NotificationManager.show(!decodedContent ? 'No content to copy' : 'Cannot copy error content', 2000, { type: 'error' });
            copyBtn.setAttribute('title', !decodedContent ? 'No content to copy' : 'Cannot copy error content');
            return;
        }

        try {
            await navigator.clipboard.writeText(decodedContent);
            NotificationManager.show('Copied to clipboard!', 2000, { type: 'success' });
        } catch (err) {
            console.error('Failed to copy:', err);
            NotificationManager.show('Failed to copy to clipboard', 2000, { type: 'error' });
            copyBtn.setAttribute('title', 'Failed to copy to clipboard');
        }
    }

    clearAll() {
        this.elements.jwtInput.value = '';
        this.elements.secretInput.value = '';
        this.clearOutputs();
        this.switchToRawTab();
        this.updateStatusOutput('Enter a JWT token.', 'default');
        NotificationManager.show('All fields cleared.', 2000, { type: 'success' });
    }
}

// Initialize the UI when the DOM is loaded
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const jwtDecoderApp = new JWTDecoderUI();
        jwtDecoderApp.initialize();
        
        // Expose instance globally for testing
        window.jwtDecoderApp = jwtDecoderApp;
    });
}
