import type { JSX } from 'preact';
import { ToolArticleSection, ToolFaqList, type ToolFaqItem } from '../common/tool-article/ToolArticle';

function createPlainTextFaqItem(question: string, answer: string): ToolFaqItem {
    return {
        question,
        answer,
        structuredDataAnswer: answer
    };
}

export const FAQ_ITEMS: ToolFaqItem[] = [
    createPlainTextFaqItem(
        'Is this JWT generator free to use?',
        'Yes. The CodeSamplez JWT Generator is completely free to use and runs directly in your browser.'
    ),
    createPlainTextFaqItem(
        'Which algorithms does the JWT Generator support?',
        'Right now this tool supports HMAC-SHA256 (HS256) for signing generated tokens.'
    ),
    createPlainTextFaqItem(
        'Can I verify or decode a JWT here?',
        'This page is focused on token creation. If you want to inspect or validate an existing token, use the CodeSamplez JWT Decoder tool.'
    ),
    createPlainTextFaqItem(
        'Do JWTs expire?',
        'They can. JWTs expire when you include the exp claim, and setting an expiration time is recommended for better security.'
    ),
    createPlainTextFaqItem(
        'Is using an online JWT generator safe?',
        'For testing and development, yes. This generator works locally in your browser so claims and signing keys are not sent to a server, but you should still avoid pasting production secrets or sensitive payloads into any online tool.'
    )
];

export function JwtBuilderIntro(): JSX.Element {
    return (
        <section className="c-tool-article c-tool-article--intro c-surface-card" aria-labelledby="jwt-builder-intro-heading">
            <div className="c-tool-article__content">
                <h2 id="jwt-builder-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    JWT Generator is a free browser-based tool to quickly create signed JSON Web Tokens. Enter your
                    standard claims, add custom claims, provide a signing secret, and generate a JWT instantly without
                    writing code. Everything runs locally in the browser so your data stays on your device.
                </p>
            </div>
        </section>
    );
}

export function JwtBuilderArticle(): JSX.Element {
    return (
        <section className="c-tool-article c-surface-card" aria-labelledby="jwt-builder-article-heading">
            <div className="c-tool-article__content">
                <h2 id="jwt-builder-article-heading" className="c-tool-article__sr-only">JWT Generator Guide</h2>

                <ToolArticleSection id="jwt-builder-what-is-it" title="What is a JWT Generator?">
                    <p>
                        A JWT generator is an online tool that creates JSON Web Tokens by combining token claims with a
                        signing secret or key. It saves developers from writing the signing logic manually and is
                        useful for testing auth flows, API integration, and local development.
                    </p>
                    <p>
                        Need to inspect an existing token instead? Use the{' '}
                        <a href="https://codesamplez.com/tools/jwt-decoder">JWT Decoder and validator</a>.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-builder-supported-features" title="Supported Features:">
                    <ul>
                        <li><strong>Support for standard JWT claims:</strong> `iss`, `sub`, `aud`, `exp`, `nbf`, `iat`, and `jti`.</li>
                        <li><strong>Custom claim support:</strong> add claim rows dynamically and include string or JSON values.</li>
                        <li><strong>Flexible datetime parsing:</strong> use ISO 8601 values or UNIX timestamps for time-based claims.</li>
                        <li><strong>Automatic timestamp conversion:</strong> the tool converts supported datetime input into JWT-friendly numeric values.</li>
                        <li><strong>HS256 signing:</strong> token signing uses HMAC-SHA256.</li>
                        <li><strong>Random secret generation:</strong> generate a strong 32-character secret key for testing.</li>
                        <li><strong>Copy-ready output and validation feedback:</strong> build the token and copy it from the result panel.</li>
                    </ul>

                    <div className="c-tool-article__cta-row">
                        <a className="c-button" href="https://codesamplez.com/tools">
                            Explore More Dev Tools
                        </a>
                    </div>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-builder-how-to-use" title="How To Use The JWT Generator:">
                    <ol>
                        <li><strong>Fill in the standard claims</strong> such as issuer, subject, audience, and expiration time.</li>
                        <li><strong>Add custom claims if needed</strong> by clicking <em>Add Claim</em> and entering the claim name and value.</li>
                        <li><strong>Enter your signature key</strong> or generate a random secret for HS256 signing.</li>
                        <li><strong>Click Build JWT</strong> to create the signed token.</li>
                        <li><strong>Copy the generated token</strong> from the output panel and use it in your app or test flow.</li>
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-builder-standard-claims" title="Standard JWT Claims">
                    <p>This generator supports the standard claims defined by the JWT specification.</p>
                    <ul>
                        <li><code>iss</code> (Issuer): identifies who issued the token.</li>
                        <li><code>sub</code> (Subject): identifies the principal the token refers to, often a user ID.</li>
                        <li><code>aud</code> (Audience): specifies the intended recipient such as an API or service.</li>
                        <li><code>exp</code> (Expiration Time): defines when the token becomes invalid.</li>
                        <li><code>nbf</code> (Not Before): defines the earliest time the token is valid.</li>
                        <li><code>iat</code> (Issued At): records when the token was issued.</li>
                        <li><code>jti</code> (JWT ID): provides a unique identifier for the token.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-builder-error-handling" title="Error Handling & Validation">
                    <ul>
                        <li>Checks for missing required fields such as signing key, issuer, and expiration time.</li>
                        <li>Validates supported datetime formats before token generation.</li>
                        <li>Parses JSON-style custom claim values when possible and falls back safely to strings.</li>
                        <li>Surfaces signature-generation failures without exposing sensitive values.</li>
                        <li>Keeps the result area clear when generation fails so invalid output is not reused accidentally.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-builder-security" title="Security/Privacy Considerations">
                    <ul>
                        <li><strong>Client-side only:</strong> no claim data or secrets are sent to a server.</li>
                        <li><strong>Web Crypto based signing:</strong> cryptographic operations use browser APIs.</li>
                        <li><strong>No secret storage:</strong> the signature key is used in memory only.</li>
                        <li><strong>Best for testing and development:</strong> avoid using production secrets in any browser tool.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-builder-browser-compatibility" title="Browser Compatibility">
                    <p>The JWT Generator works in modern browsers that support:</p>
                    <ul>
                        <li>Web Crypto API</li>
                        <li>TextEncoder API</li>
                        <li>Clipboard support for copy actions</li>
                        <li>ES6+ JavaScript features</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-builder-technical-details" title="Technical Details:">
                    <ul>
                        <li><strong>Frontend:</strong> Pure HTML, CSS, and JavaScript rendered through the CodeSamplez tool shell.</li>
                        <li><strong>Cryptography:</strong> Web Crypto API with HMAC-SHA256 signing.</li>
                        <li><strong>Encoding:</strong> Base64URL handling for JWT header, payload, and signature segments.</li>
                        <li><strong>Input processing:</strong> datetime parsing, JSON custom-claim parsing, and validation feedback.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-builder-feedback" title="Feedback">
                    <p>
                        Please <a href="https://codesamplez.com/contact">get in touch with us</a> for any bug report,
                        feature request, or feedback about the JWT Generator.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-builder-faqs" title="JWT Generator FAQs (Frequently Asked Questions)">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
