import type { JSX } from 'preact';
import { SITE_BASE_URL } from '../common/siteBaseUrl';
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
        'What is a JSON Formatter?',
        'A JSON Formatter is an online tool that takes unformatted or minified JSON data and beautifies it by adding proper indentation and line breaks. This makes the JSON much easier for humans to read and debug.'
    ),
    createPlainTextFaqItem(
        'How do I pretty-print JSON?',
        'To pretty-print JSON, you can use an online JSON Formatter. Simply paste your JSON and click the format button. The tool will output a nicely indented JSON structure with sorted keys and highlighted syntax for easy reading.'
    ),
    createPlainTextFaqItem(
        'Is an online JSON formatter safe to use?',
        'Yes - as long as the formatter runs in your browser (client-side), your JSON data is not sent anywhere, making it safe. The CodeSamplez JSON Formatter Tool processes JSON locally, so your sensitive data never leaves your computer.'
    ),
    createPlainTextFaqItem(
        'Can a JSON Formatter also validate JSON?',
        'Yes, this JSON Formatter also acts as a validator. If your JSON has a syntax error like a missing comma or quote, the tool will alert you and pinpoint the error so you can fix it and format again.'
    )
];

export function JsonFormatterIntro(): JSX.Element {
    return (
        <section className="c-tool-article c-tool-article--intro c-surface-card" aria-labelledby="json-formatter-intro-heading">
            <div className="c-tool-article__content">
                <h2 id="json-formatter-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    Struggling to read messy JSON? Our free Online JSON Formatter beautifies raw JSON instantly,
                    adding indentation and color highlights so you can actually read it. Paste your JSON and get a
                    clear, error-checked output in seconds. Bonus: it even sorts object keys alphabetically for
                    consistency.
                </p>
            </div>
        </section>
    );
}

export function JsonFormatterArticle(): JSX.Element {
    return (
        <section className="c-tool-article c-surface-card" aria-labelledby="json-formatter-article-heading">
            <div className="c-tool-article__content">
                <h2 id="json-formatter-article-heading" className="c-tool-article__sr-only">JSON Formatter Guide</h2>

                <ToolArticleSection id="json-formatter-why" title="Why Use A JSON Formatter Tool?">
                    <ul>
                        <li>Human-readability: indentation and line breaks make JSON easier to understand.</li>
                        <li>Easier debugging: errors stand out when JSON is properly formatted.</li>
                        <li>Save time instead of trying to format with manually written code.</li>
                        <li>Secure and can work offline once loaded. Runs in your browser, so your data is not sent to a server.</li>
                    </ul>

                    <div className="c-tool-article__cta-row">
                        <a className="c-button" href={SITE_BASE_URL}>
                            Explore More Dev Tools
                        </a>
                    </div>
                </ToolArticleSection>

                <ToolArticleSection id="json-formatter-features" title="JSON Formatter Features">
                    <ul>
                        <li><strong>Pretty-print:</strong> Beautifies and formats JSON data with proper indentation.</li>
                        <li><strong>Key Sorting:</strong> Optionally sorts object keys alphabetically for consistent output.</li>
                        <li><strong>Validation:</strong> Validates JSON syntax with detailed error messages and specific error details.</li>
                        <li><strong>Auto Fix:</strong> Auto-fixes common JSON errors and is enabled by default.</li>
                        <li><strong>Copy to clipboard / Download:</strong> Copy formatted output with confirmation or download it as a <code>.json</code> file.</li>
                        <li><strong>Syntax highlighting:</strong> Color-coded keys and values improve readability in tree view.</li>
                        <li><strong>Tree Node Expand/Collapse:</strong> Expand or collapse nested objects and arrays while preserving structure.</li>
                        <li><strong>Size Comparison:</strong> Real-time size updates support bytes, KB, MB, and GB with accurate formatting.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="json-formatter-how-to-use" title="How to Format JSON (Step-by-Step)">
                    <ol>
                        <li>
                            <strong>Enter JSON Data</strong>
                            <p>Paste your JSON string into the input area, or use the &ldquo;Load Sample&rdquo; button if you are just trying out the tool.</p>
                        </li>
                        <li>
                            <strong>(Optional) Update Configuration</strong>
                            <p>Toggle the &ldquo;Auto fix&rdquo; checkbox to enable or disable automatic error correction, and toggle &ldquo;Sort keys&rdquo; to enable or disable key sorting.</p>
                        </li>
                        <li>
                            <strong>Validate and Format</strong>
                            <p>Click &ldquo;Format JSON&rdquo; to validate and format the input with proper indentation.</p>
                        </li>
                        <li>
                            <strong>Pick your preferred result view</strong>
                            <p>Switch between tree view and plain text to inspect the formatted JSON the way you prefer.</p>
                        </li>
                        <li>
                            <strong>Copy formatted JSON</strong>
                            <p>Click &ldquo;Copy Output&rdquo; to copy the result after the tool confirms the operation succeeded.</p>
                        </li>
                        <li>
                            <strong>Handle errors</strong>
                            <p>If the JSON is invalid, the input is preserved and the error message indicates the issue so you can fix it quickly.</p>
                        </li>
                    </ol>

                    <p><strong>Example Input:</strong></p>
                    <pre><code>{`{"z":1,"a":{"d":2,"c":3},"b":[4,3,2]}`}</code></pre>

                    <p><strong>Example Output:</strong></p>
                    <pre><code>{`{
  "a": {
    "c": 3,
    "d": 2
  },
  "b": [
    4,
    3,
    2
  ],
  "z": 1
}`}</code></pre>
                </ToolArticleSection>

                <ToolArticleSection id="json-formatter-limitations" title="JSON Formatter Current Limitations">
                    <ul>
                        <li>Large JSON files may impact performance.</li>
                        <li>The tool currently does not sort array elements and only sorts object keys.</li>
                        <li>Clipboard operations require a secure context such as HTTPS or localhost.</li>
                        <li>Does not preserve trailing commas.</li>
                        <li>Unicode characters in strings are not escaped or unescaped.</li>
                        <li>No support for JSON5 or JSON with comments (JSONC).</li>
                        <li>The auto-fix feature is not a full JSON5 parser and may not fix all syntax errors.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="json-formatter-error-handling" title="Error Handling">
                    <p>This JSON Formatter Tool provides specific error messages for common JSON syntax errors:</p>
                    <ul>
                        <li>Missing or extra commas</li>
                        <li>Unclosed brackets or braces</li>
                        <li>Invalid property names</li>
                        <li>Missing colons</li>
                        <li>Invalid values</li>
                    </ul>
                    <p>You will see any errors below the input area, including the position where the tool detected the issue.</p>
                </ToolArticleSection>

                <ToolArticleSection id="json-formatter-privacy" title="Privacy & Security">
                    <ul>
                        <li>100% client-side processing: all JSON formatting and validation happens in your browser.</li>
                        <li>No server storage: your JSON data is never saved or transmitted to any server.</li>
                        <li>Offline support: fully functional without an internet connection once loaded.</li>
                        <li>Zero data collection: no cookies, tracking, or data persistence of any kind.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="json-formatter-browser-support" title="Browser Support">
                    <ul>
                        <li><strong>Modern Browsers:</strong> Chrome, Firefox, Safari, Edge</li>
                        <li><strong>Requirements:</strong> JavaScript enabled</li>
                        <li><strong>Copy functionality:</strong> Primary support comes from the modern Clipboard API on HTTPS or localhost, with <code>execCommand</code> fallback for older browsers or HTTP contexts.</li>
                        <li><strong>Mobile Support:</strong> Fully responsive design with touch-friendly controls.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="json-formatter-feedback" title="Feedback">
                    <p>
                        Please <a href="https://codesamplez.com/contact">contact us</a> for any bug report, feature
                        request, or feedback.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="json-formatter-faqs" title="JSON Formatter FAQs">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
