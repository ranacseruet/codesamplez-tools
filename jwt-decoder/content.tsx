import type { JSX } from 'preact';
import { SITE_BASE_URL, ToolArticleSection, ToolFaqList, type ToolFaqItem } from '../common/tool-article/ToolArticle';

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
        'No, no secret key is required to be able to decode the payload from the token. But, a key is required to verify the JWT signature, either in plain text or in Base64 encoded.'
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
    )
];

export function JwtDecoderIntro(): JSX.Element {
    return (
        <section className="c-tool-article c-tool-article--intro c-surface-card" aria-labelledby="jwt-decoder-intro-heading">
            <div className="c-tool-article__content">
                <h2 id="jwt-decoder-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    Need to decode a JWT token quickly? You’re in the right place. This free online JWT Decoder lets
                    you paste any JSON Web Token to instantly see its header and payload, and even verifies the
                    signature for you, all right in your browser.
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
                        <a href="https://codesamplez.com/jwt-tutorial">JWT Crash Course</a>.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-decoder-features" title="JWT Decoder Tool Features">
                    <ul>
                        <li><strong>Real-time Decoding:</strong> Instantly decode and validate the given JWT token as you type or paste.</li>
                        <li><strong>Signature Verification:</strong> Validate JWT signatures using HMAC-SHA256 algorithm.</li>
                        <li><strong>Base64 Support:</strong> Automatically detects and handles both standard and URL-safe Base64 encoding.</li>
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

                <ToolArticleSection id="jwt-decoder-how-to-verify" title="How to Verify a JWT Signature">
                    <p>When you are done decoding the token successfully, follow these steps:</p>
                    <ul>
                        <li>Enter the secret key used to sign the token in the Secret Key field.</li>
                        <li>The tool supports both plain text and Base64-encoded secrets.</li>
                        <li>View the validation result in the Validation Result section.</li>
                        <li>Correct anything if needed, based on validation result, and try again.</li>
                    </ul>
                    <p>
                        Need to generate a new JWT token instead? Use our{' '}
                        <a href="https://codesamplez.com/tools/jwt-builder">JWT Generator Tool</a>.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-decoder-technical-details" title="JWT Decoder Technical Details">
                    <h3>Token Processing</h3>
                    <ul>
                        <li>Supports standard JWT structure format: <code>{'{header}.{payload}.{signature}'}</code>.</li>
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
                        <li>Supports both raw and Base64-encoded secret keys.</li>
                        <li>Provides real-time validation with immediate feedback.</li>
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

                <ToolArticleSection id="jwt-decoder-faqs" title="JWT Decoder FAQs (Frequently Asked Questions)">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
