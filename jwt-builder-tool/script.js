import { JWTBuilder } from './JWTBuilder.js';

// Export for testing and create a singleton instance
export const jwtBuilder = (typeof window !== 'undefined' && window.jwtBuilder) || new JWTBuilder();

// Set the jwtBuilder instance on window for use in the UI
if (typeof window !== 'undefined') {
  window.jwtBuilder = jwtBuilder;
}

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
  newClaimRow.innerHTML = `
    <div class="u-flex u-gap-sm" style="flex: 1; align-items: center;">
      <label style="flex: 0 0 100px;">
        <span class="c-tooltip-container" title="Name of your custom claim">
          Claim Name:
          <span class="c-tooltip">Enter a unique identifier for your custom claim</span>
        </span>
      </label>
      <input type="text" name="claimName" class="c-input" placeholder="e.g., role" style="flex: 1;">
      <label style="flex: 0 0 100px;">
         <span class="c-tooltip-container" title="Value of your custom claim">
           Claim Value:
           <span class="c-tooltip">Enter the value for your custom claim</span>
         </span>
      </label>
      <input type="text" name="claimValue" class="c-input" placeholder="e.g., admin" style="flex: 1;">
    </div>
    <button type="button" class="c-button c-button--danger delete-claim" onclick="removeClaim(this)" title="Remove this claim">x</button>
  `;
  customClaimsDiv.appendChild(newClaimRow);
}

export function removeClaim(button) {
  const customClaimsDiv = document.getElementById('customClaims');
  button.parentElement.remove();
  
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
  const resultDiv = document.getElementById('result');
  if (!resultDiv) return null;

  try {
    if (!key.trim()) {
      resultDiv.textContent = 'Error: Secret key is required for JWT signing';
      return null;
    }

    const jwt = await jwtBuilder.buildJWT(payload, key);
    resultDiv.textContent = jwt;
    return jwt;
  } catch (error) {
    const message = error instanceof SyntaxError ? 
      'Invalid JSON payload.' : 
      'Error building JWT: ' + error.message;
    resultDiv.textContent = message;
    return null;
  }
}

export async function copyJWT() {
  const resultDiv = document.getElementById('result');
  if (!resultDiv) return false;
  
  const jwt = resultDiv.textContent;
  if (!jwt || jwt.includes('Error')) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(jwt);
    const copyButton = document.getElementById('copyJwtBtn');
    if (copyButton) {
      const originalText = copyButton.textContent;
      copyButton.textContent = 'Copied!';
      setTimeout(() => {
        copyButton.textContent = originalText;
      }, 2000);
    }
    return true;
  } catch (err) {
    console.error('Failed to copy JWT:', err);
    return false;
  }
}

// Add functions to window for HTML use
if (typeof window !== 'undefined') {
  window.addClaim = addClaim;
  window.removeClaim = removeClaim;
  window.buildJWT = buildJWT;
  window.copyJWT = copyJWT;
}
