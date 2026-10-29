import type { JSX } from 'preact';
import { buildSiteHref, SITE_BASE_URL } from '../common/siteBaseUrl';
import { ToolArticleSection, ToolFaqList, type ToolFaqItem } from '../common/tool-article/ToolArticle';
import { ToolTutorialLinks } from '../common/tool-article/TutorialLinks';

/** Fixed HS256 example. Times are form inputs the builder converts to seconds. */
export const WORKED_EXAMPLE_SECRET = 'your-jwt-secret-key';
export const WORKED_EXAMPLE_EXP_INPUT = '2030-07-15T12:00:00Z';
export const WORKED_EXAMPLE_IAT_INPUT = '2030-01-15T12:00:00Z';
export const WORKED_EXAMPLE_HEADER_JSON = '{"alg":"HS256","typ":"JWT"}';
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

export const NODE_JWT_SNIPPET = `const jwt = require('jsonwebtoken');

const token = jwt.sign({
  exp: 1910347200,
  iat: 1894708800,
  nbf: 1894708800,
  iss: 'example-issuer',
  sub: 'user-123',
  aud: 'example-api',
  jti: 'example-token-1'
}, 'your-jwt-secret-key', { algorithm: 'HS256' });`;

export const PYTHON_JWT_SNIPPET = `import jwt

token = jwt.encode({
    "exp": 1910347200,
    "iat": 1894708800,
    "nbf": 1894708800,
    "iss": "example-issuer",
    "sub": "user-123",
    "aud": "example-api",
    "jti": "example-token-1",
}, "your-jwt-secret-key", algorithm="HS256")`;

export const PHP_JWT_SNIPPET = `use Firebase\\JWT\\JWT;

$token = JWT::encode([
    'exp' => 1910347200,
    'iat' => 1894708800,
    'nbf' => 1894708800,
    'iss' => 'example-issuer',
    'sub' => 'user-123',
    'aud' => 'example-api',
    'jti' => 'example-token-1',
], 'your-jwt-secret-key', 'HS256');`;

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
        'The tool supports HS256 with a shared secret and RS256 with an unencrypted PKCS#8 or PKCS#1 RSA private key that is 2048 bits or stronger.'
    ),
    createPlainTextFaqItem(
        'Can I verify or decode a JWT here?',
        'This page is focused on token creation. Use the CodeSamplez JWT Decoder to inspect an existing token; its signature validation currently supports HS256.'
    ),
    createPlainTextFaqItem(
        'Do JWTs expire?',
        'They can. JWTs expire when you include the exp claim, and setting an expiration time is recommended for better security.'
    ),
    createPlainTextFaqItem(
        'Is using an online JWT generator safe?',
        'For testing and development, yes. This generator works locally in your browser so claims and signing keys are not sent to a server, but you should still avoid pasting production secrets, private keys, or sensitive payloads into any online tool.'
    ),
    createPlainTextFaqItem(
        'How do I create a JWT token online?',
        'Enter the claims you need, choose HS256 or RS256, provide the matching signing key, and click Build JWT. The signed token appears under Generated JWT. Load Sample fills example claims, selects HS256, and sets the placeholder secret your-jwt-secret-key. Signing stays in your browser.'
    ),
    createPlainTextFaqItem(
        'Is it safe to generate a JWT in the browser?',
        'This page signs with the Web Crypto API and does not upload the claims or the key. They stay in memory for this page only. HS256 uses the shared-secret text as UTF-8 bytes. RS256 uses the PEM private key you paste. The placeholder secret and the Generate button are for local tests, so do not type a production secret or private key here.'
    ),
    createPlainTextFaqItem(
        'What shared-secret length should I use for HS256?',
        'The HS256 secret field accepts any non-empty string and does not enforce a minimum length. Generate fills a 32-character Base64URL test secret. The sample value your-jwt-secret-key is a placeholder, not a strong secret. For anything besides a local test, use a long random secret and do not reuse the placeholder.'
    ),
    createPlainTextFaqItem(
        'How do I set an expiration when I create a JWT token?',
        'Type an ISO 8601 time such as 2030-07-15T12:00:00Z in Expiration Time (exp), or a UNIX timestamp in seconds with at least 10 digits. The tool stores that as a number of seconds. The +1h, +24h, and +7d buttons set exp from the current time. Leave exp empty to omit it. A short number such as a year is rejected.'
    )
];

export function JwtBuilderIntro(): JSX.Element {
    return (
        <section className="c-tool-article c-tool-article--intro c-surface-card" aria-labelledby="jwt-builder-intro-heading">
            <div className="c-tool-article__content">
                <h2 id="jwt-builder-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    JWT Generator is a free browser-based tool to quickly create signed JSON Web Tokens. Enter your
                    standard claims, add custom claims, choose HS256 or RS256, provide the matching signing key, and generate a JWT without
                    writing code. Tool input is processed locally and is not uploaded.
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
                        To verify the token you generate, paste it into the{' '}
                        <a href={buildSiteHref('/jwt-decoder/')}>JWT Decoder and validator</a>.
                        That page shows the header and payload, and it can check an HS256 signature.
                        It does not validate RS256.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-builder-supported-features" title="Supported Features:">
                    <ul>
                        <li>
                            <strong>Support for standard JWT claims:</strong> `iss`, `sub`, `aud`, `exp`, `nbf`, `iat`,
                            and `jti`. Format claim JSON with the{' '}
                            <a href={buildSiteHref('/json-formatter/')}>JSON Formatter</a> before you sign.
                        </li>
                        <li><strong>Custom claim support:</strong> add claim rows dynamically and include string or JSON values.</li>
                        <li><strong>Flexible datetime parsing:</strong> use ISO 8601 values or UNIX timestamps for time-based claims.</li>
                        <li><strong>Automatic timestamp conversion:</strong> the tool converts supported datetime input into JWT-friendly numeric values.</li>
                        <li><strong>HS256 and RS256 signing:</strong> use a shared secret for HMAC SHA-256 or an unencrypted PKCS#8 or PKCS#1 RSA private key (2048 bits or stronger) for RSA SHA-256.</li>
                        <li><strong>Adaptive signing-key input:</strong> the key control and guidance update with the selected algorithm.</li>
                        <li>
                            <strong>Random secret generation:</strong> generate a cryptographically random 32-character
                            Base64URL secret for HS256 testing, or decode segments with the{' '}
                            <a href={buildSiteHref('/base64-converter/')}>Base64 Converter</a>.
                        </li>
                        <li><strong>Copy-ready output and validation feedback:</strong> build the token and copy it from the result panel.</li>
                    </ul>

                    <div className="c-tool-article__cta-row">
                        <a className="c-button" href={SITE_BASE_URL}>
                            Explore More Dev Tools
                        </a>
                    </div>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-builder-how-to-use" title="How To Use The JWT Generator:">
                    <ol>
                        <li><strong>Fill in the standard claims</strong> such as issuer, subject, audience, and expiration time.</li>
                        <li><strong>Add custom claims if needed</strong> by clicking <em>Add Claim</em> and entering the claim name and value.</li>
                        <li><strong>Choose HS256 or RS256</strong> as the signing algorithm.</li>
                        <li><strong>Enter the matching signature key:</strong> use a shared secret for HS256 or an unencrypted PKCS#8 or PKCS#1 RSA private key (2048 bits or stronger) for RS256.</li>
                        <li><strong>Click Build JWT</strong> to create the signed token.</li>
                        <li><strong>Copy the generated token</strong> from the output panel and use it in your app or test flow.</li>
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-builder-worked-example" title="Worked Example: A Signed JSON Web Token">
                    <p>
                        This example uses HS256, the placeholder secret <code>{WORKED_EXAMPLE_SECRET}</code>, and fixed
                        claims you can type into the form. Leave custom claims empty, then click Build JWT. Load Sample
                        is not this example: it uses the current time, the issuer codesamplez.com, and the same
                        placeholder secret.
                    </p>
                    <ul>
                        <li><code>iss</code>: example-issuer</li>
                        <li><code>sub</code>: user-123</li>
                        <li><code>aud</code>: example-api</li>
                        <li><code>exp</code>: {WORKED_EXAMPLE_EXP_INPUT}</li>
                        <li><code>iat</code> and <code>nbf</code>: {WORKED_EXAMPLE_IAT_INPUT}</li>
                        <li><code>jti</code>: example-token-1</li>
                        <li>Algorithm: HS256. Shared secret: <code>{WORKED_EXAMPLE_SECRET}</code></li>
                    </ul>
                    <p>
                        The header is always <code>alg</code> plus <code>typ</code> set to JWT. This page does not add{' '}
                        <code>kid</code> or any other header field. The compact header it encodes is:
                    </p>
                    <pre><code>{WORKED_EXAMPLE_HEADER_JSON}</code></pre>
                    <p>
                        <code>exp</code>, <code>iat</code>, and <code>nbf</code> are stored as seconds. In the order
                        the form writes them, the compact payload is:
                    </p>
                    <pre><code>{JSON.stringify(WORKED_EXAMPLE_PAYLOAD)}</code></pre>
                    <p>The signed token is three Base64URL segments separated by dots:</p>
                    <pre><code>{WORKED_EXAMPLE_TOKEN}</code></pre>
                    <ul>
                        <li>The first segment is the header above.</li>
                        <li>The second segment is the payload above.</li>
                        <li>
                            The third segment is the HS256 signature of those two segments joined by a dot. The HMAC
                            key is the UTF-8 text of <code>{WORKED_EXAMPLE_SECRET}</code>. The tool does not
                            Base64-decode that secret before signing.
                        </li>
                    </ul>
                    <p>
                        Paste that token into the{' '}
                        <a href={buildSiteHref('/jwt-decoder/')}>JWT Decoder and validator</a> to read the claims.
                        Signature checks there support HS256, which is the algorithm used here.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-builder-code-snippets" title="Generate a JWT in Code">
                    <p>
                        These snippets sign the same claims with HS256 and the placeholder secret{' '}
                        <code>{WORKED_EXAMPLE_SECRET}</code>. Use them only as a local test. jsonwebtoken 9 and PyJWT 2
                        produce the token in the example above. firebase/php-jwt 6 writes <code>typ</code> before{' '}
                        <code>alg</code> in the header, so its encoded string differs; the payload, algorithm, and
                        secret are the same.
                    </p>
                    <h3 className="c-tool-article__subheading">Node.js (jsonwebtoken)</h3>
                    <pre><code>{NODE_JWT_SNIPPET}</code></pre>
                    <h3 className="c-tool-article__subheading">Python (PyJWT)</h3>
                    <pre><code>{PYTHON_JWT_SNIPPET}</code></pre>
                    <h3 className="c-tool-article__subheading">PHP (firebase/php-jwt)</h3>
                    <pre><code>{PHP_JWT_SNIPPET}</code></pre>
                    <p>
                        For the RS256 option on this page, give those libraries an unencrypted PKCS#8 or PKCS#1 RSA
                        private key of 2048 bits or stronger and set the algorithm to RS256. Encrypted keys and public
                        keys are rejected here.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-builder-choosing-claims" title="Choosing Claims, Expiry, and a Signing Algorithm">
                    <p>
                        <code>iss</code>, <code>sub</code>, <code>aud</code>, <code>exp</code>, <code>nbf</code>,{' '}
                        <code>iat</code>, and <code>jti</code> are all optional. A blank field is left out of the
                        payload. <code>iss</code>, <code>sub</code>, <code>aud</code>, and <code>jti</code> are stored
                        as strings.
                    </p>
                    <p>
                        <code>exp</code>, <code>iat</code>, and <code>nbf</code> accept an ISO 8601 value such as{' '}
                        <code>{WORKED_EXAMPLE_IAT_INPUT}</code> or a UNIX timestamp in seconds with at least 10 digits.
                        The tool writes a number of seconds. A short integer such as <code>2030</code> is rejected.
                        Leave <code>exp</code> empty when you want no expiration claim. The +1h, +24h, and +7d buttons
                        set <code>exp</code> from the current time. Now sets <code>iat</code> or <code>nbf</code> to
                        the current time.
                    </p>
                    <p>
                        Add Claim appends a custom claim. A value that is valid JSON keeps that type, including
                        booleans, numbers, arrays, and objects. A number literal that JavaScript cannot store exactly
                        stays a string. Any other text stays a string.
                    </p>
                    <p>The algorithm selector offers HS256 and RS256 only.</p>
                    <ul>
                        <li>
                            <strong>HS256</strong> signs with HMAC SHA-256. The key is the UTF-8 text in Shared Secret.
                            Generate fills a 32-character Base64URL test secret and does not Base64-decode it.
                        </li>
                        <li>
                            <strong>RS256</strong> signs with RSASSA-PKCS1-v1_5 and SHA-256. Paste an unencrypted
                            PKCS#8 key (<code>BEGIN PRIVATE KEY</code>) or PKCS#1 key (<code>BEGIN RSA PRIVATE KEY</code>)
                            of 2048 bits or stronger. Encrypted keys and public keys are rejected.
                        </li>
                    </ul>
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
                        <li>Checks for missing required fields such as the algorithm-specific signing key. Issuer and expiration are optional per RFC 7519.</li>
                        <li>Validates supported datetime formats before token generation.</li>
                        <li>Parses JSON-style custom claim values when possible — including booleans, numbers, arrays, and objects — and falls back safely to strings. Numeric literals whose exact value cannot be represented as a JavaScript number (e.g. very large identifiers) keep their string form.</li>
                        <li>Explains malformed, unsupported, or public RSA keys without exposing sensitive values.</li>
                        <li>Reports when Web Crypto is unavailable separately from RSA key-format errors.</li>
                        <li>Keeps the result area clear when generation fails so invalid output is not reused accidentally.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="jwt-builder-security" title="Security/Privacy Considerations">
                    <ul>
                        <li><strong>Client-side only:</strong> no claim data, shared secrets, or private keys are sent to a server.</li>
                        <li><strong>Web Crypto based signing:</strong> cryptographic operations use browser APIs.</li>
                        <li><strong>No key storage:</strong> the signature key is used in memory only.</li>
                        <li><strong>Best for testing and development:</strong> avoid using production secrets or private keys in any browser tool.</li>
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
                        <li><strong>Cryptography:</strong> Web Crypto API with HMAC SHA-256 (HS256) and RSASSA-PKCS1-v1_5 SHA-256 (RS256) signing.</li>
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

                <ToolTutorialLinks toolId="jwt-builder" />

                <ToolArticleSection id="jwt-builder-faqs" title="JWT Generator FAQs (Frequently Asked Questions)">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
