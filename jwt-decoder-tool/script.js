import { JWTDecoder } from './JWTDecoder.js';
import { JsonTreeViewRenderer } from './JsonTreeViewRenderer.js';

// Instantiate the renderer globally for this script scope
const jsonRenderer = new JsonTreeViewRenderer();

// Function to setup tab functionality (can remain top-level)
function setupTabs() {
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

// Function to manage PERSISTENT state of the Decode button
function updateDecodeButtonState(decodeBtn, status) { // status: 'empty', 'success', 'error'
    if (!decodeBtn) return;
    decodeBtn.classList.remove('success', 'error', 'empty');
    switch (status) {
        case 'success':
            decodeBtn.textContent = 'Decoded ✓';
            decodeBtn.disabled = true;
            decodeBtn.classList.add('success');
            break;
        case 'error':
            decodeBtn.textContent = 'Invalid Token ✗';
            decodeBtn.disabled = true;
            decodeBtn.classList.add('error');
            break;
        case 'empty':
        default:
            decodeBtn.textContent = 'Decode JWT';
            decodeBtn.disabled = true; // Decode button is generally disabled unless actively decoding
            decodeBtn.classList.add('empty');
            break;
    }
}

// Function to manage PERSISTENT state of the Verify button
function updateVerifyButtonState(verifyBtn, verifyStatus, decodeStatus) {
    // verifyStatus: 'notVerified', 'valid', 'invalid', 'secretMissing', 'tokenInvalid'
    // decodeStatus: 'empty', 'success', 'error'
    if (!verifyBtn) return;
    verifyBtn.classList.remove('verify-valid', 'verify-invalid', 'verify-warning', 'verify-error', 'verify-not-verified');

    // Determine enabled state: Enabled only if token is successfully decoded
    verifyBtn.disabled = (decodeStatus !== 'success');

    switch (verifyStatus) {
        case 'valid':
            verifyBtn.textContent = '✓ Valid';
            verifyBtn.classList.add('verify-valid');
            break;
        case 'invalid':
            verifyBtn.textContent = '✗ Invalid';
            verifyBtn.classList.add('verify-invalid');
            break;
        case 'secretMissing':
            verifyBtn.textContent = 'Secret Missing';
            verifyBtn.classList.add('verify-warning');
            break;
        case 'tokenInvalid': // When the token itself is bad
             verifyBtn.textContent = 'Token Invalid';
             verifyBtn.classList.add('verify-error'); // Use error style
             break;
        case 'notVerified':
        default:
            verifyBtn.textContent = 'Verify Signature';
            verifyBtn.classList.add('verify-not-verified'); // Default class
            // Keep disabled state based on decodeStatus
            break;
    }
}


// Initialize the UI when the DOM is loaded
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // --- Cache DOM Elements ---
        const elements = {
            jwtInput: document.getElementById('jwtInputToken'),
            secretInput: document.getElementById('jwtSecretKey'),
            decodeBtn: document.getElementById('jwt-decoder-decode-btn'),
            verifyBtn: document.getElementById('jwt-decoder-verify-btn'),
            copyBtn: document.getElementById('jwt-decoder-copy-btn'),
            clearBtn: document.getElementById('jwt-decoder-clear-btn'),
            decodedOutput: document.getElementById('jwtDecodedOutput'), // Hidden textarea
            statusOutput: document.getElementById('jwtSignatureStatus'),
            headerJsonContainer: document.getElementById('headerJson'),
            payloadJsonContainer: document.getElementById('payloadJson'),
            rawJsonViewerContainer: document.getElementById('rawJsonViewer')
        };

        // --- Define Core Logic Functions (Scoped) ---
        async function decodeJWTScoped(verifySignature = false) {
            let decodeStatus = 'empty';
            let verifyStatus = 'notVerified';
            const jwt = elements.jwtInput.value.trim();
            const secret = elements.secretInput.value.trim();

            if (!jwt) {
                // Clear outputs if JWT is empty
                elements.decodedOutput.value = '';
                elements.headerJsonContainer.innerHTML = '';
                elements.payloadJsonContainer.innerHTML = '';
                elements.rawJsonViewerContainer.innerHTML = '';
                elements.statusOutput.textContent = 'Not verified';
                elements.statusOutput.style.color = 'rgb(102, 102, 102)';
                decodeStatus = 'empty';
                verifyStatus = 'notVerified';
            } else {
                try {
                    const decoder = new JWTDecoder(jwt);

                    if (!decoder.isValidFormat) {
                        throw new Error(decoder.getParsingError() || 'Invalid JWT format');
                    }

                    const header = decoder.getHeader();
                    const payload = decoder.getPayload();

                    // Use the renderer instance with cached elements
                    jsonRenderer.render(header, elements.headerJsonContainer);
                    jsonRenderer.render(payload, elements.payloadJsonContainer);

                    const combinedData = { header, payload };
                    elements.decodedOutput.value = JSON.stringify(combinedData, null, 2); // Update hidden textarea
                    jsonRenderer.render(combinedData, elements.rawJsonViewerContainer); // Update raw view

                    decodeStatus = 'success';

                    // Switch to Raw tab after successful decode
                    const rawTab = document.querySelector('.jwt-decoder-tab[data-tab="raw"]');
                    if (rawTab) rawTab.click();

                    // --- Determine Verify Status ---
                    if (verifySignature) {
                        if (!secret) {
                            verifyStatus = 'secretMissing';
                            elements.statusOutput.textContent = 'Secret key required for verification';
                            elements.statusOutput.style.color = 'rgb(255, 193, 7)'; // Warning color
                        } else {
                            const isValid = await decoder.verifySignature(secret);
                            verifyStatus = isValid ? 'valid' : 'invalid';
                            elements.statusOutput.textContent = isValid ? '✓ Signature is valid' : '✗ Signature is invalid';
                            elements.statusOutput.style.color = isValid ? 'rgb(40, 167, 69)' : 'rgb(220, 53, 69)';
                        }
                    } else {
                         // Reset verification status display if not actively verifying
                         verifyStatus = 'notVerified';
                         elements.statusOutput.textContent = 'Not verified';
                         elements.statusOutput.style.color = 'rgb(102, 102, 102)';
                    }
                    // --- End Determine Verify Status ---

                } catch (e) {
                    // Handle errors
                    elements.decodedOutput.value = `Error: ${e.message}`;
                    elements.headerJsonContainer.innerHTML = '';
                    elements.payloadJsonContainer.innerHTML = '';
                    elements.rawJsonViewerContainer.innerHTML = '';
                    elements.statusOutput.textContent = 'Error processing token';
                    elements.statusOutput.style.color = 'rgb(220, 53, 69)';
                    console.error('JWT Processing Error:', e);
                    decodeStatus = 'error';
                    verifyStatus = 'tokenInvalid';
                }
            }

            // Update the persistent state of BOTH buttons AFTER processing
            updateDecodeButtonState(elements.decodeBtn, decodeStatus);
            updateVerifyButtonState(elements.verifyBtn, verifyStatus, decodeStatus);
        }

        // Define copyDecoded within this scope
        async function copyDecodedScoped() {
            const decodedContent = elements.decodedOutput.value;
            const copyBtn = elements.copyBtn; // Use cached button

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

        // Define clearAll within this scope
        function clearAllScoped() {
            elements.jwtInput.value = '';
            elements.secretInput.value = '';
            elements.decodedOutput.value = '';
            elements.headerJsonContainer.innerHTML = '';
            elements.payloadJsonContainer.innerHTML = '';
            elements.rawJsonViewerContainer.innerHTML = '';
            elements.statusOutput.textContent = 'Not verified';
            elements.statusOutput.style.color = 'rgb(102, 102, 102)';

            // Reset tab to raw view
            const rawTab = document.querySelector('.jwt-decoder-tab[data-tab="raw"]');
            if (rawTab) rawTab.click();

            // Reset button states using cached elements
            updateDecodeButtonState(elements.decodeBtn, 'empty');
            updateVerifyButtonState(elements.verifyBtn, 'notVerified', 'empty');
        }

        // --- Initialize UI and Event Listeners ---
        setupTabs(); // Initialize tab switching

        // Preload with sample JWT token and secret (optional, but good for demo)
        elements.jwtInput.value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        elements.secretInput.value = 'your-256-bit-secret';

        // Trigger initial decode AND VERIFICATION on load
        decodeJWTScoped(true);

        // --- Debounced Input Handlers ---
        let decodeTimeout;
        const debounceDecode = () => {
            clearTimeout(decodeTimeout);
            const token = elements.jwtInput.value.trim();
            elements.decodeBtn.disabled = !token; // Enable/disable decode button based on input

            if (!token) {
                // If token is cleared, reset everything immediately
                clearAllScoped();
                return;
            }
            // Auto-decode (without verification) after a short delay
            decodeTimeout = setTimeout(() => decodeJWTScoped(false), 300);
        };

        elements.jwtInput.addEventListener('input', debounceDecode);
        elements.jwtInput.addEventListener('paste', debounceDecode); // Handle paste too

        let verifyTimeout;
        const debounceVerify = () => {
            clearTimeout(verifyTimeout);
            // Only attempt auto-verification if the verify button is enabled (token is valid)
            if (!elements.verifyBtn.disabled) {
                 verifyTimeout = setTimeout(() => decodeJWTScoped(true), 300); // Trigger verification
            } else {
                 // If verify button is disabled (e.g., token invalid), ensure status reflects 'not verified'
                 // This might be redundant if decodeJWTScoped handles it, but ensures consistency
                 const currentDecodeStatus = elements.decodeBtn.classList.contains('success') ? 'success' :
                                            elements.decodeBtn.classList.contains('error') ? 'error' : 'empty';
                 updateVerifyButtonState(elements.verifyBtn, 'notVerified', currentDecodeStatus);
            }
        };
        elements.secretInput.addEventListener('input', debounceVerify);
        elements.secretInput.addEventListener('paste', debounceVerify); // Handle paste too

        // --- Button Click Handlers ---
        // Decode button is driven by input changes, not clicks
        elements.verifyBtn.addEventListener('click', () => decodeJWTScoped(true)); // Explicit verify click
        elements.copyBtn.addEventListener('click', copyDecodedScoped);
        elements.clearBtn.addEventListener('click', clearAllScoped);

        // --- Initialize Tooltips ---
        elements.copyBtn.setAttribute('title', 'Copy decoded token to clipboard');
    });
}
