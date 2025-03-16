import { base64ToBase64Url, encodeBase64 } from './base64.js';

export function getFormattedDate(date) {
  return date.toISOString().slice(0, 19) + 'Z';
}

export function parseDateTime(value) {
  // If it's already a numeric timestamp, return it
  if (!isNaN(value) && value.trim() !== '') {
    return parseInt(value, 10);
  }
  
  try {
    // Try to parse as a datetime string
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return Math.floor(date.getTime() / 1000);
    }
  } catch (e) {
    console.error('Error parsing date:', e);
  }
  
  return null;
}


document.addEventListener('DOMContentLoaded', function() {
  const now = new Date();
  const sixMonthsFromNow = new Date(now);
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

  const payload = {
    iat: getFormattedDate(now),
    exp: getFormattedDate(sixMonthsFromNow),
    iss: "codesamplez.com",
    sub: "your-subject",
    aud: "your-audience",
    nbf: getFormattedDate(now),
    jti: "your-indentifier"
  };

  const standardClaims = ['iss', 'exp', 'sub', 'aud', 'iat', 'nbf', 'jti'];
  standardClaims.forEach(claim => {
    document.getElementById(claim).value = payload[claim];
  });
});

export function uint8ArrayToString(array) {
  const CHUNK_SIZE = 8192; // Process in chunks to avoid call stack limits
  let result = '';
  for (let i = 0; i < array.length; i++) {
    const byte = array[i];
    if ((byte & 0x80) === 0) {
      // ASCII character
      result += String.fromCharCode(byte);
    } else if ((byte & 0xe0) === 0xc0) {
      // 2-byte UTF-8 sequence
      const byte2 = array[++i];
      const codePoint = ((byte & 0x1f) << 6) | (byte2 & 0x3f);
      result += String.fromCharCode(codePoint);
    } else if ((byte & 0xf0) === 0xe0) {
      // 3-byte UTF-8 sequence
      const byte2 = array[++i];
      const byte3 = array[++i];
      const codePoint = ((byte & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f);
      result += String.fromCharCode(codePoint);
    } else if ((byte & 0xf8) === 0xf0) {
      // 4-byte UTF-8 sequence
      const byte2 = array[++i];
      const byte3 = array[++i];
      const byte4 = array[++i];
      let codePoint = ((byte & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);
      // Convert to UTF-16 surrogate pairs
      codePoint -= 0x10000;
      result += String.fromCharCode(
        (codePoint >> 10) + 0xd800,
        (codePoint & 0x3ff) + 0xdc00
      );
    }
  }
  return result;
}

export function base64UrlEncode(input) {
  let data;
  if (input instanceof ArrayBuffer) {
    data = new Uint8Array(input);
  } else if (input instanceof Uint8Array) {
    data = input;
  } else {
    // For strings, convert to UTF-8 bytes first
    data = new TextEncoder().encode(input);
  }
  
  const base64 = encodeBase64(data);
  return base64ToBase64Url(base64);
}

export async function generateSignature(signingInput, key) {
  if (!signingInput || !key) {
    throw new Error('Both signing input and key are required');
  }

  try {
    // Import the key for HMAC-SHA256
    const keyBytes = new TextEncoder().encode(key);
    const cryptoKey = await global.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Sign the input
    const messageBytes = new TextEncoder().encode(signingInput);
    const signatureBytes = await global.crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      messageBytes
    );
    
    // Convert the signature bytes to base64url
    return base64UrlEncode(signatureBytes);
  } catch (error) {
    console.error('Error generating signature:', error);
    throw error;
  }
}

export async function buildJWT(customPayload = null, secretKey = '') {
  try {
    if (!secretKey?.trim()) {
      throw new Error('Secret key is required for JWT signing');
    }

    let payload;
    if (customPayload) {
      payload = { ...customPayload };
    } else {
      const now = new Date();
      const sixMonthsFromNow = new Date(now);
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

      payload = {
        iat: Math.floor(now.getTime() / 1000),
        exp: Math.floor(sixMonthsFromNow.getTime() / 1000),
        iss: "your-issuer",
        sub: "your-subject",
        aud: "your-audience",
        nbf: Math.floor(now.getTime() / 1000),
        jti: "your-jti"
      };

      // Only process DOM elements if they exist
      if (typeof document !== 'undefined') {
        // Handle datetime claims (exp, iat, nbf)
        ['exp', 'iat', 'nbf'].forEach(claim => {
          const element = document.getElementById(claim);
          if (element) {
            const timestamp = parseDateTime(element.value);
            if (timestamp !== null) {
              payload[claim] = timestamp;
            }
          }
        });
        
        // Handle string claims
        ['iss', 'sub', 'aud', 'jti'].forEach(claim => {
          const element = document.getElementById(claim);
          if (element && element.value.trim() !== "") {
            payload[claim] = element.value;
          }
        });

        const customClaims = document.querySelectorAll('#customClaims .claim-row');
        customClaims.forEach(claimRow => {
          const name = claimRow.querySelector('input[type="text"][name="claimName"]')?.value;
          const value = claimRow.querySelector('input[type="text"][name="claimValue"]')?.value;
          if (name?.trim() && value?.trim()) {
            try {
              // Try to parse as JSON if it looks like an array or object
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
      }
    }

    // Create and encode the header
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerB64 = base64UrlEncode(JSON.stringify(header));
    
    // Encode the payload
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    
    // Create the signing input (encoded header + "." + encoded payload)
    const signingInput = `${headerB64}.${payloadB64}`;
    
    // Generate the signature
    const signature = await generateSignature(signingInput, secretKey);
    
    // Combine all parts to create the final JWT
    const jwt = `${headerB64}.${payloadB64}.${signature}`;
    
    if (typeof document !== 'undefined' && document.getElementById('result')) {
      document.getElementById('result').textContent = jwt;
    }
    
    return jwt;
  } catch (error) {
    const errorMessage = error instanceof SyntaxError ? 
      'Invalid JSON payload.' : 
      error.message;
    
    if (typeof document !== 'undefined' && document.getElementById('result')) {
      document.getElementById('result').textContent = errorMessage;
    }
    throw error;
  }
}

// Expose functions to global scope for webpack bundling
window.addClaim = function() {
  const customClaimsDiv = document.getElementById('customClaims');
  
  // Remove empty state message if it exists
  const emptyMessage = customClaimsDiv.querySelector('.empty-claims-message');
  if (emptyMessage) {
    emptyMessage.remove();
  }
  
  const newClaimRow = document.createElement('div');
  newClaimRow.classList.add('claim-row');
  newClaimRow.innerHTML = `
    <label for="claimName" title="Name of your custom claim">
      Claim Name:
      <span class="tooltip">Enter a unique identifier for your custom claim</span>
    </label>
    <input type="text" name="claimName" class="jwt-builder-input" placeholder="e.g., role, permissions">
    <label for="claimValue" title="Value of your custom claim">
      Claim Value:
      <span class="tooltip">Enter the value for your custom claim</span>
    </label>
    <input type="text" name="claimValue" class="jwt-builder-input" placeholder="e.g., admin, ['read', 'write']">
    <button type="button" class="delete-claim" onclick="removeClaim(this)" title="Remove this claim">x</button>
  `;
  customClaimsDiv.appendChild(newClaimRow);
};

window.removeClaim = function(button) {
  const customClaimsDiv = document.getElementById('customClaims');
  button.parentElement.remove();
  
  // Show empty state message if no claims exist
  if (customClaimsDiv.children.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-claims-message';
    emptyMessage.textContent = 'No custom claims added yet';
    customClaimsDiv.appendChild(emptyMessage);
  }
};

window.buildJWT = async function() {
  const now = new Date();
  const sixMonthsFromNow = new Date(now);
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

  const payload = {
    iat: Math.floor(now.getTime() / 1000),
    exp: Math.floor(sixMonthsFromNow.getTime() / 1000),
    iss: "your-issuer",
    sub: "your-subject",
    aud: "your-audience",
    nbf: Math.floor(now.getTime() / 1000),
    jti: "your-jti"
  };

  // Handle datetime claims (exp, iat, nbf)
  ['exp', 'iat', 'nbf'].forEach(claim => {
    const value = document.getElementById(claim).value;
    const timestamp = parseDateTime(value);
    if (timestamp !== null) {
      payload[claim] = timestamp;
    }
  });
  
  // Handle string claims
  ['iss', 'sub', 'aud', 'jti'].forEach(claim => {
    const value = document.getElementById(claim).value;
    if (value.trim() !== "") {
      payload[claim] = value;
    }
  });

  const customClaims = document.querySelectorAll('#customClaims .claim-row');
  customClaims.forEach(claimRow => {
    const name = claimRow.querySelector('input[type="text"][name="claimName"]').value;
    const value = claimRow.querySelector('input[type="text"][name="claimValue"]').value;
    if (name.trim() !== "" && value.trim() !== "") {
      payload[name] = value;
    }
  });

  const key = document.getElementById('key').value;
  const resultDiv = document.getElementById('result');

  try {
    if (!key.trim()) {
      resultDiv.textContent = 'Error: Secret key is required for JWT signing';
      return;
    }

    // Create and encode the header
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerB64 = base64UrlEncode(JSON.stringify(header));
    
    // Encode the payload
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    
    // Create the signing input (encoded header + "." + encoded payload)
    const signingInput = `${headerB64}.${payloadB64}`;
    
    // Generate the signature
    const signature = await generateSignature(signingInput, key);
    
    // Combine all parts to create the final JWT
    const jwt = `${headerB64}.${payloadB64}.${signature}`;
    resultDiv.textContent = jwt;
  } catch (error) {
    if (error instanceof SyntaxError) {
      resultDiv.textContent = 'Invalid JSON payload.';
    } else {
      resultDiv.textContent = 'Error building JWT: ' + error.message;
    }
  }
};

window.copyJWT = async function() {
  const resultDiv = document.getElementById('result');
  const jwt = resultDiv.textContent;
  
  if (!jwt || jwt.includes('Error')) {
    return; // Don't copy if there's no JWT or if there's an error message
  }

  try {
    await navigator.clipboard.writeText(jwt);
    const copyButton = document.getElementById('copyJwtBtn');
    const originalText = copyButton.textContent;
    copyButton.textContent = 'Copied!';
    
    // Reset button text after 2 seconds
    setTimeout(() => {
      copyButton.textContent = originalText;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy JWT:', err);
  }
};
