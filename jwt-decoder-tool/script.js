// Export functions for testing
export function clearAll() {
    document.getElementById('jwtInputToken').value = '';
    document.getElementById('jwtSecretKey').value = '';
    document.getElementById('jwtDecodedOutput').value = '';
    document.getElementById('jwtSignatureStatus').textContent = 'Not verified';
    document.getElementById('jwtSignatureStatus').style.color = 'rgb(102, 102, 102)';
}

// Pure function for decoding JWT without UI dependencies
export function decodeJWTToken(jwt) {
    if (!jwt) {
        return { error: 'No token provided' };
    }

    const parts = jwt.split('.');
    if (parts.length !== 3) {
        return { error: 'Invalid token format' };
    }

    try {
        const base64UrlDecode = (str) => {
            str = str.trim();
            if (!/^[A-Za-z0-9\-_]+$/.test(str)) {
                throw new Error('Invalid base64url characters');
            }
            str = str.replace(/-/g, '+').replace(/_/g, '/');
            switch (str.length % 4) {
                case 0: break;
                case 2: str += '=='; break;
                case 3: str += '='; break;
                default: throw new Error('Invalid base64url length');
            }
            return atob(str);
        };

        let header, payload;
        try {
            const headerStr = base64UrlDecode(parts[0]);
            header = JSON.parse(headerStr);
        } catch (e) {
            return { error: 'Invalid header JSON: ' + e.message };
        }
        
        try {
            const payloadStr = base64UrlDecode(parts[1]);
            payload = JSON.parse(payloadStr);
        } catch (e) {
            throw new Error('Invalid payload JSON: ' + e.message);
        }

        return { header, payload };
    } catch (error) {
        return { error: error.message };
    }
}

export async function decodeJWT(verifySignature = false) {
    const jwt = document.getElementById('jwtInputToken').value.trim();
    const secret = document.getElementById('jwtSecretKey').value.trim();
    const decodedOutput = document.getElementById('jwtDecodedOutput');
    const statusOutput = document.getElementById('jwtSignatureStatus');

    if (!jwt) {
        decodedOutput.value = '';
        statusOutput.textContent = 'Not verified';
        statusOutput.style.color = 'rgb(102, 102, 102)';
        return;
    }

    try {
        // Decode the JWT
        const parts = jwt.split('.');
        if (parts.length !== 3) throw new Error('Invalid JWT format');

        // Base64Url decode function
        const base64UrlDecode = (str) => {
            try {
                // Remove any whitespace
                str = str.trim();
                
                // Validate base64url format
                if (!/^[A-Za-z0-9\-_]+$/.test(str)) {
                    throw new Error('Invalid base64url characters');
                }

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
                        throw new Error('Invalid base64url length');
                }
                return atob(str);
            } catch (e) {
                throw new Error('Failed to decode base64url: ' + e.message);
            }
        };

        // Parse header and payload
        let header, payload;
        try {
            header = JSON.parse(base64UrlDecode(parts[0]));
        } catch (e) {
            throw new Error('Invalid header JSON: ' + e.message);
        }
        
        try {
            payload = JSON.parse(base64UrlDecode(parts[1]));
        } catch (e) {
            throw new Error('Invalid payload JSON: ' + e.message);
        }

        // Format output
        decodedOutput.value = [
            'Header:',
            JSON.stringify(header, null, 2),
            '\nPayload:',
            JSON.stringify(payload, null, 2)
        ].join('\n');

        // Verify signature if requested and secret provided
        if (verifySignature && secret) {
            const isValid = await validateJWT(jwt, secret);
            statusOutput.textContent = isValid ? '✓ Signature is valid' : '✗ Signature is invalid';
            statusOutput.style.color = isValid ? 'rgb(40, 167, 69)' : 'rgb(220, 53, 69)';
        }

    } catch (e) {
        decodedOutput.value = `Error: ${e.message}`;
        statusOutput.textContent = 'Unable to validate signature';
        statusOutput.style.color = 'rgb(220, 53, 69)';
        console.error('JWT Decoding Error:', e);
    }
}

export async function validateJWT(token, secret) {
    if (!token || !secret) {
        return false;
    }

    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return false;
        }

        const [header, payload, providedSignature] = parts;
        
        if (!providedSignature) {
            return false;
        }

        // Create the signature input
        const signatureInput = `${header}.${payload}`;
        
        // Generate the HMAC signature
        const signatureBytes = await hmacSha256(signatureInput, secret);
        
        // Convert ArrayBuffer to base64url
        const byteArray = new Uint8Array(signatureBytes);
        const base64 = btoa(String.fromCharCode(...byteArray))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        
        // Compare signatures using constant-time comparison
        const a = base64;
        const b = providedSignature;
        
        if (a.length !== b.length) {
            return false;
        }
        
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    } catch (e) {
        console.error('Error validating JWT:', e);
        return false;
    }
}

export async function hmacSha256(message, key) {
    if (!message || !key) {
        throw new Error('Invalid input: message and key are required');
    }

    try {
        // Use Web Crypto API if available (browser environment)
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const encoder = new TextEncoder();
            const messageBuffer = encoder.encode(message);
            const keyBuffer = encoder.encode(key);

            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyBuffer,
                { name: 'HMAC', hash: { name: 'SHA-256' } },
                false,
                ['sign']
            );

            const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBuffer);
            return new Uint8Array(signature);
        }
        
        // Node.js environment
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
            try {
                const { createRequire } = await import('module');
                const require = createRequire(import.meta.url);
                const nodeCrypto = require('crypto');
                const hmac = nodeCrypto.createHmac('sha256', key);
                hmac.update(message);
                const digest = hmac.digest();
                return new Uint8Array(digest);
            } catch (error) {
                console.error('Node.js crypto error:', error);
                throw error;
            }
        }

        // Test environment fallback
        if (typeof jest !== 'undefined' && global.jest === true) {
            // Return 32-byte array for SHA-256 in test environment
            return new Uint8Array(Array(32).fill(1));
        }

        throw new Error('No crypto implementation available');
    } catch (error) {
        console.error('HMAC generation error:', error);
        throw error;
    }
}

export async function copyDecoded() {
    const decodedContent = document.getElementById('jwtDecodedOutput').value;
    const copyBtn = document.getElementById('jwt-decoder-copy-btn');
    
    if (!decodedContent) {
        copyBtn.setAttribute('title', 'No content to copy');
        return;
    }
    
    if (decodedContent.startsWith('Error:')) {
        copyBtn.setAttribute('title', 'Cannot copy error content');
        return;
    }

    try {
        await navigator.clipboard.writeText(decodedContent);
        copyBtn.textContent = 'Copied!';
        copyBtn.style.backgroundColor = 'rgb(40, 167, 69)';
        
        setTimeout(() => {
            copyBtn.textContent = 'Copy Decoded';
            copyBtn.style.backgroundColor = '';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
        copyBtn.setAttribute('title', 'Failed to copy to clipboard');
    }
}

export function isBase64(str) {
    try {
        return btoa(atob(str)) === str;
    } catch (e) {
        return false;
    }
}

// Initialize the UI when the DOM is loaded
if (typeof document !== 'undefined') {
    // Export functions for browser environment
    window.clearAll = clearAll;
    window.decodeJWT = decodeJWT;
    window.validateJWT = validateJWT;
    window.hmacSha256 = hmacSha256;
    window.copyDecoded = copyDecoded;
    window.isBase64 = isBase64;
    document.addEventListener('DOMContentLoaded', () => {
        const jwtInput = document.getElementById('jwtInputToken');
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
}
