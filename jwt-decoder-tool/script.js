import { JWTDecoder, hmacSha256 } from './JWTDecoder.js'; // Updated import

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
    // Reset tab to header view
    const headerTab = document.querySelector('.jwt-decoder-tab[data-tab="header"]');
    if (headerTab) {
        headerTab.click(); // Simulate click to activate header tab
    }
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
        // Instantiate the decoder
        const decoder = new JWTDecoder(jwt);

        // Check if the token format is valid before proceeding
        if (!decoder.isValidFormat) {
            throw new Error(decoder.getParsingError() || 'Invalid JWT format');
        }

        const header = decoder.getHeader();
        const payload = decoder.getPayload();

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
            const isValid = await decoder.verifySignature(secret); // Use class method
            statusOutput.textContent = isValid ? '✓ Signature is valid' : '✗ Signature is invalid';
            statusOutput.style.color = isValid ? 'rgb(40, 167, 69)' : 'rgb(220, 53, 69)';
        } else if (verifySignature && !secret) {
            statusOutput.textContent = 'Secret key required for verification';
            statusOutput.style.color = 'rgb(255, 193, 7)'; // Warning color
        } else {
             statusOutput.textContent = 'Not verified';
             statusOutput.style.color = 'rgb(102, 102, 102)';
        }

    } catch (e) {
        decodedOutput.value = `Error: ${e.message}`;
        document.getElementById('headerJson').innerHTML = '';
        document.getElementById('payloadJson').innerHTML = '';
        document.getElementById('rawJsonViewer').innerHTML = '';
        statusOutput.textContent = 'Error processing token'; // More generic error
        statusOutput.style.color = 'rgb(220, 53, 69)';
        console.error('JWT Processing Error:', e);
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

// Initialize the UI when the DOM is loaded
if (typeof document !== 'undefined') {
    // Export functions for browser environment (adjust as needed)
    window.clearAll = clearAll;
    window.decodeJWT = decodeJWT; // Main function using the class
    window.copyDecoded = copyDecoded;
    // No longer exporting validateJWT, hmacSha256, isBase64 directly from here
    // They are encapsulated or handled within JWTDecoder.js

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
