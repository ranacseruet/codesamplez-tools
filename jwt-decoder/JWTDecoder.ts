import Base64Codec from '../common/Base64Codec';

type JwtObject = Record<string, unknown>;
type HmacFunction = (message: string, key: string) => Promise<Uint8Array>;

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

/**
 * Generates HMAC SHA-256 signature using Web Crypto API.
 * Kept as a standalone function as it doesn't depend on decoder state.
 */
export async function hmacSha256(message: string, key: string): Promise<Uint8Array> {
    if (!message || !key) {
        throw new Error('Invalid input: message and key are required');
    }

    // Failures propagate to the caller unlogged: verifySignature is the one
    // place that logs, so a single failure isn't reported twice.
    // Use Web Crypto API if available (browser environment).
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

    // If Web Crypto is not available.
    throw new Error('Web Crypto API (crypto.subtle) not available');
}

/**
 * Decodes and validates JWT tokens.
 */
export class JWTDecoder {
    #tokenString = '';
    #header: JwtObject | null = null;
    #payload: JwtObject | null = null;
    #signature: string | null = null;
    #isValidTokenFormat = false;
    #parseError: string | null = null;
    #codec = new Base64Codec();

    constructor(token: string | null | undefined) {
        this.#tokenString = token ? token.trim() : '';
        this.#parseToken();
    }

    #parseToken(): void {
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
        this.#signature = signatureB64;
        let headerParsed = false;
        let payloadParsed = false;

        // Try parsing header.
        try {
            const headerStr = this.#base64UrlDecode(headerB64);
            this.#header = JSON.parse(headerStr) as JwtObject;
            headerParsed = true;
        } catch (error: unknown) {
            this.#header = null;
            this.#parseError = `Failed to parse header: ${getErrorMessage(error)}`;
        }

        // Try parsing payload.
        try {
            const payloadStr = this.#base64UrlDecode(payloadB64);
            this.#payload = JSON.parse(payloadStr) as JwtObject;
            payloadParsed = true;
        } catch (error: unknown) {
            this.#payload = null;
            const payloadError = `Failed to parse payload: ${getErrorMessage(error)}`;
            this.#parseError = this.#parseError ? `${this.#parseError}; ${payloadError}` : payloadError;
        }

        // isValidTokenFormat strictly means "has 3 parts".
        this.#isValidTokenFormat = true;
        if (headerParsed && payloadParsed) {
            this.#parseError = null;
        }
    }

    #base64UrlDecode(str: string): string {
        const bytes = this.#codec.decodeBase64Url(str);
        return new TextDecoder().decode(bytes);
    }

    getHeader(): JwtObject | null {
        return this.#header;
    }

    getPayload(): JwtObject | null {
        return this.#payload;
    }

    getSignature(): string | null {
        return this.#signature;
    }

    get isValidFormat(): boolean {
        return this.#isValidTokenFormat;
    }

    getParsingError(): string | null {
        return this.#parseError;
    }

    getAlgorithm(): string | null {
        return typeof this.#header?.alg === 'string' ? this.#header.alg : null;
    }

    async verifySignature(secret: string | null | undefined, hmacFunc: HmacFunction = hmacSha256): Promise<boolean> {
        // Cannot verify if basic format is wrong, signature is missing, secret is missing,
        // or if header/payload failed to parse.
        if (!this.#isValidTokenFormat || !this.#signature || !secret || this.#header === null || this.#payload === null) {
            return false;
        }

        if (this.getAlgorithm() !== 'HS256') {
            return false;
        }

        try {
            const parts = this.#tokenString.split('.');
            const signatureInput = `${parts[0]}.${parts[1]}`;

            // Generate the expected signature.
            const expectedSignatureBytes = await hmacFunc(signatureInput, secret);

            // Reuse the shared codec already bundled for payload/header decoding.
            const expectedBase64Url = this.#codec.encodeBase64Url(expectedSignatureBytes);

            // Constant-time comparison.
            const providedSignature = this.#signature;
            if (expectedBase64Url.length !== providedSignature.length) {
                return false;
            }

            let result = 0;
            for (let i = 0; i < expectedBase64Url.length; i += 1) {
                result |= expectedBase64Url.charCodeAt(i) ^ providedSignature.charCodeAt(i);
            }

            return result === 0;
        } catch (error: unknown) {
            console.error('Error validating JWT signature:', error);
            return false;
        }
    }
}
