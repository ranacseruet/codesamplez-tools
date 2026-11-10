import type { JSX } from 'preact';
import { buildSiteHref, SITE_BASE_URL } from '../common/siteBaseUrl';
import { ToolArticleSection, ToolFaqList, type ToolFaqItem } from '../common/tool-article/ToolArticle';
import { ToolTutorialLinks } from '../common/tool-article/TutorialLinks';
import { JWT_BEST_PRACTICES, JWT_CRASH_COURSE } from '../common/tool-article/tutorial-links';

/**
 * Fixed HS256 example, the same token the JWT Generator worked example signs.
 * The secret is UTF-8 text. The decoder does not Base64-decode it.
 * Date strings are Date.toUTCString(), which the Validation Result panel prints.
 */
export const WORKED_EXAMPLE_SECRET = 'your-jwt-secret-key';
export const WORKED_EXAMPLE_HEADER = {
    alg: 'HS256',
    typ: 'JWT'
};
export const WORKED_EXAMPLE_PAYLOAD = {
    exp: 1910347200,
    iat: 1894708800,
    nbf: 1894708800,
    iss: 'example-issuer',
    sub: 'user-123',
    aud: 'example-api',
    jti: 'example-token-1'
};
export const WORKED_EXAMPLE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE5MTAzNDcyMDAsImlhdCI6MTg5NDcwODgwMCwibmJmIjoxODk0NzA4ODAwLCJpc3MiOiJleGFtcGxlLWlzc3VlciIsInN1YiI6InVzZXItMTIzIiwiYXVkIjoiZXhhbXBsZS1hcGkiLCJqdGkiOiJleGFtcGxlLXRva2VuLTEifQ.rGjvaLDaYH15AC3SkgKUlBwqW2poNQapBfo3bQkpNJo';

/** Pretty JSON Copy Decoded writes for this token: `{ header, payload }` with a 2-space indent. */
export const WORKED_EXAMPLE_DECODED_JSON = JSON.stringify({
    header: WORKED_EXAMPLE_HEADER,
    payload: WORKED_EXAMPLE_PAYLOAD
}, null, 2);

function utcFromSeconds(seconds: number): string {
    return new Date(seconds * 1000).toUTCString();
}

export const WORKED_EXAMPLE_EXP_UTC = utcFromSeconds(WORKED_EXAMPLE_PAYLOAD.exp);
export const WORKED_EXAMPLE_IAT_UTC = utcFromSeconds(WORKED_EXAMPLE_PAYLOAD.iat);
export const WORKED_EXAMPLE_NBF_UTC = utcFromSeconds(WORKED_EXAMPLE_PAYLOAD.nbf);

/** Validation Result text while the current time is before nbf. Matches the panel join. */
export const WORKED_EXAMPLE_VALIDITY_BEFORE_NBF = `⚠️ Not valid until ${WORKED_EXAMPLE_NBF_UTC} · Expires at ${WORKED_EXAMPLE_EXP_UTC} · Issued at ${WORKED_EXAMPLE_IAT_UTC}`;

export const BROWSER_DECODE_SNIPPET = `function decodeJwtPart(part) {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

const [headerPart, payloadPart] = token.split('.');
const header = decodeJwtPart(headerPart);
const payload = decodeJwtPart(payloadPart);`;

export const NODE_DECODE_SNIPPET = `function decodeJwtPart(part) {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

const [headerPart, payloadPart] = token.split('.');
const header = decodeJwtPart(headerPart);
const payload = decodeJwtPart(payloadPart);`;

export const PYTHON_DECODE_SNIPPET = `import base64
import json

def decode_jwt_part(part):
    padded = part + '=' * (-len(part) % 4)
    return json.loads(base64.urlsafe_b64decode(padded))

header_part, payload_part, _signature = token.split('.')
header = decode_jwt_part(header_part)
payload = decode_jwt_part(payload_part)`;

const HS256_ONLY_WARNING_RS256 = '⚠️ Decoded successfully. Signature verification is only supported for HS256 (token uses RS256).';
const HS256_ONLY_WARNING_ES256 = '⚠️ Decoded successfully. Signature verification is only supported for HS256 (token uses ES256).';

function createPlainTextFaqItem(question: string, answer: string): ToolFaqItem {
    return {
        question,
        answer,
        structuredDataAnswer: answer
    };
}

export const FAQ_ITEMS: ToolFaqItem[] = [
    createPlainTextFaqItem(
        'Is it safe to decode JWTs using an online tool?',
        'Yes. This tool doesn’t store anything, neither sends to any server for processing. Everything happens right in your browser. However, it is recommended to use any such tool as this for testing and debugging purpose only.'
    ),
    createPlainTextFaqItem(
        'Do I need the secret key to decode a JWT?',
        'No. The header and payload decode without a secret. Verifying an HS256 signature needs the shared secret in the Secret Key field. The tool uses that text as UTF-8 bytes and does not Base64-decode it.'
    ),
    createPlainTextFaqItem(
        'What algorithms does this JWT decoder support?',
        'For signature validation, this tool supports only “HMAC-SHA256” algorithm at this moment.'
    ),
    createPlainTextFaqItem(
        'Can this tool create JWTs or just decode?',
        'This tool only decodes and verifies signature. Checkout our JWT Generator Tool to create a new token.'
    ),
    createPlainTextFaqItem(
        'What are common JWT payload claims?',
        'There are seven standard claims for JWT as per RFC7519, including iss, sub, aud, exp, nbf, iat, and jti.'
    ),
    createPlainTextFaqItem(
        'Is it safe to paste my JWT here?',
        'Decoding runs in this browser. The token and the secret are not uploaded and are not stored. Use the page to debug a test token. Do not paste a production token or a production secret.'
    ),
    createPlainTextFaqItem(
        'Why does my token decode but fail verification?',
        `Decoding only reads the Base64URL header and payload. It does not check the signature. This page verifies HS256 by HMAC-SHA256 using the Secret Key text as UTF-8 bytes, and it does not Base64-decode that secret. A different secret shows “✗ Decoded successfully. Signature is invalid.” An RS256 token still decodes, and Validate Signature then shows “${HS256_ONLY_WARNING_RS256}” The same warning names ES256 when that is the algorithm. This page does not verify RS256 or ES256. A matching HS256 signature can still be expired or not yet valid when exp or nbf says so.`
    ),
    createPlainTextFaqItem(
        'How do I decode a JWT without a library?',
        'Split the token on the dots. Base64URL-decode the first segment for the header and the second for the payload: replace - with + and _ with /, add = padding so the length is a multiple of 4, then decode. Use atob and TextDecoder in the browser, Buffer in Node.js, or base64 with that padding in Python. That reads the claims. It does not verify the signature.'
    )
];

export function JwtDecoderIntro(): JSX.Element {
    return (
        <section className="c-tool-article c-tool-article--intro c-surface-card" aria-labelledby="jwt-decoder-intro-heading">
            <div className="c-tool-article__content">
                <h2 id="jwt-decoder-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    Need to decode a JWT token quickly? You’re in the right place. This free online JWT Decoder lets
                    you paste any JSON Web Token to instantly see its header and payload, and verifies an HS256
                    signature with a shared secret, all right in your browser.
                </p>
            </div>
        </section>
    );
}

export function JwtDecoderArticle(): JSX.Element {
    return (
        <section className="c-tool-article c-surface-card" aria-labelledby="jwt-decoder-article-heading">
            <div className="c-tool-article__content">
                <h2 id="jwt-decoder-article-heading" className="c-tool-article__sr-only">JWT Decoder Guide</h2>

                <ToolArticleSection id="jwt-decoder-what-is-jwt" title="What is a JSON Web Token (JWT)?">
                    <p>
                        A JSON Web Token is a compact, URL-safe string that carries digitally signed claims like user
                        ID and expiry time in its header, payload, and signature parts.
                    </p>
                    <p>
                        If you want to learn everything there’s to know about JWT, you can do so with our dedicated{' '}
                        <a href={JWT_CRASH_COURSE.href}>JWT Crash Course</a>.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-decoder-features" title="JWT Decoder Tool Features">
                    <ul>
                        <li><strong>Real-time Decoding:</strong> Instantly decode and validate the given JWT token as you type or paste.</li>
                        <li><strong>Signature Verification:</strong> Validate JWT signatures using HMAC-SHA256 algorithm.</li>
                        <li>
                            <strong>Base64 Support:</strong> Automatically detects and handles both standard and URL-safe
                            Base64 encoding — or open the segments in the{' '}
                            <a href={buildSiteHref('/base64-converter/')}>Base64 Converter</a> for a closer look.
                        </li>
                        <li><strong>Secure Processing:</strong> All operations are performed client-side for maximum security. Tokens aren’t transmitted over the network.</li>
                        <li><strong>Copy Functionality:</strong> Single-click copy-to-clipboard functionality for the decoded token.</li>
                    </ul>

                    <div className="c-tool-article__cta-row">
                        <a className="c-button" href={SITE_BASE_URL}>
                            Explore More Dev Tools
                        </a>
                    </div>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-decoder-how-to-decode" title="How to Decode a JWT Token">
                    <ol>
                        <li><strong>Copy the entire JWT Token</strong> that you want to decode.</li>
                        <li><strong>Paste your JWT token</strong> into the Token text area.</li>
                        <li><strong>Review the Decoded Token section</strong> where the header and payload appear instantly.</li>
                        <li><strong>Inspect the output</strong> and make sure both header and payload are decoded fully.</li>
                        <li><strong>Use Copy Decoded</strong> if you need the parsed result in your clipboard.</li>
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-decoder-worked-example" title="Worked Example: Decode an HS256 Token">
                    <p>
                        Paste the token below. It is the HS256 example from the{' '}
                        <a href={buildSiteHref('/jwt-builder/')}>JWT Generator</a>, signed with the placeholder
                        secret <code>{WORKED_EXAMPLE_SECRET}</code>. That secret is the UTF-8 text of the Secret Key
                        field. This page does not Base64-decode it. Load Sample fills a different token.
                    </p>
                    <pre><code>{WORKED_EXAMPLE_TOKEN}</code></pre>
                    <p>
                        Copy Decoded writes this JSON. The Raw tab shows the same header and payload, and the Header
                        and Payload tabs show those two objects:
                    </p>
                    <pre><code>{WORKED_EXAMPLE_DECODED_JSON}</code></pre>
                    <p>
                        The Validation Result panel turns <code>exp</code>, <code>iat</code>, and <code>nbf</code> into
                        UTC dates (the same text as <code>Date.toUTCString()</code>):
                    </p>
                    <ul>
                        <li><code>exp</code> {WORKED_EXAMPLE_PAYLOAD.exp} is {WORKED_EXAMPLE_EXP_UTC}</li>
                        <li><code>iat</code> {WORKED_EXAMPLE_PAYLOAD.iat} is {WORKED_EXAMPLE_IAT_UTC}</li>
                        <li><code>nbf</code> {WORKED_EXAMPLE_PAYLOAD.nbf} is {WORKED_EXAMPLE_NBF_UTC}</li>
                    </ul>
                    <p>
                        While the current time is before <code>nbf</code>, the panel reads{' '}
                        <code>{WORKED_EXAMPLE_VALIDITY_BEFORE_NBF}</code>. After <code>nbf</code> and before{' '}
                        <code>exp</code> it reads{' '}
                        <code>{`✓ Not expired (expires at ${WORKED_EXAMPLE_EXP_UTC}) · Issued at ${WORKED_EXAMPLE_IAT_UTC}`}</code>.
                        On or after <code>exp</code> it reads{' '}
                        <code>{`✗ Expired at ${WORKED_EXAMPLE_EXP_UTC} · Issued at ${WORKED_EXAMPLE_IAT_UTC}`}</code>.
                    </p>
                    <p>
                        The three segments are header, payload, and the HS256 signature. The{' '}
                        <a href={JWT_CRASH_COURSE.href}>{JWT_CRASH_COURSE.anchor}</a> walks through that layout.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-decoder-decode-in-code" title="Decode a JWT in Code">
                    <p>
                        These snippets decode the token above. <code>token</code> is that string. Each one reads the
                        header and payload only.
                    </p>
                    <h3>JavaScript in the browser</h3>
                    <pre><code>{BROWSER_DECODE_SNIPPET}</code></pre>
                    <p>This reads the JSON with atob and TextDecoder. It does not verify the signature.</p>
                    <h3>Node.js</h3>
                    <pre><code>{NODE_DECODE_SNIPPET}</code></pre>
                    <p>Buffer reads the JSON. It does not verify the signature.</p>
                    <h3>Python</h3>
                    <pre><code>{PYTHON_DECODE_SNIPPET}</code></pre>
                    <p>This reads the claims with base64 and padding. It does not verify the signature.</p>
                    <p>
                        To create the same token, use the{' '}
                        <a href={buildSiteHref('/jwt-builder/')}>JWT Generator</a>.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-decoder-claims" title="Standard Claims, Time Fields, and Base64URL">
                    <p>RFC 7519 defines these seven registered claims. A token may include any subset of them.</p>
                    <ul>
                        <li><code>iss</code> (issuer): who issued the token.</li>
                        <li><code>sub</code> (subject): who the token is about, often a user id.</li>
                        <li><code>aud</code> (audience): who the token is for, such as an API.</li>
                        <li><code>exp</code> (expiration): NumericDate, seconds since the Unix epoch. The token is not acceptable on or after this time.</li>
                        <li><code>iat</code> (issued at): NumericDate when the token was issued.</li>
                        <li><code>nbf</code> (not before): NumericDate. The token is not acceptable before this time.</li>
                        <li><code>jti</code> (JWT ID): a unique id for this token.</li>
                    </ul>
                    <p>
                        A token can decode and still be unusable. Decoding only needs the first two segments to be
                        Base64URL JSON. The signature can be wrong, the algorithm can be one this page does not
                        verify, <code>exp</code> can be in the past, or <code>nbf</code> can be in the future. The
                        signature line and the time line in Validation Result are separate. The{' '}
                        <a href={JWT_BEST_PRACTICES.href}>{JWT_BEST_PRACTICES.anchor}</a> covers how long a token
                        should live.
                    </p>
                    <p>
                        Each segment is Base64URL (RFC 4648 §5). The alphabet uses <code>-</code> and <code>_</code>{' '}
                        instead of <code>+</code> and <code>/</code>, and the <code>=</code> padding is left off. This
                        page puts the padding back, swaps the alphabet, and reads the bytes as UTF-8. The{' '}
                        <a href={JWT_CRASH_COURSE.href}>{JWT_CRASH_COURSE.anchor}</a> shows the three-part layout.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-decoder-how-to-verify" title="How to Verify a JWT Signature">
                    <p>When you are done decoding the token successfully, follow these steps:</p>
                    <ul>
                        <li>Enter the shared secret in the Secret Key field. The tool uses that text as UTF-8 bytes for HMAC-SHA256 and does not Base64-decode it.</li>
                        <li>A matching HS256 secret shows “✓ Decoded successfully. Signature is valid.”</li>
                        <li>A different secret shows “✗ Decoded successfully. Signature is invalid.”</li>
                        <li>
                            An RS256 or ES256 token still decodes. Validate Signature then shows “{HS256_ONLY_WARNING_RS256}”
                            or “{HS256_ONLY_WARNING_ES256}”. This page does not verify RS256 or ES256.
                        </li>
                    </ul>
                    <p>
                        Need to generate a new JWT token instead? Use our{' '}
                        <a href={buildSiteHref('/jwt-builder/')}>JWT Generator Tool</a>.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-decoder-technical-details" title="JWT Decoder Technical Details">
                    <h3>Token Processing</h3>
                    <ul>
                        <li>
                            Supports standard JWT structure format: <code>{'{header}.{payload}.{signature}'}</code>.
                            Pretty-print the decoded payload JSON with the{' '}
                            <a href={buildSiteHref('/json-formatter/')}>JSON Formatter</a>.
                        </li>
                        <li>Handles URL-safe Base64 encoding by replacing <code>-</code> and <code>_</code> with <code>+</code> and <code>/</code>.</li>
                        <li>Automatically manages Base64 padding.</li>
                    </ul>

                    <h3>Security Features</h3>
                    <ul>
                        <li>All processing is done client-side using the browser’s native APIs.</li>
                        <li>Uses Web Crypto API for secure HMAC-SHA256 signature verification.</li>
                        <li>No data is transmitted to external servers.</li>
                        <li>No token storage or caching.</li>
                    </ul>

                    <h3>JWT Signature Verification</h3>
                    <ul>
                        <li>Implements HMAC-SHA256 using the Web Crypto API.</li>
                        <li>Uses the Secret Key text as UTF-8 bytes. It does not Base64-decode the secret.</li>
                        <li>Provides real-time validation with immediate feedback.</li>
                        <li>RS256 and ES256 decode, then show the HS256-only warning. This page does not verify those algorithms.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-decoder-browser-compatibility" title="Browser Compatibility">
                    <p>This JWT Decoder online tool uses modern web APIs and requires the following browser features:</p>
                    <ul>
                        <li>Web Crypto API</li>
                        <li>Clipboard API</li>
                        <li>TextEncoder</li>
                        <li>Javascript async/await support</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-decoder-security" title="Security Considerations">
                    <ol>
                        <li>
                            <strong>Client-Side Processing:</strong> All token processing occurs in your browser. This
                            tool doesn’t send any data to external servers, so your tokens and secrets remain private.
                        </li>
                        <li>
                            <strong>Secret Key Handling:</strong> The tool uses the secret key only to verify signature
                            locally on your browser. Keys are never stored or transmitted, and the tool doesn’t
                            remember anything after you close your browser.
                        </li>
                        <li>
                            <strong>Recommended Best Practices:</strong> Do not use the JWT Decoder tool with
                            sensitive production tokens or secrets. Use it for development, testing, and debugging,
                            and clear browser history or cache after working with sensitive data.
                        </li>
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-decoder-feedback" title="Feedback">
                    <p>
                        We welcome any bug report, feature request, or feedback. Please{' '}
                        <a href="https://codesamplez.com/contact">contact us</a> with as much detail as you can.
                    </p>
                </ToolArticleSection>

                <ToolTutorialLinks toolId="jwt-decoder" />

                <ToolArticleSection id="jwt-decoder-faqs" title="JWT Decoder FAQs (Frequently Asked Questions)">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
