function getFormattedDate(date) {
  return date.toISOString().slice(0, 19) + 'Z';
}

function parseDateTime(value) {
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

  // ... rest of the code ...
});

function uint8ArrayToString(array) {
  const CHUNK_SIZE = 8192; // Process in chunks to avoid call stack limits
  let result = '';
  for (let i = 0; i < array.length; i += CHUNK_SIZE) {
    const chunk = array.subarray(i, i + CHUNK_SIZE);
    result += String.fromCharCode.apply(null, chunk);
  }
  return result;
}

function base64UrlEncode(input) {
  let data;
  if (input instanceof ArrayBuffer) {
    data = new Uint8Array(input);
  } else if (input instanceof Uint8Array) {
    data = input;
  } else {
    // For strings, convert to UTF-8 bytes first
    data = new TextEncoder().encode(input);
  }
  
  // Convert Uint8Array to string in chunks
  const binary = uint8ArrayToString(data);
  
  // Convert to base64 and then to base64url
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generateSignature(signingInput, key) {
  try {
    console.log('Generating signature for input:', signingInput);
    console.log('Using key:', key);
    
    // Import the key for HMAC-SHA256
    const keyBytes = new TextEncoder().encode(key);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Sign the input
    const messageBytes = new TextEncoder().encode(signingInput);
    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      messageBytes
    );
    
    // Convert the signature bytes to base64url
    const signature = base64UrlEncode(signatureBytes);
    console.log('Generated signature:', signature);
    return signature;
    
  } catch (error) {
    console.error('Error generating signature:', error);
    console.error('Error details:', {
      signingInput,
      keyLength: key.length,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack
    });
    throw error;
  }
}

function addClaim() {
  const customClaimsDiv = document.getElementById('customClaims');
  const newClaimRow = document.createElement('div');
  newClaimRow.classList.add('claim-row');
  newClaimRow.innerHTML = `
    <label for="claimName">Claim Name:</label>
    <input type="text" name="claimName">
    <label for="claimValue">Claim Value:</label>
    <input type="text" name="claimValue">
    <button type="button" class="delete-claim" onclick="this.parentElement.remove()">X</button>
  `;
  customClaimsDiv.appendChild(newClaimRow);
}

async function buildJWT() {
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
}

async function copyJWT() {
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
}
