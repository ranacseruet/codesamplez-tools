const now = Math.floor(Date.now() / 1000);
const exp = now + 6 * 30 * 24 * 60 * 60; // 6 months from now

document.addEventListener('DOMContentLoaded', function() {
  const payload = {
    iat: now,
    exp: exp,
    iss: "your-issuer",
    sub: "your-subject",
    aud: "your-audience",
    nbf: now,
    jti: "your-jti"
  };

  const standardClaims = ['iss', 'exp', 'sub', 'aud', 'iat', 'nbf', 'jti'];
  standardClaims.forEach(claim => {
    document.getElementById(claim).value = payload[claim];
  });

  // ... rest of the code ...
});

async function generateSignature(header, payload, key) {
  const message = `${header}.${payload}`;
  const hmac = new TextEncoder().encode(message);
  const keyBytes = new TextEncoder().encode(key);
  const signature = await crypto.subtle.sign('HS256', keyBytes, hmac);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
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
  `;
  customClaimsDiv.appendChild(newClaimRow);
}

function buildJWT() {
  const payload = {
    iat: now,
    exp: exp,
    iss: "your-issuer",
    sub: "your-subject",
    aud: "your-audience",
    nbf: now,
    jti: "your-jti"
  };

  const standardClaims = ['iss', 'exp', 'sub', 'aud', 'iat', 'nbf', 'jti'];
  standardClaims.forEach(claim => {
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
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    const signature = generateSignature(encodedHeader, encodedPayload, key);
    const jwt = `${encodedHeader}.${encodedPayload}.${signature}`;
    resultDiv.textContent = jwt;
  } catch (error) {
    if (error instanceof SyntaxError) {
      resultDiv.textContent = 'Invalid JSON payload.';
    } else {
      resultDiv.textContent = 'Error building JWT: ' + error.message;
    }
  }
}
