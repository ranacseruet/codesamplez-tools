import { JWTBuilder } from './JWTBuilder';
import { NotificationManager } from '../common/notification-manager';
import { registerPrimaryActionShortcut } from '../common/shortcut-utils';
import CopyButton from '../common/copy-button/CopyButton';
import { hydrate, render } from 'preact';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { JwtBuilderArticle, JwtBuilderIntro } from './content';
import toolMetadata from './tool.meta.json';

type JwtBuilderWindow = Window & {
  jwtBuilder?: JWTBuilder;
  addClaim?: () => void;
  removeClaim?: (button: HTMLElement | null) => void;
  buildJWT?: () => Promise<string | null>;
  generateRandomSecret?: () => string | null;
  setExp?: (hours: number) => void;
  setNow?: (elementId: string) => void;
  loadSampleClaims?: () => void;
};

const browserWindow = typeof window !== 'undefined' ? (window as JwtBuilderWindow) : null;

// Export for testing and create a singleton instance
export const jwtBuilder = browserWindow?.jwtBuilder || new JWTBuilder();

if (browserWindow) {
  browserWindow.jwtBuilder = jwtBuilder;
}

let keyCopyButton: CopyButton | null = null;
let claimCounter = 0;

function getInputElement(id: string): HTMLInputElement | null {
  const element = document.getElementById(id);
  return element instanceof HTMLInputElement ? element : null;
}

function getInputValue(id: string): string {
  return getInputElement(id)?.value || '';
}

// v4 contract: build errors surface inline; the empty-state well copy flips by
// toggling the dedicated element rather than relying on a bare <pre>.
function setInlineError(message: string): void {
  const status = document.getElementById('jwt-builder-error-status');
  /* istanbul ignore next */
  if (!status) {
    return;
  }
  status.textContent = message;
  status.classList.toggle('error', message.length > 0);
}

function toggleEmptyState(show: boolean): void {
  const emptyState = document.getElementById('jwt-builder-empty-state');
  if (emptyState) {
    emptyState.style.display = show ? '' : 'none';
  }
  const resultDiv = document.getElementById('result');
  if (resultDiv) {
    resultDiv.style.display = show ? 'none' : '';
  }
}

function initializeDefaultClaims() {
  const now = new Date();
  const sixMonthsFromNow = new Date(now);
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

  const payload = {
    iat: jwtBuilder.getFormattedDate(now),
    exp: jwtBuilder.getFormattedDate(sixMonthsFromNow),
    iss: 'codesamplez.com',
    sub: 'your-subject',
    aud: 'your-audience',
    nbf: jwtBuilder.getFormattedDate(now),
    jti: 'your-indentifier'
  };

  const standardClaims: (keyof typeof payload)[] = ['iss', 'exp', 'sub', 'aud', 'iat', 'nbf', 'jti'];
  standardClaims.forEach((claim) => {
    const input = getInputElement(claim);
    if (input) {
      input.value = payload[claim];
    }
  });
}

// Load Sample resets the package to the shipped defaults (standard claims +
// the bundled secret) — a uniform reset affordance across tools.
export function loadSampleClaims() {
  initializeDefaultClaims();
  const keyInput = getInputElement('key');
  if (keyInput) {
    keyInput.value = 'your-jwt-secret-key';
    keyCopyButton?.updateVisibility();
  }
  NotificationManager.show('Sample claims loaded', 2000, { type: 'success' });
}

function initializeCopyButtons() {
  const resultElement = document.getElementById('result');
  if (resultElement instanceof HTMLPreElement) {
    new CopyButton(resultElement);
  }

  const keyInput = getInputElement('key');
  if (keyInput) {
    keyCopyButton = new CopyButton(keyInput);
  }
}

export function addClaim() {
  const customClaimsDiv = document.getElementById('customClaims');
  if (!customClaimsDiv) {
    return;
  }

  const emptyMessage = customClaimsDiv.querySelector('.empty-claims-message');
  if (emptyMessage) {
    emptyMessage.remove();
  }

  const newClaimRow = document.createElement('div');
  newClaimRow.classList.add('c-form-row', 'custom-claim-row');
  claimCounter += 1;
  const nameId = `claim-name-${claimCounter}`;
  const valueId = `claim-value-${claimCounter}`;

  newClaimRow.innerHTML = `
    <div class="u-flex u-gap-sm jwt-builder-custom-claim-fields" style="flex: 1; align-items: center;">
      <label for="${nameId}" class="jwt-builder-custom-claim-label" style="flex: 0 0 100px;">
        <span class="c-tooltip-container" title="Name of your custom claim">
          Claim Name:
          <span class="c-tooltip">Enter a unique identifier for your custom claim</span>
        </span>
      </label>
      <input id="${nameId}" type="text" name="claimName" class="c-input jwt-builder-custom-claim-input" placeholder="e.g., role" style="flex: 1;">
      <label for="${valueId}" class="jwt-builder-custom-claim-label" style="flex: 0 0 100px;">
         <span class="c-tooltip-container" title="Value of your custom claim">
           Claim Value:
           <span class="c-tooltip">Enter the value for your custom claim</span>
         </span>
      </label>
      <input id="${valueId}" type="text" name="claimValue" class="c-input jwt-builder-custom-claim-input" placeholder="e.g., admin" style="flex: 1;">
    </div>
    <button type="button" class="c-button c-button--danger delete-claim" onclick="removeClaim(this)" aria-label="Remove custom claim" title="Remove this claim">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    </button>
  `;
  customClaimsDiv.appendChild(newClaimRow);

  const nameInput = newClaimRow.querySelector('input[name="claimName"]') as HTMLInputElement | null;
  if (nameInput) {
    nameInput.focus();
  }
}

export function removeClaim(button: HTMLElement | null) {
  const customClaimsDiv = document.getElementById('customClaims');
  const addClaimBtn = document.querySelector('.add-claim') as HTMLButtonElement | null;
  if (!button?.parentElement || !customClaimsDiv) {
    return;
  }

  button.parentElement.remove();

  if (addClaimBtn) {
    addClaimBtn.focus();
  }

  if (customClaimsDiv.children.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-claims-message';
    emptyMessage.textContent = 'No custom claims added yet';
    customClaimsDiv.appendChild(emptyMessage);
  }
}

export async function buildJWT() {
  const payload: Record<string, unknown> = {};

  ['exp', 'iat', 'nbf'].forEach((claim) => {
    const value = getInputValue(claim);
    if (value) {
      const timestamp = jwtBuilder.parseDateTime(value);
      if (timestamp !== null) {
        payload[claim] = timestamp;
      }
    }
  });

  ['iss', 'sub', 'aud', 'jti'].forEach((claim) => {
    const value = getInputValue(claim);
    if (value?.trim()) {
      payload[claim] = value;
    }
  });

  const customClaims = document.querySelectorAll('#customClaims .custom-claim-row');
  customClaims.forEach((claimRow) => {
    const name = (claimRow.querySelector('input[name="claimName"]') as HTMLInputElement | null)?.value;
    const value = (claimRow.querySelector('input[name="claimValue"]') as HTMLInputElement | null)?.value;
    if (name?.trim() && value?.trim()) {
      try {
        if (value.startsWith('[') || value.startsWith('{')) {
          payload[name] = JSON.parse(value);
        } else {
          payload[name] = value;
        }
      } catch {
        payload[name] = value;
      }
    }
  });

  const key = getInputValue('key');
  const iss = getInputValue('iss');
  const exp = getInputValue('exp');
  const resultDiv = document.getElementById('result');
  if (!resultDiv) {
    return null;
  }

  try {
    if (!key.trim()) {
      setInlineError('Error: Secret key is required for JWT signing');
      resultDiv.textContent = '';
      toggleEmptyState(true);
      return null;
    }
    if (!iss.trim()) {
      setInlineError('Error: Issuer (iss) is required for JWT');
      resultDiv.textContent = '';
      toggleEmptyState(true);
      return null;
    }
    if (!exp.trim()) {
      setInlineError('Error: Expiration Time (exp) is required for JWT');
      resultDiv.textContent = '';
      toggleEmptyState(true);
      return null;
    }

    const jwt = await jwtBuilder.buildJWT(payload, key);
    resultDiv.textContent = jwt;
    setInlineError('');
    toggleEmptyState(false);
    NotificationManager.show('JWT successfully built', 2000, { type: 'success' });
    return jwt;
  } catch (error: unknown) {
    const message = error instanceof SyntaxError
      ? 'Invalid JSON payload.'
      : `Error building JWT: ${error instanceof Error ? error.message : String(error)}`;
    setInlineError(message);
    resultDiv.textContent = '';
    toggleEmptyState(true);
    return null;
  }
}

export function generateRandomSecret() {
  const keyInput = getInputElement('key');
  if (keyInput) {
    const randomSecret = jwtBuilder.generateRandomSecret(32);
    keyInput.value = randomSecret;
    if (keyCopyButton) {
      keyCopyButton.updateVisibility();
    }
    NotificationManager.show('Random secret generated', 2000, { type: 'success' });
    return randomSecret;
  }
  return null;
}

export function setExp(hours: number) {
  const now = new Date();
  now.setHours(now.getHours() + hours);
  const expInput = getInputElement('exp');
  if (expInput) {
    expInput.value = jwtBuilder.getFormattedDate(now);
  }
}

export function setNow(elementId: string) {
  const now = new Date();
  const input = getInputElement(elementId);
  if (input) {
    input.value = jwtBuilder.getFormattedDate(now);
  }
}

if (browserWindow) {
  browserWindow.addClaim = addClaim;
  browserWindow.removeClaim = removeClaim;
  browserWindow.buildJWT = buildJWT;
  browserWindow.generateRandomSecret = generateRandomSecret;
  browserWindow.setExp = setExp;
  browserWindow.setNow = setNow;
}

export function JwtBuilderApp() {
  return (
    <div id="jwt-builder-tool" className="tool-container jwt-builder-container c-tool-stack">
      <div id="notification" className="c-notification" role="status" aria-live="polite" />

      <form id="jwtForm" className="u-flex u-flex-column u-gap-lg jwt-builder-form" onSubmit={(e) => e.preventDefault()}>
        <div className="o-grid-2col jwt-builder-grid">
          <div className="c-form-group jwt-builder-section jwt-builder-section--identity">
            <h3 className="c-form-group-header">Identity Claims</h3>
            <div className="c-form-row">
              <label htmlFor="iss" className="required">
                <span className="c-tooltip-container" title="Who issued the token">
                  Issuer (iss):
                  <span className="c-tooltip">Required - Identifies the principal that issued the JWT</span>
                </span>
              </label>
              <input type="text" id="iss" className="c-input" placeholder="e.g., my-app" />
            </div>
            <div className="c-form-row">
              <label htmlFor="sub">
                <span className="c-tooltip-container" title="Who the token refers to">
                  Subject (sub):
                  <span className="c-tooltip">Optional - Identifies the principal that is the subject of the JWT</span>
                </span>
              </label>
              <input type="text" id="sub" className="c-input" placeholder="e.g., user123" />
            </div>
            <div className="c-form-row">
              <label htmlFor="aud">
                <span className="c-tooltip-container" title="Who the token is intended for">
                  Audience (aud):
                  <span className="c-tooltip">Optional - Identifies the recipients that the JWT is intended for</span>
                </span>
              </label>
              <input type="text" id="aud" className="c-input" placeholder="e.g., my-api" />
            </div>
          </div>

          <div className="c-form-group jwt-builder-section jwt-builder-section--timing">
            <h3 className="c-form-group-header">Timing Claims</h3>
            <div className="c-form-row">
              <label htmlFor="exp" className="required">
                <span className="c-tooltip-container" title="When the token expires">
                  Expiration Time (exp):
                  <span className="c-tooltip">Required - Identifies the expiration time on or after which the JWT must not be accepted</span>
                </span>
              </label>
              <div className="u-flex u-flex-column u-gap-xs jwt-builder-inline-actions" style={{ flex: 1 }}>
                <input type="text" id="exp" className="c-input" placeholder="e.g., 2025-12-31T23:59:59Z or 1678886400" />
                <div className="quick-set-buttons jwt-builder-quick-set-buttons">
                  <button type="button" className="c-button c-button--secondary c-button--small jwt-builder-quick-set-btn" onClick={() => setExp(1)} aria-label="Set expiration to 1 hour from now">+1h</button>
                  <button type="button" className="c-button c-button--secondary c-button--small jwt-builder-quick-set-btn" onClick={() => setExp(24)} aria-label="Set expiration to 24 hours from now">+24h</button>
                  <button type="button" className="c-button c-button--secondary c-button--small jwt-builder-quick-set-btn" onClick={() => setExp(168)} aria-label="Set expiration to 7 days from now">+7d</button>
                </div>
              </div>
            </div>
            <div className="c-form-row">
              <label htmlFor="iat">
                <span className="c-tooltip-container" title="When the token was issued">
                  Issued At (iat):
                  <span className="c-tooltip">Optional - Identifies the time at which the JWT was issued</span>
                </span>
              </label>
              <div className="u-flex u-flex-column u-gap-xs jwt-builder-inline-actions" style={{ flex: 1 }}>
                <input type="text" id="iat" className="c-input" placeholder="e.g., 2025-01-30T11:24:00Z or 1678886400" />
                <div className="quick-set-buttons jwt-builder-quick-set-buttons">
                  <button type="button" className="c-button c-button--secondary c-button--small jwt-builder-quick-set-btn" onClick={() => setNow('iat')} aria-label="Set issued at to now">Now</button>
                </div>
              </div>
            </div>
            <div className="c-form-row">
              <label htmlFor="nbf">
                <span className="c-tooltip-container" title="When the token starts being valid">
                  Not Before (nbf):
                  <span className="c-tooltip">Optional - Identifies the time before which the JWT must not be accepted</span>
                </span>
              </label>
              <div className="u-flex u-flex-column u-gap-xs jwt-builder-inline-actions" style={{ flex: 1 }}>
                <input type="text" id="nbf" className="c-input" placeholder="e.g., 2025-01-30T00:00:00Z or 1678886400" />
                <div className="quick-set-buttons jwt-builder-quick-set-buttons">
                  <button type="button" className="c-button c-button--secondary c-button--small jwt-builder-quick-set-btn" onClick={() => setNow('nbf')} aria-label="Set not before to now">Now</button>
                </div>
              </div>
            </div>
          </div>

          <div className="c-form-group jwt-builder-section jwt-builder-section--metadata">
            <h3 className="c-form-group-header">Metadata Claims</h3>
            <div className="c-form-row">
              <label htmlFor="jti">
                <span className="c-tooltip-container" title="Unique identifier for this token">
                  JWT ID (jti):
                  <span className="c-tooltip">Optional - Provides a unique identifier for the JWT</span>
                </span>
              </label>
              <input type="text" id="jti" className="c-input" placeholder="e.g., unique-id" />
            </div>
          </div>

          <div className="c-form-group jwt-builder-section jwt-builder-section--signature">
            <h3 className="c-form-group-header">Signature</h3>
            <div className="c-form-row jwt-builder-secret-row">
              <label htmlFor="key" className="required">
                <span className="c-tooltip-container" title="Secret key for signing the JWT">
                  Signature Key:
                  <span className="c-tooltip">Required - The secret key used to sign the JWT. Keep this secure and never share it.</span>
                </span>
              </label>
              <input type="text" id="key" className="c-input" value="your-jwt-secret-key" placeholder="Your secret key" />
              <button
                type="button"
                className="c-button c-button--secondary c-button--small jwt-builder-secret-generate"
                onClick={() => generateRandomSecret()}
                aria-label="Generate a random secret key"
                title="Generate a random secret key"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                  <path d="M19.146 4.854l-1.489 1.489A8 8 0 1 0 12 20a8.094 8.094 0 0 0 7.371-4.886 1 1 0 1 0-1.842-.779A6.071 6.071 0 0 1 12 18a6 6 0 1 1 4.243-10.243l-1.39 1.39a.5.5 0 0 0 .354.854H19.5A.5.5 0 0 0 20 9.5V5.207a.5.5 0 0 0-.854-.353z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="c-form-group jwt-builder-algorithm-panel">
          <p className="algorithm-info">NOTE: For signature key signing, we only support "HS256 (HMAC with SHA-256)" algorithm for now.</p>
        </div>

        <div className="c-form-group jwt-builder-section jwt-builder-section--custom-claims">
          <h3 className="c-form-group-header">
            <span>Custom Claims</span>
            <button type="button" className="c-button c-button--secondary c-button--small add-claim" onClick={() => addClaim()} title="Add a custom claim">
              + Add Claim
            </button>
          </h3>
          <div id="customClaims" className="u-flex u-flex-column u-gap-md">
            <div className="empty-claims-message">No custom claims added yet</div>
          </div>
        </div>

        <div className="jwt-builder-actions c-action-strip">
          <button type="button" id="jwt-builder-sample-btn" className="c-button c-button--ghost jwt-builder-sample-btn" onClick={() => void loadSampleClaims()}>
            Load Sample
          </button>
          <span className="c-toolbar__spacer" />
          <button type="button" id="buildJwtBtn" className="c-button jwt-builder-build-btn" onClick={() => void buildJWT()}>
            Build JWT
            <span className="c-kbd" aria-hidden="true">⌘⏎</span>
          </button>
        </div>

        <div id="jwt-builder-error-status" className="c-input-status jwt-builder-error-status" role="status" aria-live="polite" />
      </form>

      <div className="c-form-group result-section jwt-builder-result-panel c-surface-card">
        <h3 className="c-form-group-header">Generated JWT</h3>
        <div className="u-flex u-gap-sm result-container jwt-builder-result-container">
          <div id="jwt-builder-empty-state" className="c-empty-state">
            <span className="c-empty-state__icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M9 13h6M9 17h6" />
              </svg>
            </span>
            <p className="c-empty-state__message">Generated JWT will appear here</p>
            <p className="c-empty-state__hint">Fill the claims or load the sample, then run Build JWT.</p>
          </div>
          <pre id="result" className="c-code-output jwt-token-output" title="Generated JWT token" style={{ display: 'none' }} />
        </div>
      </div>

      {/* Tool-first ordering: About intro + guide below the interactive tool. */}
      <JwtBuilderIntro />
      <JwtBuilderArticle />
    </div>
  );
}

export function initializeJwtBuilderDom() {
  initializeDefaultClaims();
  initializeCopyButtons();
  const buildButton = document.getElementById('buildJwtBtn');
  if (buildButton) {
    registerPrimaryActionShortcut(buildButton);
  }
  return jwtBuilder;
}

export class JWTBuilderToolUI {
  builder: JWTBuilder;

  constructor(rootSelector = '#jwt-builder-app') {
    const root = document.querySelector(rootSelector) || document.querySelector('#jwt-builder-tool');
    if (!root) {
      throw new Error('JWT Builder root element not found');
    }

    const mount = root.hasChildNodes() ? hydrate : render;
    mount(<JwtBuilderApp />, root);
    this.builder = initializeJwtBuilderDom();
  }
}

function bootstrapJwtBuilderPage() {
  mountToolShell({
    title: toolMetadata.title,
    description: toolMetadata.description,
    homeHref: '/'
  });

  const hasAppRoot = Boolean(document.getElementById('jwt-builder-app') || document.getElementById('jwt-builder-tool'));
  if (hasAppRoot) {
    try {
      new JWTBuilderToolUI();
      return;
    } catch (error) {
      console.error('JWT builder UI bootstrap failed:', error);
    }
  }

  initializeJwtBuilderDom();
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', bootstrapJwtBuilderPage);
}
