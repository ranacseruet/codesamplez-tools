import { JWTDecoder } from './JWTDecoder';
import { JsonTreeViewRenderer } from './JsonTreeViewRenderer';
import { NotificationManager } from '../common/notification-manager';
import ClearButton from '../common/clear-button/ClearButton';
import { hydrate, render } from 'preact';
import { mountToolShell } from '../common/app-shell/mountToolShell';

type StatusType = 'default' | 'success' | 'error' | 'warning';

type ElementConstructor<T extends HTMLElement> = { new (): T };

interface JWTDecoderUIElements {
    jwtInput: HTMLTextAreaElement;
    secretInput: HTMLInputElement | HTMLTextAreaElement;
    copyBtn: HTMLButtonElement;
    decodeBtn: HTMLButtonElement;
    validateBtn: HTMLButtonElement;
    decodedOutput: HTMLTextAreaElement;
    statusOutput: HTMLElement;
    headerJsonContainer: HTMLElement;
    payloadJsonContainer: HTMLElement;
    rawJsonViewerContainer: HTMLElement;
}

type JwtDecoderWindow = Window & {
    jwtDecoderApp?: JWTDecoderUI;
};

const browserWindow = typeof window !== 'undefined' ? (window as JwtDecoderWindow) : null;

function getRequiredElement<T extends HTMLElement>(
    id: string,
    expectedType: ElementConstructor<T>,
    expectedTypeName: string
): T {
    const element = document.getElementById(id);
    if (!(element instanceof expectedType)) {
        throw new Error(`Expected #${id} to be a ${expectedTypeName}.`);
    }

    return element;
}

function getRequiredTextInputLikeElement(id: string): HTMLInputElement | HTMLTextAreaElement {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
        throw new Error(`Expected #${id} to be a text input element.`);
    }

    return element;
}

export class JWTDecoderUI {
    jsonRenderer: JsonTreeViewRenderer;
    elements: JWTDecoderUIElements;
    decodeTimeout: ReturnType<typeof setTimeout> | null;
    verifyTimeout: ReturnType<typeof setTimeout> | null;
    clearButton: ClearButton | null;

    constructor() {
        // Instantiate the renderer within the class
        this.jsonRenderer = new JsonTreeViewRenderer();

        // Cache DOM Elements
        this.elements = {
            jwtInput: getRequiredElement('jwtInputToken', HTMLTextAreaElement, 'HTMLTextAreaElement'),
            secretInput: getRequiredTextInputLikeElement('jwtSecretKey'),
            copyBtn: getRequiredElement('jwt-decoder-copy-btn', HTMLButtonElement, 'HTMLButtonElement'),
            decodeBtn: getRequiredElement('jwt-decoder-decode-btn', HTMLButtonElement, 'HTMLButtonElement'),
            validateBtn: getRequiredElement('jwt-decoder-validate-btn', HTMLButtonElement, 'HTMLButtonElement'),
            decodedOutput: getRequiredElement('jwtDecodedOutput', HTMLTextAreaElement, 'HTMLTextAreaElement'),
            statusOutput: getRequiredElement('jwtSignatureStatus', HTMLElement, 'HTMLElement'),
            headerJsonContainer: getRequiredElement('headerJson', HTMLElement, 'HTMLElement'),
            payloadJsonContainer: getRequiredElement('payloadJson', HTMLElement, 'HTMLElement'),
            rawJsonViewerContainer: getRequiredElement('rawJsonViewer', HTMLElement, 'HTMLElement')
        };

        // Debounce timers
        this.decodeTimeout = null;
        this.verifyTimeout = null;

        // Clear button component
        this.clearButton = null;
    }

    // --- Initialization ---
    initialize(): void {
        if (typeof document === 'undefined') return; // Guard against non-browser environments

        this.setupTabs();
        this.setupEventListeners();
        this.preloadData();
        this.decodeAndRender(false, true); // Initial decode only, no signature validation, suppress notification
        this.initializeTooltips();
    }

    // --- UI Setup ---
    setupTabs(): void {
        const tabs = document.querySelectorAll<HTMLButtonElement>('.jwt-decoder-tab');
        const tabList = document.querySelector<HTMLElement>('.jwt-decoder-tabs');

        // Handle Click Events
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.activateTab(tab);
            });
        });

        // Handle Keyboard Navigation
        if (tabList) {
            tabList.addEventListener('keydown', (event: KeyboardEvent) => {
                const key = event.key;
                const direction = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;

                if (direction !== 0) {
                    event.preventDefault();
                    const currentTab = document.activeElement;
                    const index = Array.from(tabs).findIndex((tab) => tab === currentTab);
                    if (index !== -1) {
                        const newIndex = (index + direction + tabs.length) % tabs.length;
                        const newTab = tabs[newIndex];
                        if (newTab) {
                            newTab.focus();
                            this.activateTab(newTab);
                        }
                    }
                }
            });
        }
    }

    activateTab(tab: HTMLElement): void {
        const tabs = document.querySelectorAll<HTMLElement>('.jwt-decoder-tab');

        tabs.forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
            t.setAttribute('tabindex', '-1');
        });

        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        tab.setAttribute('tabindex', '0');

        const tabPanes = document.querySelectorAll<HTMLElement>('.jwt-decoder-tab-pane');
        tabPanes.forEach(pane => pane.classList.remove('active'));

        const tabId = tab.getAttribute('data-tab');
        const targetPane = document.getElementById(`${tabId}Tab`);
        if (targetPane) {
            targetPane.classList.add('active');
        }
    }

    setupEventListeners(): void {
        // Initialize Clear Button component for JWT input
        this.clearButton = new ClearButton(this.elements.jwtInput);

        // Debounced Input Handlers for automatic actions
        this.elements.jwtInput.addEventListener('input', this.debounceDecode.bind(this));
        this.elements.jwtInput.addEventListener('paste', this.debounceDecode.bind(this));
        this.elements.secretInput.addEventListener('input', this.debounceVerify.bind(this));
        this.elements.secretInput.addEventListener('paste', this.debounceVerify.bind(this));

        // Button Click Handlers for manual actions
        this.elements.copyBtn.addEventListener('click', this.copyDecoded.bind(this));
        this.elements.decodeBtn.addEventListener('click', () => this.decodeAndRender(false));
        this.elements.validateBtn.addEventListener('click', () => this.decodeAndRender(true));
    }

    preloadData(): void {
        // Preload with sample JWT token and secret (optional)
        this.elements.jwtInput.value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        this.elements.secretInput.value = 'your-256-bit-secret';
        
        // Update clear button visibility after preloading data
        if (this.clearButton) {
            this.clearButton.updateVisibility();
        }
    }

    initializeTooltips(): void {
        this.elements.copyBtn.setAttribute('title', 'Copy decoded token to clipboard');
        this.elements.decodeBtn.setAttribute('title', 'Decode the JWT token');
        this.elements.validateBtn.setAttribute('title', 'Decode and validate the JWT signature with the provided secret key');
    }

    // --- Core Logic & Rendering ---
    async decodeAndRender(verifySignature = false, suppressNotification = false): Promise<void> {
        return this.decodeAndRenderWithAutoVerify(verifySignature, false, suppressNotification);
    }

    async decodeAndRenderWithAutoVerify(verifySignature = false, isAuto = false, suppressNotification = false): Promise<void> {
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

            } catch (error: unknown) {
                this.handleProcessingError(error);
            }
        }
    }

    // --- UI Update Helpers ---
    // Removed updateButtonStates, updateDecodeButtonState, updateVerifyButtonState

    updateStatusOutput(message: string, type: StatusType = 'default', suppressNotification = false): void { // type: 'default', 'success', 'error', 'warning'
        const output = this.elements.statusOutput;
        output.textContent = message;
        output.className = 'jwt-decoder-status c-status-banner'; // Reset classes
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

    clearOutputs(): void {
        this.elements.decodedOutput.value = '';
        this.elements.headerJsonContainer.innerHTML = '';
        this.elements.payloadJsonContainer.innerHTML = '';
        this.elements.rawJsonViewerContainer.innerHTML = '';
        // Status is updated in decodeAndRender or clearAll
    }

    switchToRawTab(): void {
        const rawTab = document.querySelector<HTMLElement>('.jwt-decoder-tab[data-tab="raw"]');
        if (rawTab) rawTab.click();
    }

    handleProcessingError(error: unknown): void {
        const message = error instanceof Error ? error.message : String(error);
        this.elements.decodedOutput.value = `Error: ${message}`;
        this.elements.headerJsonContainer.innerHTML = '';
        this.elements.payloadJsonContainer.innerHTML = '';
        this.elements.rawJsonViewerContainer.innerHTML = '';
        this.updateStatusOutput(`Error: ${message}`, 'error');
        console.error('JWT Processing Error:', error);
    }

    // --- Event Handlers ---
    debounceDecode(): void {
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

    debounceVerify(): void {
        clearTimeout(this.verifyTimeout);
        // Auto-verify on secret input change if secret is present.
        const secret = this.elements.secretInput.value.trim();
        if (secret) {
            this.verifyTimeout = setTimeout(() => this.decodeAndRenderWithAutoVerify(true), 300);
        } else {
            this.verifyTimeout = setTimeout(() => this.decodeAndRenderWithAutoVerify(false), 300);
        }
    }

    async copyDecoded(): Promise<void> {
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
        } catch (error: unknown) {
            console.error('Failed to copy:', error);
            NotificationManager.show('Failed to copy to clipboard', 2000, { type: 'error' });
            copyBtn.setAttribute('title', 'Failed to copy to clipboard');
        }
    }

    clearAll(): void {
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
        <div id="jwt-decoder-tool" className="tool-container jwt-decoder-tool c-tool-stack">
            <div className="c-options-panel jwt-decoder-options-panel c-surface-card">
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
                <div className="o-panel jwt-decoder-panel jwt-decoder-input-panel c-surface-card c-surface-panel">
                    <div className="o-panel-header jwt-decoder-panel-header c-surface-panel__header">
                        <h3>JWT Token</h3>
                    </div>
                    <div className="o-panel-content jwt-decoder-panel-content c-surface-panel__content">
                        <textarea
                            id="jwtInputToken"
                            className="c-input c-input--textarea jwt-decoder-token-input"
                            placeholder="Paste your JWT token here..."
                            aria-label="JWT Token Input"
                        />
                    </div>
                </div>

                <div className="o-panel jwt-decoder-panel jwt-decoder-output-panel c-surface-card c-surface-panel">
                    <div className="o-panel-header jwt-decoder-panel-header c-surface-panel__header">
                        <h3>Decoded Token</h3>
                    </div>
                    <div className="o-panel-content jwt-decoder-panel-content c-surface-panel__content">
                        <div id="jwtDecodedContainer" className="jwt-decoder-json-container">
                            <div className="jwt-decoder-tabs c-tab-list" role="tablist">
                                <button
                                    id="tab-raw"
                                    className="jwt-decoder-tab c-tab-button active jwt-decoder-tab-btn"
                                    data-tab="raw"
                                    role="tab"
                                    aria-selected="true"
                                    aria-controls="rawTab"
                                    tabIndex={0}
                                >
                                    Raw
                                </button>
                                <button
                                    id="tab-header"
                                    className="jwt-decoder-tab c-tab-button jwt-decoder-tab-btn"
                                    data-tab="header"
                                    role="tab"
                                    aria-selected="false"
                                    aria-controls="headerTab"
                                    tabIndex={-1}
                                >
                                    Header
                                </button>
                                <button
                                    id="tab-payload"
                                    className="jwt-decoder-tab c-tab-button jwt-decoder-tab-btn"
                                    data-tab="payload"
                                    role="tab"
                                    aria-selected="false"
                                    aria-controls="payloadTab"
                                    tabIndex={-1}
                                >
                                    Payload
                                </button>
                            </div>

                            <div className="jwt-decoder-tab-content">
                                <div id="rawTab" className="jwt-decoder-tab-pane active" role="tabpanel" aria-labelledby="tab-raw">
                                    <div id="rawJsonViewer" className="jwt-decoder-json-viewer" tabIndex={0} aria-label="Decoded token raw JSON viewer" />
                                    <textarea id="jwtDecodedOutput" readOnly placeholder="Decoded token will appear here..." style={{ display: 'none' }} />
                                </div>
                                <div id="headerTab" className="jwt-decoder-tab-pane" role="tabpanel" aria-labelledby="tab-header">
                                    <div id="headerJson" className="jwt-decoder-json-viewer" tabIndex={0} aria-label="JWT header JSON viewer" />
                                </div>
                                <div id="payloadTab" className="jwt-decoder-tab-pane" role="tabpanel" aria-labelledby="tab-payload">
                                    <div id="payloadJson" className="jwt-decoder-json-viewer" tabIndex={0} aria-label="JWT payload JSON viewer" />
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

            <div className="c-stats-panel jwt-decoder-result-panel c-surface-card">
                <h3>Validation Result</h3>
                <div className="jwt-decoder-status-container">
                    <div id="jwtSignatureStatus" className="jwt-decoder-status c-status-banner">Not verified</div>
                </div>
            </div>

            <footer className="jwt-decoder-footer c-tool-footer">
                <p>JWT Decoder - Safely decode and verify your JWT tokens. No tokens are stored or transmitted</p>
            </footer>

            <div id="notification" className="c-notification" role="status" aria-live="polite" />
        </div>
    );
}

function initializeJwtDecoderDom(): JWTDecoderUI {
    const jwtDecoderApp = new JWTDecoderUI();
    jwtDecoderApp.initialize();

    if (browserWindow) {
        browserWindow.jwtDecoderApp = jwtDecoderApp;
    }

    return jwtDecoderApp;
}

export class JWTDecoderToolUI {
    app: JWTDecoderUI;

    constructor(rootSelector = '#jwt-decoder-app') {
        const root = document.querySelector<HTMLElement>(rootSelector) || document.querySelector<HTMLElement>('#jwt-decoder-tool');
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
