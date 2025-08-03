/**
 * Generates HMAC SHA-256 signature using Web Crypto API.
 * Kept as a standalone function as it doesn't depend on decoder state.
 * @param {string} message - The message to sign
 * @param {string} key - The secret key
 * @returns {Promise<Uint8Array>} - The signature bytes
 * @throws {Error} If Web Crypto API is not available or input is invalid.
 */
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

        // If Web Crypto is not available
        throw new Error('Web Crypto API (crypto.subtle) not available');
    } catch (error) {
        console.error('HMAC generation error:', error);
        // Re-throw the specific error or a generic one if needed
        throw error;
    }
}

/**
 * Decodes and validates JWT tokens.
 */
import Base64Codec from '../common/Base64Codec.js';

export class JWTDecoder {
    #tokenString = '';
    #header = null;
    #payload = null;
    #signature = null;
    #isValidTokenFormat = false;
    #parseError = null;
    #codec = new Base64Codec();

    /**
     * Creates an instance of JWTDecoder and parses the token.
     * @param {string} token - The JWT token string.
     */
    constructor(token) {
        this.#tokenString = token ? token.trim() : '';
        this.#parseToken();
    }

    /**
     * Parses the JWT string into header, payload, and signature.
     * Sets internal state based on parsing success or failure.
     * @private
     */
    #parseToken() {
        if (!this.#tokenString) {
            this.#parseError = 'No token provided';
            this.#isValidTokenFormat = false;
            return;
        }

        const parts = this.#tokenString.split('.');
        if (parts.length !== 3) {
            this.#parseError = 'Invalid token format (must have 3 parts)';
            this.#isValidTokenFormat = false;
            return;
        }

        const [headerB64, payloadB64, signatureB64] = parts;
        this.#signature = signatureB64; // Store the signature part
        let headerParsed = false;
        let payloadParsed = false;

        // Try parsing header
        try {
            const headerStr = this.#base64UrlDecode(headerB64);
            this.#header = JSON.parse(headerStr);
            headerParsed = true;
        } catch (error) {
            this.#header = null; // Ensure header is null if it fails
            this.#parseError = `Failed to parse header: ${error.message}`;
            // Don't immediately set isValidTokenFormat to false, payload might still be parsable for inspection
        }

        // Try parsing payload
        try {
            const payloadStr = this.#base64UrlDecode(payloadB64);
            this.#payload = JSON.parse(payloadStr);
            payloadParsed = true;
        } catch (error) {
            this.#payload = null; // Ensure payload is null if it fails
            // Append payload error if header error already exists, otherwise set it
            const payloadError = `Failed to parse payload: ${error.message}`;
            this.#parseError = this.#parseError ? `${this.#parseError}; ${payloadError}` : payloadError;
        }

        // isValidTokenFormat now strictly means "has 3 parts".
        // Parsing success is indicated by non-null header/payload and null parseError.
        this.#isValidTokenFormat = true; // Reaching here means 3 parts exist.
        if (headerParsed && payloadParsed) {
             this.#parseError = null; // Clear errors only if both parsed successfully
        }
        // Note: #parseError will contain details if headerParsed or payloadParsed is false.
    }

    /**
     * Decodes a base64url string.
     * @param {string} str - The base64url string to decode.
     * @returns {string} - The decoded string.
     * @throws {Error} If the string is not valid base64url.
     * @private
     */
    #base64UrlDecode(str) {
        const bytes = this.#codec.decodeBase64Url(str);
        return new TextDecoder().decode(bytes);
    }

    /**
     * Gets the decoded header object.
     * @returns {Object | null} The decoded header, or null if parsing failed.
     */
    getHeader() {
        return this.#header;
    }

    /**
     * Gets the decoded payload object.
     * @returns {Object | null} The decoded payload, or null if parsing failed.
     */
    getPayload() {
        return this.#payload;
    }

    /**
     * Gets the signature part of the JWT string.
     * @returns {string | null} The signature string, or null if token format was invalid.
     */
    getSignature() {
        return this.#signature;
    }

    /**
     * Checks if the token format was valid during construction.
     * @returns {boolean} True if the token had 3 parts and header/payload could be parsed.
     */
    get isValidFormat() {
        return this.#isValidTokenFormat;
    }

    /**
     * Gets the parsing error message, if any occurred during construction.
     * @returns {string | null} The error message or null.
     */
    getParsingError() {
        return this.#parseError;
    }

    /**
     * Validates the JWT signature against a secret.
     * @param {string} secret - The secret key for validation.
     * @param {Function} [hmacFunc=hmacSha256] - The HMAC function to use. Defaults to the exported hmacSha256.
     * @returns {Promise<boolean>} - Whether the signature is valid. Returns false if token format was invalid, parsing failed, or secret is missing.
     */
    async verifySignature(secret, hmacFunc = hmacSha256) {
        // Cannot verify if basic format is wrong, signature is missing, secret is missing, OR if header/payload failed to parse.
        if (!this.#isValidTokenFormat || !this.#signature || !secret || this.#header === null || this.#payload === null) {
            return false;
        }

        try {
            const parts = this.#tokenString.split('.');
            const signatureInput = `${parts[0]}.${parts[1]}`; // Reconstruct the signed part

            // Generate the expected signature
            const expectedSignatureBytes = await hmacFunc(signatureInput, secret);

            // Convert expected signature ArrayBuffer to base64url
            const expectedByteArray = new Uint8Array(expectedSignatureBytes);
            const expectedBase64Url = btoa(String.fromCharCode(...expectedByteArray))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            // Constant-time comparison
            const providedSignature = this.#signature;
            if (expectedBase64Url.length !== providedSignature.length) {
                return false;
            }

            let result = 0;
            for (let i = 0; i < expectedBase64Url.length; i++) {
                result |= expectedBase64Url.charCodeAt(i) ^ providedSignature.charCodeAt(i);
            }

            return result === 0;
        } catch (e) {
            console.error('Error validating JWT signature:', e);
            return false; // Treat errors during validation as invalid signature
        }
    }
}
