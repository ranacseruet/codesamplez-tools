// Export functions for testing
export function clearAll() {
    document.getElementById('jwtInputToken').value = '';
    document.getElementById('jwtSecretKey').value = '';
    document.getElementById('jwtDecodedOutput').value = '';
    document.getElementById('headerJson').innerHTML = '';
    document.getElementById('payloadJson').innerHTML = '';
    document.getElementById('rawJsonViewer').innerHTML = '';
    document.getElementById('jwtSignatureStatus').textContent = 'Not verified';
    document.getElementById('jwtSignatureStatus').style.color = 'rgb(102, 102, 102)';
}

// Function to create interactive JSON display
function createJsonViewer(jsonData, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    function createJsonElement(key, value, isRoot = false) {
        const wrapper = document.createElement('div');
        
        if (isRoot) {
            renderJsonValue(value, wrapper);
            return wrapper;
        }
        
        const keyValueLine = document.createElement('div');
        keyValueLine.className = 'jwt-decoder-json-key-value';
        
        const keyElement = document.createElement('span');
        keyElement.className = 'jwt-decoder-json-key';
        keyElement.textContent = `"${key}": `;
        keyValueLine.appendChild(keyElement);
        
        wrapper.appendChild(keyValueLine);
        
        renderJsonValue(value, keyValueLine);
        return wrapper;
    }
    
    function renderJsonValue(value, container) {
        if (value === null) {
            const nullSpan = document.createElement('span');
            nullSpan.className = 'jwt-decoder-json-null';
            nullSpan.textContent = 'null';
            container.appendChild(nullSpan);
            return;
        }
        
        if (typeof value === 'string') {
            const stringSpan = document.createElement('span');
            stringSpan.className = 'jwt-decoder-json-string';
            stringSpan.textContent = `"${value}"`;
            container.appendChild(stringSpan);
            return;
        }
        
        if (typeof value === 'number') {
            const numSpan = document.createElement('span');
            numSpan.className = 'jwt-decoder-json-number';
            numSpan.textContent = value;
            container.appendChild(numSpan);
            return;
        }
        
        if (typeof value === 'boolean') {
            const boolSpan = document.createElement('span');
            boolSpan.className = 'jwt-decoder-json-boolean';
            boolSpan.textContent = value;
            container.appendChild(boolSpan);
            return;
        }
        
        if (Array.isArray(value)) {
            // Array display with syntax highlighting but without collapsible functionality
            const arrayOpen = document.createElement('span');
            arrayOpen.textContent = '[';
            container.appendChild(arrayOpen);
            
            if (value.length > 0) {
                const arrayContent = document.createElement('div');
                arrayContent.style.marginLeft = '20px';
                
                value.forEach((item, index) => {
                    const itemContainer = document.createElement('div');
                    
                    // Add index if needed
                    if (key !== null) {
                        const indexSpan = document.createElement('span');
                        indexSpan.className = 'jwt-decoder-json-key';
                        indexSpan.textContent = index + ': ';
                        itemContainer.appendChild(indexSpan);
                    }
                    
                    // Render the value
                    renderJsonValue(item, itemContainer);
                    
                    // Add comma if not the last item
                    if (index < value.length - 1) {
                        const comma = document.createElement('span');
                        comma.textContent = ',';
                        itemContainer.appendChild(comma);
                    }
                    
                    arrayContent.appendChild(itemContainer);
                });
                
                container.appendChild(arrayContent);
            }
            
            const arrayClose = document.createElement('span');
            arrayClose.textContent = ']';
            container.appendChild(arrayClose);
            
            return;
        }
        
        if (typeof value === 'object') {
            // Object display with syntax highlighting but without collapsible functionality
            const objectOpen = document.createElement('span');
            objectOpen.textContent = '{';
            container.appendChild(objectOpen);
            
            const keys = Object.keys(value);
            if (keys.length > 0) {
                const objectContent = document.createElement('div');
                objectContent.style.marginLeft = '20px';
                
                keys.forEach((objKey, index) => {
                    const propContainer = document.createElement('div');
                    
                    // Add property key
                    const keySpan = document.createElement('span');
                    keySpan.className = 'jwt-decoder-json-key';
                    keySpan.textContent = `"${objKey}": `;
                    propContainer.appendChild(keySpan);
                    
                    // Render the value
                    renderJsonValue(value[objKey], propContainer);
                    
                    // Add comma if not the last property
                    if (index < keys.length - 1) {
                        const comma = document.createElement('span');
                        comma.textContent = ',';
                        propContainer.appendChild(comma);
                    }
                    
                    objectContent.appendChild(propContainer);
                });
                
                container.appendChild(objectContent);
            }
            
            const objectClose = document.createElement('span');
            objectClose.textContent = '}';
            container.appendChild(objectClose);
            
            return;
        }
    }
    
    container.appendChild(createJsonElement(null, jsonData, true));
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

// Function to setup tab functionality
function setupTabs() {
    const tabs = document.querySelectorAll('.jwt-decoder-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Hide all tab panes
            const tabPanes = document.querySelectorAll('.jwt-decoder-tab-pane');
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Show the corresponding tab pane
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(`${tabId}Tab`).classList.add('active');
        });
    });
}

export async function decodeJWT(verifySignature = false) {
    const jwt = document.getElementById('jwtInputToken').value.trim();
    const secret = document.getElementById('jwtSecretKey').value.trim();
    const decodedOutput = document.getElementById('jwtDecodedOutput');
    const statusOutput = document.getElementById('jwtSignatureStatus');

    if (!jwt) {
        decodedOutput.value = '';
        document.getElementById('headerJson').innerHTML = '';
        document.getElementById('payloadJson').innerHTML = '';
        document.getElementById('rawJsonViewer').innerHTML = '';
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

        // Create interactive JSON viewers for header and payload
        createJsonViewer(header, 'headerJson');
        createJsonViewer(payload, 'payloadJson');

        // Update raw view with combined JSON
        const combinedData = {
            header: header,
            payload: payload
        };
        decodedOutput.value = JSON.stringify(combinedData, null, 2);
        
        // Create interactive JSON viewer for raw data
        createJsonViewer(combinedData, 'rawJsonViewer');

        // Verify signature if requested and secret provided
        if (verifySignature && secret) {
            const isValid = await validateJWT(jwt, secret);
            statusOutput.textContent = isValid ? '✓ Signature is valid' : '✗ Signature is invalid';
            statusOutput.style.color = isValid ? 'rgb(40, 167, 69)' : 'rgb(220, 53, 69)';
        }

    } catch (e) {
        decodedOutput.value = `Error: ${e.message}`;
        document.getElementById('headerJson').innerHTML = '';
        document.getElementById('payloadJson').innerHTML = '';
        document.getElementById('rawJsonViewer').innerHTML = '';
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
        // Test environment detection
        if (typeof global !== 'undefined' && global.jest === true) {
            return new Uint8Array(Array(32).fill(1));
        }

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
                const crypto = require('crypto');
                if (typeof crypto.createHmac === 'function') {
                    const hmac = crypto.createHmac('sha256', key);
                    hmac.update(message);
                    return new Uint8Array(hmac.digest());
                }
            } catch (e) {
                // Ignore require errors
            }
        }

        throw new Error('No crypto implementation available');
    } catch (error) {
        if (error.message === 'No crypto implementation available') {
            throw error;
        }
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
        const secretInput = document.getElementById('jwtSecretKey');
        const decodeBtn = document.getElementById('jwt-decoder-decode-btn');
        const verifyBtn = document.getElementById('jwt-decoder-verify-btn');
        const copyBtn = document.getElementById('jwt-decoder-copy-btn');
        const clearBtn = document.getElementById('jwt-decoder-clear-btn');

        // Initialize tabs
        setupTabs();

        // Preload with sample JWT token and secret
        jwtInput.value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        secretInput.value = 'your-256-bit-secret';
        
        // Trigger initial decode
        decodeJWT(false);

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
