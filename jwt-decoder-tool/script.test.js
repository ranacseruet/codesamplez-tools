// Import the script to execute it and attach listeners in the JSDOM environment
import './script.js';

// Mock the JWTDecoder class methods used by the script
jest.mock('./JWTDecoder.js', () => ({
  JWTDecoder: jest.fn().mockImplementation((token) => {
    // Basic mock for valid/invalid format based on token content
    const isValid = token && token.split('.').length === 3;
    const mockHeader = { alg: 'HS256', typ: 'JWT' };
    const mockPayload = { sub: '123', name: 'Test' };
    return {
      isValidFormat: isValid,
      getHeader: jest.fn(() => (isValid ? mockHeader : null)),
      getPayload: jest.fn(() => (isValid ? mockPayload : null)),
      getParsingError: jest.fn(() => (isValid ? null : 'Invalid mock format')),
      // Updated mock: verifySignature now checks the secret argument
      verifySignature: jest.fn().mockImplementation(async (secret) => {
        // Mock verification: returns true only if token is 'valid.token.sig' AND secret is 'secret'
        return Promise.resolve(token === 'valid.token.sig' && secret === 'secret');
      }),
    };
  }),
}));

// Mock the JsonTreeViewRenderer
jest.mock('./JsonTreeViewRenderer.js', () => ({
    JsonTreeViewRenderer: jest.fn().mockImplementation(() => ({
        render: jest.fn((data, container) => {
            // Simple mock render for testing presence of data
            container.innerHTML = `<pre>${JSON.stringify(data)}</pre>`;
        }),
    })),
}));

// Mock the NotificationManager
jest.mock('../common/notification-manager.js', () => ({
    NotificationManager: {
        show: jest.fn()
    }
}));

// Mock the ClearButton component
jest.mock('../common/clear-button/ClearButton.js', () => {
    return jest.fn().mockImplementation(() => ({
        updateVisibility: jest.fn(),
        disconnect: jest.fn()
    }));
});


beforeEach(() => {
  // Reset mocks and timers before each test
  jest.clearAllMocks();
  jest.useFakeTimers();

  // Set up mock DOM
  document.body.innerHTML = `
    <textarea id="jwtInputToken"></textarea>
    <textarea id="jwtSecretKey"></textarea>
    <textarea id="jwtDecodedOutput" style="display: none;"></textarea> <!-- Hidden -->
    <div id="headerJson" class="jwt-decoder-json-viewer"></div>
    <div id="payloadJson" class="jwt-decoder-json-viewer"></div>
    <div id="rawJsonViewer" class="jwt-decoder-json-viewer"></div>
    <div id="jwtSignatureStatus" class="jwt-decoder-status"></div>
    <button id="jwt-decoder-copy-btn"></button>
    <button id="jwt-decoder-decode-btn"></button>
    <button id="jwt-decoder-validate-btn"></button>
    <!-- Basic Tab Structure -->
    <div class="jwt-decoder-tabs">
        <button class="jwt-decoder-tab active" data-tab="raw"></button>
        <button class="jwt-decoder-tab" data-tab="header"></button>
        <button class="jwt-decoder-tab" data-tab="payload"></button>
    </div>
    <div class="jwt-decoder-tab-content">
        <div id="rawTab" class="jwt-decoder-tab-pane active"></div>
        <div id="headerTab" class="jwt-decoder-tab-pane"></div>
        <div id="payloadTab" class="jwt-decoder-tab-pane"></div>
    </div>
  `;

  // Mock navigator.clipboard
  Object.assign(navigator, {
    clipboard: {
      writeText: jest.fn()
    }
  });
});

describe('JWT Decoder UI Interactions', () => {
  // Helper function to dispatch DOMContentLoaded manually if needed,
  // though importing the script should trigger it in JSDOM.
  const triggerDOMContentLoaded = () => {
    document.dispatchEvent(new Event('DOMContentLoaded', {
      bubbles: true,
      cancelable: true
    }));
  };

  // Trigger DOMContentLoaded before each test to ensure listeners are attached
  beforeEach(() => {
    triggerDOMContentLoaded();
  });


  it('should decode token automatically on input after debounce', async () => {
    const jwtInput = document.getElementById('jwtInputToken');
    const headerJson = document.getElementById('headerJson');
    const payloadJson = document.getElementById('payloadJson');
    const rawJsonViewer = document.getElementById('rawJsonViewer');

    jwtInput.value = 'valid.token.sig'; // Use a token our mock considers valid
    jwtInput.dispatchEvent(new Event('input'));

    // Fast-forward time past the debounce delay (300ms in script.js)
    // Use runAllTimersAsync to ensure all nested timers/promises resolve
    await jest.runAllTimersAsync();

    // Check if renderer was called (indirectly checks if decodeJWTScoped ran)
    expect(headerJson.innerHTML).toContain('"alg":"HS256"'); // Check mock render output
    expect(payloadJson.innerHTML).toContain('"sub":"123"');
    expect(rawJsonViewer.innerHTML).toContain('"header":{"alg":"HS256"');
  });

  it('should verify signature automatically on secret input after debounce', async () => {
    const jwtInput = document.getElementById('jwtInputToken');
    const secretInput = document.getElementById('jwtSecretKey');
    const statusOutput = document.getElementById('jwtSignatureStatus');

    jwtInput.value = 'valid.token.sig'; // Mock considers this valid
    // Trigger initial decode first
    jwtInput.dispatchEvent(new Event('input'));
    await jest.runAllTimersAsync(); // Wait for decode debounce

    // Now enter secret
    secretInput.value = 'secret';
    secretInput.dispatchEvent(new Event('input'));

    // Fast-forward time past the verify debounce delay (300ms in script.js)
    await jest.runAllTimersAsync();

    // Check if status updated to valid
    expect(statusOutput.textContent).toBe('✓ Decoded successfully. Signature is valid.');
    expect(statusOutput.classList.contains('status-success')).toBe(true);
    expect(require('../common/notification-manager.js').NotificationManager.show)
        .toHaveBeenCalledWith('✓ Decoded successfully. Signature is valid.', 2000, expect.objectContaining({ type: 'success' }));

    // Test invalid signature
    secretInput.value = 'wrong-secret';
    secretInput.dispatchEvent(new Event('input'));
    await jest.runAllTimersAsync();
    expect(statusOutput.textContent).toBe('✗ Decoded successfully. Signature is invalid.');
    expect(statusOutput.classList.contains('status-error')).toBe(true);
    expect(require('../common/notification-manager.js').NotificationManager.show)
        .toHaveBeenCalledWith('✗ Decoded successfully. Signature is invalid.', 2000, expect.objectContaining({ type: 'error' }));

    // Test removing secret
    secretInput.value = '';
    secretInput.dispatchEvent(new Event('input'));
    await jest.runAllTimersAsync();
    expect(statusOutput.textContent).toBe('Decoded successfully.');
    expect(require('../common/notification-manager.js').NotificationManager.show)
        .toHaveBeenCalledWith('Decoded successfully.', 2000, expect.objectContaining({ type: 'success' }));
  });

  it('should re-verify signature automatically on token input if secret is present', async () => {
    const jwtInput = document.getElementById('jwtInputToken');
    const secretInput = document.getElementById('jwtSecretKey');
    const statusOutput = document.getElementById('jwtSignatureStatus');

    // 1. Set initial valid token and secret
    jwtInput.value = 'valid.token.sig';
    secretInput.value = 'secret';
    secretInput.dispatchEvent(new Event('input')); // Trigger verification
    await jest.runAllTimersAsync();
    expect(statusOutput.textContent).toBe('✓ Decoded successfully. Signature is valid.');
    expect(statusOutput.classList.contains('status-success')).toBe(true);
    expect(require('../common/notification-manager.js').NotificationManager.show)
        .toHaveBeenCalledWith('✓ Decoded successfully. Signature is valid.', 2000, expect.objectContaining({ type: 'success' }));

    // 2. Change token to one with invalid signature (but valid format)
    jwtInput.value = 'invalid.token.sig'; // Mock verifySignature returns false for this
    jwtInput.dispatchEvent(new Event('input')); // Trigger decode/verify
    await jest.runAllTimersAsync();
    expect(statusOutput.textContent).toBe('✗ Decoded successfully. Signature is invalid.');
    expect(statusOutput.classList.contains('status-error')).toBe(true);
    expect(require('../common/notification-manager.js').NotificationManager.show)
        .toHaveBeenCalledWith('✗ Decoded successfully. Signature is invalid.', 2000, expect.objectContaining({ type: 'error' }));

    // 3. Change token back to valid
    jwtInput.value = 'valid.token.sig';
    jwtInput.dispatchEvent(new Event('input')); // Trigger decode/verify
    await jest.runAllTimersAsync();
    expect(statusOutput.textContent).toBe('✓ Decoded successfully. Signature is valid.');
    expect(statusOutput.classList.contains('status-success')).toBe(true);
    expect(require('../common/notification-manager.js').NotificationManager.show)
        .toHaveBeenLastCalledWith('✓ Decoded successfully. Signature is valid.', 2000, expect.objectContaining({ type: 'success' }));

    // 4. Change token to invalid format
    jwtInput.value = 'invalid-format';
    jwtInput.dispatchEvent(new Event('input')); // Trigger decode/verify
    await jest.runAllTimersAsync();
    expect(statusOutput.textContent).toContain('Error: Invalid mock format'); // Check for parsing error
    expect(statusOutput.classList.contains('status-error')).toBe(true);
    expect(require('../common/notification-manager.js').NotificationManager.show)
        .toHaveBeenLastCalledWith(expect.stringContaining('Error: Invalid mock format'), 2000, expect.objectContaining({ type: 'error' }));
  });

  it('should copy decoded content when copy button is clicked', async () => {
    const copyBtn = document.getElementById('jwt-decoder-copy-btn');
    const decodedOutput = document.getElementById('jwtDecodedOutput');

    decodedOutput.value = '{"header":{"alg":"HS256"},"payload":{"sub":"123"}}'; // Set some valid JSON

    copyBtn.click();
    // Wait for potential async operations
    await jest.runAllTimersAsync();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(decodedOutput.value);
    expect(require('../common/notification-manager.js').NotificationManager.show)
        .toHaveBeenCalledWith('Copied to clipboard!', 2000, expect.objectContaining({ type: 'success' }));
  });

  it('should not copy error content when copy button is clicked', async () => {
    const copyBtn = document.getElementById('jwt-decoder-copy-btn');
    const decodedOutput = document.getElementById('jwtDecodedOutput');

    decodedOutput.value = 'Error: Invalid token'; // Set error content

    copyBtn.click();
    await jest.runAllTimersAsync(); // Run timers

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(copyBtn.textContent).not.toBe('Copied!'); // Check it didn't change to "Copied!"
    expect(require('../common/notification-manager.js').NotificationManager.show)
        .toHaveBeenCalledWith('Cannot copy error content', 2000, expect.objectContaining({ type: 'error' }));
  });

  it('should show error when clipboard copy fails', async () => {
    const copyBtn = document.getElementById('jwt-decoder-copy-btn');
    const decodedOutput = document.getElementById('jwtDecodedOutput');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    decodedOutput.value = '{"header":{"alg":"HS256"}}';
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error('clipboard denied'));

    copyBtn.click();
    await jest.runAllTimersAsync();

    expect(require('../common/notification-manager.js').NotificationManager.show)
      .toHaveBeenCalledWith('Failed to copy to clipboard', 2000, expect.objectContaining({ type: 'error' }));
    expect(copyBtn.getAttribute('title')).toBe('Failed to copy to clipboard');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to copy:', expect.any(Error));

    consoleErrorSpy.mockRestore();
  });

  it('should switch tabs when a different tab is clicked', async () => {
    const rawTab = document.querySelector('.jwt-decoder-tab[data-tab="raw"]');
    const headerTab = document.querySelector('.jwt-decoder-tab[data-tab="header"]');
    const payloadTab = document.querySelector('.jwt-decoder-tab[data-tab="payload"]');
    const rawPane = document.getElementById('rawTab');
    const headerPane = document.getElementById('headerTab');
    const payloadPane = document.getElementById('payloadTab');

    // Initial state: raw tab is active
    expect(rawTab.classList.contains('active')).toBe(true);
    expect(rawPane.classList.contains('active')).toBe(true);
    expect(headerTab.classList.contains('active')).toBe(false);
    expect(headerPane.classList.contains('active')).toBe(false);

    // Click header tab
    headerTab.click();
    await Promise.resolve(); // Allow event to process

    expect(rawTab.classList.contains('active')).toBe(false);
    expect(rawPane.classList.contains('active')).toBe(false);
    expect(headerTab.classList.contains('active')).toBe(true);
    expect(headerPane.classList.contains('active')).toBe(true);
    expect(payloadTab.classList.contains('active')).toBe(false);
    expect(payloadPane.classList.contains('active')).toBe(false);

    // Click payload tab
    payloadTab.click();
    await Promise.resolve(); // Allow event to process

    expect(headerTab.classList.contains('active')).toBe(false);
    expect(headerPane.classList.contains('active')).toBe(false);
    expect(payloadTab.classList.contains('active')).toBe(true);
    expect(payloadPane.classList.contains('active')).toBe(true);
  });

  it('should decode token when decode button is clicked', async () => {
    const jwtInput = document.getElementById('jwtInputToken');
    const decodeBtn = document.getElementById('jwt-decoder-decode-btn');
    const statusOutput = document.getElementById('jwtSignatureStatus');
    const headerJson = document.getElementById('headerJson');

    jwtInput.value = 'valid.token.sig'; // Mock valid token
    decodeBtn.click();
    await jest.runAllTimersAsync();

    expect(statusOutput.textContent).toBe('Decoded successfully.');
    expect(statusOutput.classList.contains('status-success')).toBe(true);
    expect(headerJson.innerHTML).toContain('"alg":"HS256"');
    expect(require('../common/notification-manager.js').NotificationManager.show)
        .toHaveBeenCalledWith('Decoded successfully.', 2000, expect.objectContaining({ type: 'success' }));
  });

  it('should validate signature when validate button is clicked with secret', async () => {
    const jwtInput = document.getElementById('jwtInputToken');
    const secretInput = document.getElementById('jwtSecretKey');
    const validateBtn = document.getElementById('jwt-decoder-validate-btn');
    const statusOutput = document.getElementById('jwtSignatureStatus');

    jwtInput.value = 'valid.token.sig'; // Mock valid token
    secretInput.value = 'secret'; // Correct secret for mock
    validateBtn.click();
    await jest.runAllTimersAsync();

    expect(statusOutput.textContent).toBe('✓ Decoded successfully. Signature is valid.');
    expect(statusOutput.classList.contains('status-success')).toBe(true);
    expect(require('../common/notification-manager.js').NotificationManager.show)
        .toHaveBeenCalledWith('✓ Decoded successfully. Signature is valid.', 2000, expect.objectContaining({ type: 'success' }));
  });

  it('should show warning when validate button is clicked without secret', async () => {
    const jwtInput = document.getElementById('jwtInputToken');
    const secretInput = document.getElementById('jwtSecretKey');
    const validateBtn = document.getElementById('jwt-decoder-validate-btn');
    const statusOutput = document.getElementById('jwtSignatureStatus');

    jwtInput.value = 'valid.token.sig'; // Mock valid token
    secretInput.value = ''; // No secret
    validateBtn.click();
    await jest.runAllTimersAsync();

    expect(statusOutput.textContent).toBe('Decoded successfully. Secret key required for signature validation.');
    expect(statusOutput.classList.contains('status-warning')).toBe(true);
    expect(require('../common/notification-manager.js').NotificationManager.show)
        .toHaveBeenCalledWith('Decoded successfully. Secret key required for signature validation.', 2000, expect.objectContaining({ type: 'warning' }));
  });

  it('should initialize tooltips on buttons', async () => {
    const copyBtn = document.getElementById('jwt-decoder-copy-btn');
    const decodeBtn = document.getElementById('jwt-decoder-decode-btn');
    const validateBtn = document.getElementById('jwt-decoder-validate-btn');

    // Tooltips are set in initializeTooltips
    expect(copyBtn.getAttribute('title')).toBe('Copy decoded token to clipboard');
    expect(decodeBtn.getAttribute('title')).toBe('Decode the JWT token');
    expect(validateBtn.getAttribute('title')).toBe('Decode and validate the JWT signature with the provided secret key');
  });

  it('should preload sample data on initialization', async () => {
    const jwtInput = document.getElementById('jwtInputToken');
    const secretInput = document.getElementById('jwtSecretKey');

    // Check preloaded values from preloadData method
    expect(jwtInput.value).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
    expect(secretInput.value).toBe('your-256-bit-secret');
  });

  it('should handle empty JWT input', async () => {
    const jwtInput = document.getElementById('jwtInputToken');
    const statusOutput = document.getElementById('jwtSignatureStatus');
    const headerJson = document.getElementById('headerJson');
    const payloadJson = document.getElementById('payloadJson');
    const rawJsonViewer = document.getElementById('rawJsonViewer');
    const decodedOutput = document.getElementById('jwtDecodedOutput');

    jwtInput.value = '';
    jwtInput.dispatchEvent(new Event('input'));
    await jest.runAllTimersAsync();

    expect(statusOutput.textContent).toBe('Enter a JWT token.');
    expect(statusOutput.classList.contains('status-default')).toBe(true);
    expect(headerJson.innerHTML).toBe('');
    expect(payloadJson.innerHTML).toBe('');
    expect(rawJsonViewer.innerHTML).toBe('');
    expect(decodedOutput.value).toBe('');
    expect(require('../common/notification-manager.js').NotificationManager.show)
        .toHaveBeenCalledWith('Enter a JWT token.', 2000, expect.objectContaining({ type: 'default' }));
  });

  it('should handle direct decode call with empty token', async () => {
    const app = window.jwtDecoderApp;
    const statusOutput = document.getElementById('jwtSignatureStatus');

    document.getElementById('jwtInputToken').value = '';
    await app.decodeAndRenderWithAutoVerify(false, false);

    expect(statusOutput.textContent).toBe('Enter a JWT token.');
    expect(statusOutput.classList.contains('status-default')).toBe(true);
  });

  it('should show auto verify warning when secret is missing', async () => {
    const app = window.jwtDecoderApp;
    const jwtInput = document.getElementById('jwtInputToken');
    const statusOutput = document.getElementById('jwtSignatureStatus');

    jwtInput.value = 'valid.token.sig';
    document.getElementById('jwtSecretKey').value = '';
    await app.decodeAndRenderWithAutoVerify(true, true);

    expect(statusOutput.textContent).toBe('Decoded successfully. Secret key required for verification.');
    expect(statusOutput.classList.contains('status-warning')).toBe(true);
  });

  it('should show auto decode warning when signature is not verified', async () => {
    const app = window.jwtDecoderApp;
    const jwtInput = document.getElementById('jwtInputToken');
    const statusOutput = document.getElementById('jwtSignatureStatus');

    jwtInput.value = 'valid.token.sig';
    await app.decodeAndRenderWithAutoVerify(false, true);

    expect(statusOutput.textContent).toBe('Decoded successfully. Signature not verified.');
    expect(statusOutput.classList.contains('status-warning')).toBe(true);
  });

  it('should switch to raw tab after decoding', async () => {
    const jwtInput = document.getElementById('jwtInputToken');
    const rawTab = document.querySelector('.jwt-decoder-tab[data-tab="raw"]');
    const headerTab = document.querySelector('.jwt-decoder-tab[data-tab="header"]');
    const rawPane = document.getElementById('rawTab');

    // Start with header tab active
    headerTab.click();
    await Promise.resolve();
    expect(headerTab.classList.contains('active')).toBe(true);
    expect(rawTab.classList.contains('active')).toBe(false);
    expect(rawPane.classList.contains('active')).toBe(false);

    jwtInput.value = 'valid.token.sig';
    jwtInput.dispatchEvent(new Event('input'));
    await jest.runAllTimersAsync();

    expect(rawTab.classList.contains('active')).toBe(true);
    expect(headerTab.classList.contains('active')).toBe(false);
    expect(rawPane.classList.contains('active')).toBe(true);
  });

  it('should decode without verification when secret is cleared', async () => {
    const jwtInput = document.getElementById('jwtInputToken');
    const secretInput = document.getElementById('jwtSecretKey');
    const statusOutput = document.getElementById('jwtSignatureStatus');

    jwtInput.value = 'valid.token.sig';
    secretInput.value = 'secret';
    secretInput.dispatchEvent(new Event('input'));
    await jest.runAllTimersAsync();
    expect(statusOutput.textContent).toBe('✓ Decoded successfully. Signature is valid.');

    secretInput.value = '';
    secretInput.dispatchEvent(new Event('input'));
    await jest.runAllTimersAsync();
    expect(statusOutput.textContent).toBe('Decoded successfully.');
    expect(statusOutput.classList.contains('status-success')).toBe(true);
    expect(require('../common/notification-manager.js').NotificationManager.show)
        .toHaveBeenLastCalledWith('Decoded successfully.', 2000, expect.objectContaining({ type: 'success' }));
  });

  it('should clear all fields and reset output/status', () => {
    const app = window.jwtDecoderApp;
    const jwtInput = document.getElementById('jwtInputToken');
    const secretInput = document.getElementById('jwtSecretKey');
    const decodedOutput = document.getElementById('jwtDecodedOutput');
    const headerJson = document.getElementById('headerJson');
    const payloadJson = document.getElementById('payloadJson');
    const rawJsonViewer = document.getElementById('rawJsonViewer');
    const statusOutput = document.getElementById('jwtSignatureStatus');

    jwtInput.value = 'valid.token.sig';
    secretInput.value = 'secret';
    decodedOutput.value = '{"header":{}}';
    headerJson.innerHTML = '<pre>header</pre>';
    payloadJson.innerHTML = '<pre>payload</pre>';
    rawJsonViewer.innerHTML = '<pre>raw</pre>';

    app.clearAll();

    expect(jwtInput.value).toBe('');
    expect(secretInput.value).toBe('');
    expect(decodedOutput.value).toBe('');
    expect(headerJson.innerHTML).toBe('');
    expect(payloadJson.innerHTML).toBe('');
    expect(rawJsonViewer.innerHTML).toBe('');
    expect(statusOutput.textContent).toBe('Enter a JWT token.');
    expect(require('../common/notification-manager.js').NotificationManager.show)
      .toHaveBeenCalledWith('All fields cleared.', 2000, expect.objectContaining({ type: 'success' }));
  });

  // Clean up timers after tests
  afterEach(() => {
    jest.useRealTimers();
  });
});
