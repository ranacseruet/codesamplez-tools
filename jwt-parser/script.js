async function parseJWT() {
    const jwt = document.getElementById('jwtInputToken').value;
    const secret = document.getElementById('jwtSecretKey').value;

    if (!jwt) {
        alert("Please enter a JWT token.");
        return;
    }

    try {
        // Decode the JWT
        const parts = jwt.split('.');
        const header = JSON.parse(atob(parts[0]));
        const payload = JSON.parse(atob(parts[1]));

        document.getElementById('jwtDecodedOutput').textContent = `Header: ${JSON.stringify(header, null, 2)}\nPayload: ${JSON.stringify(payload, null, 2)}`;

        // Validate the signature
        const isValidSignature = await validateJWT(jwt, secret);
        document.getElementById('jwtSignatureStatus').textContent = `Signature is ${isValidSignature ? 'valid' : 'invalid'}!`;

    } catch (e) {
        document.getElementById('jwtDecodedOutput').textContent = "Invalid JWT format.";
        document.getElementById('jwtSignatureStatus').textContent = "Error validating signature";
        console.error(e);
    }
}

function isBase64(str) {
    try {
        return btoa(atob(str)) === str;
    } catch (e) {
        return false;
    }
}

async function validateJWT(token, secret) {
    // Decode secret if it's base64 encoded
    if (isBase64(secret)) {
        secret = atob(secret);
    }

    const base64UrlDecode = (str) => {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) str += '=';
        return atob(str);
    };

    const base64UrlEncode = (str) => {
        return btoa(str)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    };
    try {
        const parts = token.split('.');
        const header = base64UrlDecode(parts[0]);
        const payload = base64UrlDecode(parts[1]);
        const providedSignature = parts[2];

        const signatureInput = parts[0] + '.' + parts[1];
        const signature = await hmacSha256(signatureInput, secret);
        const recreatedSignature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
        
        return recreatedSignature === providedSignature;
    } catch (e) {
        console.error('Error validating JWT:', e);
        return false;
    }
}

// Implementation of HMAC-SHA256
async function hmacSha256(message, key) {
    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(message);
    const keyBuffer = encoder.encode(key);

    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        messageBuffer
    );

    return new Uint8Array(signature);
}
