// Import the script to execute it and attach listeners in the JSDOM environment
import './script';

// Mock the JWTDecoder class methods used by the script
jest.mock('./JWTDecoder', () => ({
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
      verifySignature: jest.fn().mockImplementation(async (secret) => {
        return Promise.resolve(token === 'valid.token.sig' && secret === 'secret');
      }),
    };
  }),
}));

// Mock the JsonTreeViewRenderer
jest.mock('./JsonTreeViewRenderer', () => ({
    JsonTreeViewRenderer: jest.fn().mockImplementation(() => ({
        render: jest.fn((data, container) => {
            container.innerHTML = `<pre>${JSON.stringify(data)}</pre>`;
        }),
    })),
}));

// Mock the NotificationManager
jest.mock('../common/notification-manager', () => ({
    NotificationManager: {
        show: jest.fn()
    }
}));

// Mock the ClearButton component
jest.mock('../common/clear-button/ClearButton', () => {
    return jest.fn().mockImplementation(() => ({
        updateVisibility: jest.fn(),
        disconnect: jest.fn()
    }));
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();

  // Set up mock DOM (based on index.html but with minimal structure for tabs)
  document.body.innerHTML = `
    <textarea id="jwtInputToken"></textarea>
    <div class="c-form-row">
        <textarea id="jwtSecretKey"></textarea>
        <button type="button" class="c-tooltip-container" aria-label="More info" aria-describedby="jwt-secret-tooltip">
            ⓘ
            <span id="jwt-secret-tooltip" class="c-tooltip" role="tooltip">Optional - Enter the secret key to verify the JWT signature</span>
        </button>
    </div>
    <textarea id="jwtDecodedOutput" style="display: none;"></textarea>
    <div id="headerJson"></div>
    <div id="payloadJson"></div>
    <div id="rawJsonViewer"></div>
    <div id="jwtSignatureStatus"></div>
    <button id="jwt-decoder-copy-btn"></button>
    <button id="jwt-decoder-decode-btn"></button>
    <button id="jwt-decoder-validate-btn"></button>

    <!-- Tab Structure -->
    <div class="jwt-decoder-tabs" role="tablist">
        <button id="tab-raw" class="jwt-decoder-tab active" role="tab" aria-selected="true" aria-controls="rawTab" tabindex="0" data-tab="raw">Raw</button>
        <button id="tab-header" class="jwt-decoder-tab" role="tab" aria-selected="false" aria-controls="headerTab" tabindex="-1" data-tab="header">Header</button>
        <button id="tab-payload" class="jwt-decoder-tab" role="tab" aria-selected="false" aria-controls="payloadTab" tabindex="-1" data-tab="payload">Payload</button>
    </div>
    <div class="jwt-decoder-tab-content">
        <div id="rawTab" class="jwt-decoder-tab-pane active" role="tabpanel" aria-labelledby="tab-raw">Raw Content</div>
        <div id="headerTab" class="jwt-decoder-tab-pane" role="tabpanel" aria-labelledby="tab-header">Header Content</div>
        <div id="payloadTab" class="jwt-decoder-tab-pane" role="tabpanel" aria-labelledby="tab-payload">Payload Content</div>
    </div>
  `;
});

describe('JWT Decoder Accessibility', () => {
    const triggerDOMContentLoaded = () => {
        document.dispatchEvent(new Event('DOMContentLoaded', {
            bubbles: true,
            cancelable: true
        }));
    };

    beforeEach(() => {
        triggerDOMContentLoaded();
    });

    it('should have correct ARIA roles and attributes on tabs', () => {
        const tabs = document.querySelectorAll('.jwt-decoder-tab');
        const tabList = document.querySelector('.jwt-decoder-tabs');
        const panels = document.querySelectorAll('.jwt-decoder-tab-pane');

        expect(tabList.getAttribute('role')).toBe('tablist');

        tabs.forEach(tab => {
            expect(tab.getAttribute('role')).toBe('tab');
            expect(tab.hasAttribute('aria-selected')).toBe(true);
            expect(tab.hasAttribute('aria-controls')).toBe(true);
        });

        panels.forEach(panel => {
            expect(panel.getAttribute('role')).toBe('tabpanel');
            expect(panel.hasAttribute('aria-labelledby')).toBe(true);
        });
    });

    it('should update aria-selected and tabindex on click', () => {
        const rawTab = document.getElementById('tab-raw');
        const headerTab = document.getElementById('tab-header');

        // Initial state
        expect(rawTab.getAttribute('aria-selected')).toBe('true');
        expect(rawTab.getAttribute('tabindex')).toBe('0');
        expect(headerTab.getAttribute('aria-selected')).toBe('false');
        expect(headerTab.getAttribute('tabindex')).toBe('-1');

        // Click header tab
        headerTab.click();

        // New state
        expect(rawTab.getAttribute('aria-selected')).toBe('false');
        expect(rawTab.getAttribute('tabindex')).toBe('-1');
        expect(headerTab.getAttribute('aria-selected')).toBe('true');
        expect(headerTab.getAttribute('tabindex')).toBe('0');
    });

    it('should handle keyboard navigation (ArrowRight)', () => {
        const rawTab = document.getElementById('tab-raw');
        const headerTab = document.getElementById('tab-header');

        rawTab.focus();

        // Simulate ArrowRight keydown
        const event = new KeyboardEvent('keydown', {
            key: 'ArrowRight',
            bubbles: true
        });
        rawTab.dispatchEvent(event);

        expect(document.activeElement).toBe(headerTab);
        expect(headerTab.classList.contains('active')).toBe(true);
        expect(headerTab.getAttribute('aria-selected')).toBe('true');
    });

    it('should handle keyboard navigation (ArrowLeft)', () => {
        const rawTab = document.getElementById('tab-raw');
        const payloadTab = document.getElementById('tab-payload'); // The last tab

        rawTab.focus();

        // Simulate ArrowLeft keydown (should loop to last tab)
        const event = new KeyboardEvent('keydown', {
            key: 'ArrowLeft',
            bubbles: true
        });
        rawTab.dispatchEvent(event);

        expect(document.activeElement).toBe(payloadTab);
        expect(payloadTab.classList.contains('active')).toBe(true);
        expect(payloadTab.getAttribute('aria-selected')).toBe('true');
    });

    it('should have accessible tooltip for secret key', () => {
        const tooltipButton = document.querySelector('.c-tooltip-container');
        const tooltipContent = document.getElementById('jwt-secret-tooltip');

        expect(tooltipButton.tagName).toBe('BUTTON');
        expect(tooltipButton.getAttribute('type')).toBe('button');
        expect(tooltipButton.getAttribute('aria-describedby')).toBe('jwt-secret-tooltip');
        expect(tooltipButton.getAttribute('aria-label')).toBe('More info');

        expect(tooltipContent).not.toBeNull();
        expect(tooltipContent.getAttribute('role')).toBe('tooltip');
        expect(tooltipContent.textContent).toContain('Optional - Enter the secret key');
    });
});
