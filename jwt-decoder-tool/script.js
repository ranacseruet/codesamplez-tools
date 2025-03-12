// Initialize event listeners when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const jwtInput = document.getElementById('jwtInputToken');
    const secretInput = document.getElementById('jwtSecretKey');
    const copyBtn = document.getElementById('copyDecodedBtn');

    // Add event listeners with debouncing
    let decodeTimeout;
    const debounceDecode = () => {
        clearTimeout(decodeTimeout);
        decodeTimeout = setTimeout(decodeJWT, 300);
    };

    jwtInput.addEventListener('input', debounceDecode);
    secretInput.addEventListener('input', debounceDecode);
    
    // Initialize tooltips for copy button
    copyBtn.addEventListener('mouseenter', () => {
        copyBtn.setAttribute('title', 'Copy decoded token to clipboard');
    });
});

async function decodeJWT() {
    const jwt = document.getElementById('jwtInputToken').value.trim();
    const secret = document.getElementById('jwtSecretKey').value.trim();
    const decodedOutput = document.getElementById('jwtDecodedOutput');
    const statusOutput = document.getElementById('jwtSignatureStatus');

    if (!jwt) {
        decodedOutput.textContent = '';
        statusOutput.textContent = '';
        return;
    }

    try {
        // Decode the JWT
        const parts = jwt.split('.');
        if (parts.length !== 3) throw new Error('Invalid JWT format');

        // Base64Url decode function
        const base64UrlDecode = (str) => {
            try {
                // Add padding if needed
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

        decodedOutput.textContent = formattedOutput;

        // Validate the signature if secret is provided
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

    } catch (e) {
        decodedOutput.textContent = 'Error: Invalid JWT format';
        statusOutput.textContent = 'Unable to validate signature';
        statusOutput.style.color = '#dc3545';
        console.error('JWT Decoding Error:', e);
    }
}

// Function to copy decoded token
async function copyDecoded() {
    const decodedContent = document.getElementById('jwtDecodedOutput').textContent;
    const copyBtn = document.getElementById('copyDecodedBtn');
    
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
            copyBtn.textContent = originalText;
            copyBtn.style.backgroundColor = '#2196F3';
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
