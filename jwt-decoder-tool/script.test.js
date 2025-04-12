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
      verifySignature: jest.fn().mockResolvedValue(token === 'valid.token.sig'), // Mock verification
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
    <button id="jwt-decoder-decode-btn"></button>
    <button id="jwt-decoder-verify-btn"></button>
    <button id="jwt-decoder-copy-btn"></button>
    <button id="jwt-decoder-clear-btn"></button>
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

  it('should clear all fields when clear button is clicked', async () => { // Make test async
    // Set initial values
    const jwtInput = document.getElementById('jwtInputToken');
    const secretInput = document.getElementById('jwtSecretKey');
    const decodedOutput = document.getElementById('jwtDecodedOutput');
    const headerJson = document.getElementById('headerJson');
    const payloadJson = document.getElementById('payloadJson');
    const rawJsonViewer = document.getElementById('rawJsonViewer');
    const statusOutput = document.getElementById('jwtSignatureStatus');
    const clearBtn = document.getElementById('jwt-decoder-clear-btn');

    jwtInput.value = 'test.token.sig';
    secretInput.value = 'secret';
    decodedOutput.value = '{"header":{},"payload":{}}';
    headerJson.innerHTML = 'header';
    payloadJson.innerHTML = 'payload';
    rawJsonViewer.innerHTML = 'raw';
    statusOutput.textContent = 'Verified';
    statusOutput.style.color = 'green';

    // Simulate click
    clearBtn.click();

    // Allow potential microtasks from event handling to settle
    await Promise.resolve();

    // Assertions
    expect(jwtInput.value).toBe('');
    expect(secretInput.value).toBe('');
    expect(decodedOutput.value).toBe(''); // Hidden textarea
    expect(headerJson.innerHTML).toBe('');
    expect(payloadJson.innerHTML).toBe('');
    expect(rawJsonViewer.innerHTML).toBe('');
    expect(statusOutput.textContent).toBe('Not verified');
    expect(statusOutput.style.color).toBe('rgb(102, 102, 102)');
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

   it('should verify signature when verify button is clicked', async () => {
        const jwtInput = document.getElementById('jwtInputToken');
        const secretInput = document.getElementById('jwtSecretKey');
        const verifyBtn = document.getElementById('jwt-decoder-verify-btn');
        const statusOutput = document.getElementById('jwtSignatureStatus');

        jwtInput.value = 'valid.token.sig'; // Mock considers this valid
        secretInput.value = 'secret';

        // Trigger initial decode first (simulating auto-decode or previous action)
        jwtInput.dispatchEvent(new Event('input'));
        await jest.runAllTimersAsync(); // Wait for decode debounce

        // Now click verify
        verifyBtn.click();
        // Verification is async, wait for promises/timers
        await jest.runAllTimersAsync(); // Ensure verify debounce and async operations complete

        expect(statusOutput.textContent).toBe('✓ Signature is valid');
        expect(statusOutput.style.color).toBe('rgb(40, 167, 69)');
    });

  it('should copy decoded content when copy button is clicked', async () => {
    const copyBtn = document.getElementById('jwt-decoder-copy-btn');
    const decodedOutput = document.getElementById('jwtDecodedOutput');

    decodedOutput.value = '{"header":{"alg":"HS256"},"payload":{"sub":"123"}}'; // Set some valid JSON

    copyBtn.click();
    // Wait for potential async operations and the setTimeout for button reset
    await jest.runAllTimersAsync();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(decodedOutput.value);
    // Check state *after* timers have run
    expect(copyBtn.textContent).toBe('Copy Decoded'); // Should have reset after 2s

    // To check the intermediate "Copied!" state, we need finer control
    // Reset and click again
    copyBtn.textContent = 'Copy Decoded'; // Reset manually for this check
    copyBtn.click();
    await jest.advanceTimersByTimeAsync(10); // Advance just enough for the immediate change
    expect(copyBtn.textContent).toBe('Copied!');
    await jest.runAllTimersAsync(); // Run remaining timers
    expect(copyBtn.textContent).toBe('Copy Decoded');
  });

  it('should not copy error content when copy button is clicked', async () => {
    const copyBtn = document.getElementById('jwt-decoder-copy-btn');
    const decodedOutput = document.getElementById('jwtDecodedOutput');

    decodedOutput.value = 'Error: Invalid token'; // Set error content

    copyBtn.click();
    await jest.runAllTimersAsync(); // Run timers

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(copyBtn.textContent).not.toBe('Copied!'); // Check it didn't change to "Copied!"
  });

  // Clean up timers after tests
  afterEach(() => {
    jest.useRealTimers();
  });
});
