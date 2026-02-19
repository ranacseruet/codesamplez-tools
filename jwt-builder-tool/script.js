import { JWTBuilder } from './JWTBuilder.js';
import { NotificationManager } from '../common/notification-manager.js';
import CopyButton from '../common/copy-button/CopyButton.js';

// Export for testing and create a singleton instance
export const jwtBuilder = (typeof window !== 'undefined' && window.jwtBuilder) || new JWTBuilder();

// Set the jwtBuilder instance on window for use in the UI
if (typeof window !== 'undefined') {
  window.jwtBuilder = jwtBuilder;
}
let keyCopyButton = null;
let claimCounter = 0;
document.addEventListener('DOMContentLoaded', function() {
  const now = new Date();
  const sixMonthsFromNow = new Date(now);
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

  const payload = {
    iat: jwtBuilder.getFormattedDate(now),
    exp: jwtBuilder.getFormattedDate(sixMonthsFromNow),
    iss: "codesamplez.com",
    sub: "your-subject",
    aud: "your-audience",
    nbf: jwtBuilder.getFormattedDate(now),
    jti: "your-indentifier"
  };

  const standardClaims = ['iss', 'exp', 'sub', 'aud', 'iat', 'nbf', 'jti'];
  standardClaims.forEach(claim => {
    document.getElementById(claim)?.setAttribute('value', payload[claim]);
  });

  // Add copy button to JWT result pre element
  const resultElement = document.getElementById('result');
  if (resultElement) {
    new CopyButton(resultElement);
  }

  // Add copy button to signature key input field
  const keyInput = document.getElementById('key');
  if (keyInput) {
    keyCopyButton = new CopyButton(keyInput);
  }
});

// Export UI functions for testing
export function addClaim() {
  const customClaimsDiv = document.getElementById('customClaims');
  
  // Remove empty state message if it exists
  const emptyMessage = customClaimsDiv.querySelector('.empty-claims-message');
  if (emptyMessage) {
    emptyMessage.remove();
  }
  
  const newClaimRow = document.createElement('div');
  newClaimRow.classList.add('c-form-row', 'custom-claim-row'); 
  claimCounter++;
  const nameId = `claim-name-${claimCounter}`;
  const valueId = `claim-value-${claimCounter}`;

  newClaimRow.innerHTML = `
    <div class="u-flex u-gap-sm" style="flex: 1; align-items: center;">
      <label for="${nameId}" style="flex: 0 0 100px;">
        <span class="c-tooltip-container" title="Name of your custom claim">
          Claim Name:
          <span class="c-tooltip">Enter a unique identifier for your custom claim</span>
        </span>
      </label>
      <input id="${nameId}" type="text" name="claimName" class="c-input" placeholder="e.g., role" style="flex: 1;">
      <label for="${valueId}" style="flex: 0 0 100px;">
         <span class="c-tooltip-container" title="Value of your custom claim">
           Claim Value:
           <span class="c-tooltip">Enter the value for your custom claim</span>
         </span>
      </label>
      <input id="${valueId}" type="text" name="claimValue" class="c-input" placeholder="e.g., admin" style="flex: 1;">
    </div>
    <button type="button" class="c-button c-button--danger delete-claim" onclick="removeClaim(this)" aria-label="Remove custom claim" title="Remove this claim">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    </button>
  `;
  customClaimsDiv.appendChild(newClaimRow);

  // Focus the new claim name input for better keyboard accessibility
  const nameInput = newClaimRow.querySelector('input[name="claimName"]');
  if (nameInput) {
    nameInput.focus();
  }
}

export function removeClaim(button) {
  const customClaimsDiv = document.getElementById('customClaims');
  const addClaimBtn = document.querySelector('.add-claim');

  button.parentElement.remove();
  
  // Move focus back to "Add Claim" button to prevent focus loss
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
  const payload = {};

  // Handle datetime claims (exp, iat, nbf)
  ['exp', 'iat', 'nbf'].forEach(claim => {
    const value = document.getElementById(claim)?.value;
    if (value) {
      const timestamp = jwtBuilder.parseDateTime(value);
      if (timestamp !== null) {
        payload[claim] = timestamp;
      }
    }
  });
  
  // Handle string claims
  ['iss', 'sub', 'aud', 'jti'].forEach(claim => {
    const value = document.getElementById(claim)?.value;
    if (value?.trim()) {
      payload[claim] = value;
    }
  });

  // Handle custom claims
  const customClaims = document.querySelectorAll('#customClaims .custom-claim-row'); 
  customClaims.forEach(claimRow => {
    const name = claimRow.querySelector('input[name="claimName"]')?.value; 
    const value = claimRow.querySelector('input[name="claimValue"]')?.value;
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

  const key = document.getElementById('key')?.value || '';
  const iss = document.getElementById('iss')?.value || '';
  const exp = document.getElementById('exp')?.value || '';
  const resultDiv = document.getElementById('result');
  if (!resultDiv) return null;

  try {
    if (!key.trim()) {
      NotificationManager.show('Error: Secret key is required for JWT signing', 3000, { type: 'error' });
      resultDiv.textContent = '';
      return null;
    }
    if (!iss.trim()) {
      NotificationManager.show('Error: Issuer (iss) is required for JWT', 3000, { type: 'error' });
      resultDiv.textContent = '';
      return null;
    }
    if (!exp.trim()) {
      NotificationManager.show('Error: Expiration Time (exp) is required for JWT', 3000, { type: 'error' });
      resultDiv.textContent = '';
      return null;
    }

    const jwt = await jwtBuilder.buildJWT(payload, key);
    resultDiv.textContent = jwt;
    NotificationManager.show('JWT successfully built', 2000, { type: 'success' });
    return jwt;
  } catch (error) {
    const message = error instanceof SyntaxError ? 
      'Invalid JSON payload.' : 
      'Error building JWT: ' + error.message;
    NotificationManager.show(message, 3000, { type: 'error' });
    resultDiv.textContent = '';
    return null;
  }
}

export function generateRandomSecret() {
  const keyInput = document.getElementById('key');
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

export function setExp(hours) {
  const now = new Date();
  now.setHours(now.getHours() + hours);
  const expInput = document.getElementById('exp');
  if (expInput) {
    expInput.value = jwtBuilder.getFormattedDate(now);
  }
}

export function setNow(elementId) {
  const now = new Date();
  const input = document.getElementById(elementId);
  if (input) {
    input.value = jwtBuilder.getFormattedDate(now);
  }
}

// Add functions to window for HTML use
if (typeof window !== 'undefined') {
  window.addClaim = addClaim;
  window.removeClaim = removeClaim;
  window.buildJWT = buildJWT;
  window.generateRandomSecret = generateRandomSecret;
  window.setExp = setExp;
  window.setNow = setNow;
}
