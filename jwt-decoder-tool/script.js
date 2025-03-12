document.addEventListener('DOMContentLoaded', () => {
    const jwtInput = document.getElementById('jwtInputToken');
    const secretInput = document.getElementById('jwtSecretKey');
    const decodedOutput = document.getElementById('jwtDecodedOutput');
    const statusOutput = document.getElementById('jwtSignatureStatus');
    const decodeBtn = document.getElementById('jwt-decoder-decode-btn');
    const verifyBtn = document.getElementById('jwt-decoder-verify-btn');
    const copyBtn = document.getElementById('jwt-decoder-copy-btn');
    const clearBtn = document.getElementById('jwt-decoder-clear-btn');

    // Add event listeners with debouncing for auto-decode
    let decodeTimeout;
    const debounceDecode = () => {
        clearTimeout(decodeTimeout);
        decodeTimeout = setTimeout(() => decodeJWT(false), 300);
    };

    jwtInput.addEventListener('input', debounceDecode);
    
    // Button event listeners
    decodeBtn.addEventListener('click', () => decodeJWT(false));
    verifyBtn.addEventListener('click', () => decodeJWT(true));
    copyBtn.addEventListener('click', copyDecoded);
    clearBtn.addEventListener('click', clearAll);

    // Initialize tooltips
    copyBtn.setAttribute('title', 'Copy decoded token to clipboard');
});

function clearAll() {
    document.getElementById('jwtInputToken').value = '';
    document.getElementById('jwtSecretKey').value = '';
    document.getElementById('jwtDecodedOutput').value = '';
    document.getElementById('jwtSignatureStatus').textContent = 'Not verified';
    document.getElementById('jwtSignatureStatus').style.color = '#666';
}

async function decodeJWT(verifySignature = false) {
    const jwt = document.getElementById('jwtInputToken').value.trim();
    const secret = document.getElementById('jwtSecretKey').value.trim();
    const decodedOutput = document.getElementById('jwtDecodedOutput');
    const statusOutput = document.getElementById('jwtSignatureStatus');

    if (!jwt) {
        decodedOutput.value = '';
        statusOutput.textContent = 'Not verified';
        statusOutput.style.color = '#666';
        return;
    }

    try {
        // Decode the JWT
        const parts = jwt.split('.');
        if (parts.length !== 3) throw new Error('Invalid JWT format');

        // Base64Url decode function
        const base64UrlDecode = (str) => {
            try {
                str = str.replace(/-/g, '+').replace(/_/g, '/');
                switch (str.length % 4) {
                    case 0:
                        break;
                    case 2:
                        str += '==';
                        break;
                    case 3:
                        str += '=';
                        break;
                    default:
                        throw new Error('Invalid base64url string');
                }
                const decoded = atob(str);
                return decoded;
            } catch (e) {
                throw new Error('Failed to decode base64url: ' + e.message);
            }
        };

        const header = JSON.parse(base64UrlDecode(parts[0]));
        const payload = JSON.parse(base64UrlDecode(parts[1]));

        // Format the output with proper indentation and sections
        const formattedOutput = [
            'Header:',
            JSON.stringify(header, null, 2),
            '\nPayload:',
            JSON.stringify(payload, null, 2)
        ].join('\n');

        decodedOutput.value = formattedOutput;

        // Validate the signature if requested and secret is provided
        if (verifySignature) {
            if (secret) {
                const isValidSignature = await validateJWT(jwt, secret);
                statusOutput.textContent = isValidSignature 
                    ? '✓ Signature is valid'
                    : '✗ Signature is invalid';
                statusOutput.style.color = isValidSignature ? '#28a745' : '#dc3545';
            } else {
                statusOutput.textContent = 'ℹ Enter a secret key to verify signature';
                statusOutput.style.color = '#6c757d';
            }
        }

    } catch (e) {
        decodedOutput.value = 'Error: Invalid JWT format';
        statusOutput.textContent = 'Unable to validate signature';
        statusOutput.style.color = '#dc3545';
        console.error('JWT Decoding Error:', e);
    }
}

async function copyDecoded() {
    const decodedContent = document.getElementById('jwtDecodedOutput').value;
    const copyBtn = document.getElementById('jwt-decoder-copy-btn');
    
    if (!decodedContent || decodedContent.includes('Error:')) {
        copyBtn.setAttribute('title', 'No valid content to copy');
        return;
    }

    try {
        await navigator.clipboard.writeText(decodedContent);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        copyBtn.style.backgroundColor = '#28a745';
        
        setTimeout(() => {
            copyBtn.textContent = 'Copy Decoded';
            copyBtn.style.backgroundColor = '';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
        copyBtn.setAttribute('title', 'Failed to copy to clipboard');
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
