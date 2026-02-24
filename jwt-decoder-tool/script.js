import { JWTDecoder } from './JWTDecoder.js';
import { JsonTreeViewRenderer } from './JsonTreeViewRenderer.js';
import { NotificationManager } from '../common/notification-manager.js';
import ClearButton from '../common/clear-button/ClearButton.js';
import { hydrate, render } from 'preact';
import { mountToolShell } from '../common/app-shell/mountToolShell.js';

export class JWTDecoderUI {
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
        const tabList = document.querySelector('.jwt-decoder-tabs');

        // Handle Click Events
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.activateTab(tab);
            });
        });

        // Handle Keyboard Navigation
        if (tabList) {
            tabList.addEventListener('keydown', (e) => {
                const key = e.key;
                const direction = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;

                if (direction !== 0) {
                    e.preventDefault();
                    const currentTab = document.activeElement;
                    const index = Array.from(tabs).indexOf(currentTab);
                    if (index !== -1) {
                        const newIndex = (index + direction + tabs.length) % tabs.length;
                        const newTab = tabs[newIndex];
                        newTab.focus();
                        this.activateTab(newTab);
                    }
                }
            });
        }
    }

    activateTab(tab) {
        const tabs = document.querySelectorAll('.jwt-decoder-tab');

        tabs.forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
            t.setAttribute('tabindex', '-1');
        });

        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        tab.setAttribute('tabindex', '0');

        const tabPanes = document.querySelectorAll('.jwt-decoder-tab-pane');
        tabPanes.forEach(pane => pane.classList.remove('active'));

        const tabId = tab.getAttribute('data-tab');
        const targetPane = document.getElementById(`${tabId}Tab`);
        if (targetPane) {
            targetPane.classList.add('active');
        }
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

export function JwtDecoderApp() {
    return (
        <div id="jwt-decoder-tool" className="tool-container jwt-decoder-tool">
            <div className="c-options-panel jwt-decoder-options-panel">
                <h3>Signature Options</h3>
                <div className="c-form-group jwt-decoder-options-group">
                    <div className="c-form-row jwt-decoder-secret-row">
                        <input
                            type="text"
                            id="jwtSecretKey"
                            className="c-input jwt-decoder-secret-input"
                            placeholder="Enter secret key to verify signature"
                            aria-label="Secret Key"
                        />
                        <button
                            type="button"
                            className="c-tooltip-container jwt-decoder-secret-help"
                            aria-label="More information about secret key"
                            aria-describedby="tooltip-secret-key"
                        >
                            ⓘ
                            <span id="tooltip-secret-key" className="c-tooltip" role="tooltip">
                                Optional - Enter the secret key to verify the JWT signature
                            </span>
                        </button>
                    </div>
                    <p className="algorithm-info jwt-decoder-algorithm-info">
                        NOTE: For signature verification, we only support "HS256 (HMAC with SHA-256)" algorithm for now.
                    </p>
                </div>
            </div>

            <div className="o-grid-2col jwt-decoder-layout-grid">
                <div className="o-panel jwt-decoder-panel jwt-decoder-input-panel">
                    <div className="o-panel-header jwt-decoder-panel-header">
                        <h3>JWT Token</h3>
                    </div>
                    <div className="o-panel-content jwt-decoder-panel-content">
                        <textarea
                            id="jwtInputToken"
                            className="c-input c-input--textarea jwt-decoder-token-input"
                            placeholder="Paste your JWT token here..."
                            aria-label="JWT Token Input"
                        />
                    </div>
                </div>

                <div className="o-panel jwt-decoder-panel jwt-decoder-output-panel">
                    <div className="o-panel-header jwt-decoder-panel-header">
                        <h3>Decoded Token</h3>
                    </div>
                    <div className="o-panel-content jwt-decoder-panel-content">
                        <div id="jwtDecodedContainer" className="jwt-decoder-json-container">
                            <div className="jwt-decoder-tabs" role="tablist">
                                <button
                                    id="tab-raw"
                                    className="jwt-decoder-tab active jwt-decoder-tab-btn"
                                    data-tab="raw"
                                    role="tab"
                                    aria-selected="true"
                                    aria-controls="rawTab"
                                    tabIndex="0"
                                >
                                    Raw
                                </button>
                                <button
                                    id="tab-header"
                                    className="jwt-decoder-tab jwt-decoder-tab-btn"
                                    data-tab="header"
                                    role="tab"
                                    aria-selected="false"
                                    aria-controls="headerTab"
                                    tabIndex="-1"
                                >
                                    Header
                                </button>
                                <button
                                    id="tab-payload"
                                    className="jwt-decoder-tab jwt-decoder-tab-btn"
                                    data-tab="payload"
                                    role="tab"
                                    aria-selected="false"
                                    aria-controls="payloadTab"
                                    tabIndex="-1"
                                >
                                    Payload
                                </button>
                            </div>

                            <div className="jwt-decoder-tab-content">
                                <div id="rawTab" className="jwt-decoder-tab-pane active" role="tabpanel" aria-labelledby="tab-raw">
                                    <div id="rawJsonViewer" className="jwt-decoder-json-viewer" tabIndex="0" aria-label="Decoded token raw JSON viewer" />
                                    <textarea id="jwtDecodedOutput" readOnly placeholder="Decoded token will appear here..." style={{ display: 'none' }} />
                                </div>
                                <div id="headerTab" className="jwt-decoder-tab-pane" role="tabpanel" aria-labelledby="tab-header">
                                    <div id="headerJson" className="jwt-decoder-json-viewer" tabIndex="0" aria-label="JWT header JSON viewer" />
                                </div>
                                <div id="payloadTab" className="jwt-decoder-tab-pane" role="tabpanel" aria-labelledby="tab-payload">
                                    <div id="payloadJson" className="jwt-decoder-json-viewer" tabIndex="0" aria-label="JWT payload JSON viewer" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="o-toolbar jwt-decoder-toolbar">
                <div className="primary-actions jwt-decoder-primary-actions">
                    <button id="jwt-decoder-decode-btn" className="c-button c-button--primary jwt-decoder-action-btn">Decode JWT Token</button>
                    <button id="jwt-decoder-validate-btn" className="c-button c-button--primary jwt-decoder-action-btn">Validate Signature</button>
                </div>
                <button id="jwt-decoder-copy-btn" className="c-button c-button--secondary jwt-decoder-copy-btn">Copy Decoded</button>
            </div>

            <div className="c-stats-panel jwt-decoder-result-panel">
                <h3>Validation Result</h3>
                <div className="jwt-decoder-status-container">
                    <div id="jwtSignatureStatus" className="jwt-decoder-status">Not verified</div>
                </div>
            </div>

            <footer className="jwt-decoder-footer">
                <p>JWT Decoder - Safely decode and verify your JWT tokens. No tokens are stored or transmitted</p>
            </footer>

            <div id="notification" className="c-notification" role="status" aria-live="polite" />
        </div>
    );
}

function initializeJwtDecoderDom() {
    const jwtDecoderApp = new JWTDecoderUI();
    jwtDecoderApp.initialize();

    if (typeof window !== 'undefined') {
        window.jwtDecoderApp = jwtDecoderApp;
    }

    return jwtDecoderApp;
}

export class JWTDecoderToolUI {
    constructor(rootSelector = '#jwt-decoder-app') {
        const root = document.querySelector(rootSelector) || document.querySelector('#jwt-decoder-tool');
        if (!root) {
            throw new Error('JWT Decoder root element not found');
        }

        const mount = root.hasChildNodes() ? hydrate : render;
        mount(<JwtDecoderApp />, root);
        this.app = initializeJwtDecoderDom();
    }
}

function bootstrapJwtDecoderPage() {
    mountToolShell({
        title: 'JWT Decoder & Validator',
        description: 'Decode and validate JWT tokens locally in your browser.',
        homeHref: '/'
    });

    const hasAppRoot = Boolean(document.getElementById('jwt-decoder-app') || document.getElementById('jwt-decoder-tool'));
    if (hasAppRoot) {
        try {
            new JWTDecoderToolUI();
            return;
        } catch (error) {
            console.error('JWT decoder UI bootstrap failed:', error);
        }
    }

    initializeJwtDecoderDom();
}

// Initialize the UI when the DOM is loaded
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', bootstrapJwtDecoderPage);
}
