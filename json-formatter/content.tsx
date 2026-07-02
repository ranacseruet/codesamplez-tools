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
    ),
    createPlainTextFaqItem(
        'How do I fix "Unexpected token" errors in JSON?',
        'An "Unexpected token" error means the parser hit a character it did not expect at that position - usually a stray comma, an unquoted key, single quotes instead of double quotes, or a missing bracket. Paste the JSON into this tool and click "Format JSON"; the validator reports the exact line and column, and "Go to error" jumps straight to the offending character so you can fix it.'
    ),
    createPlainTextFaqItem(
        'What is the difference between JSON, JSON5, and JSONC?',
        'JSON is the strict standard: double-quoted keys and strings only, no comments, and no trailing commas. JSON5 extends it with comments, trailing commas, unquoted keys, and single-quoted strings for easier hand-editing. JSONC ("JSON with Comments") is plain JSON plus // and /* */ comments, commonly used in editor config files like tsconfig.json. This tool parses strict JSON, so JSON5 or JSONC input should be converted to JSON first.'
    ),
    createPlainTextFaqItem(
        'Is it safe to paste API keys or secrets into an online JSON formatter?',
        'With this tool, yes - all formatting and validation happens entirely in your browser via JavaScript, and no JSON you paste is ever sent to a server. That said, avoid pasting secrets into formatters you have not verified are client-side, since some tools upload input for server-side processing.'
    ),
    createPlainTextFaqItem(
        'How do I format JSON in VS Code or the terminal vs. online?',
        'In VS Code, select the JSON and press Shift+Alt+F (Shift+Option+F on macOS), or right-click and choose "Format Document". In a terminal, pipe it through a tool like "python -m json.tool" or "jq .". An online formatter like this one needs no install, works on any device, and adds features like tree view, key sorting, and error highlighting that most editors and CLI tools do not.'
    ),
    createPlainTextFaqItem(
        'How do I minify JSON, and why minify it?',
        'To minify JSON with this tool, choose the "Minified" indentation option and click "Format JSON" - the output collapses to a single line with no extra whitespace. Minifying reduces payload size for network transfer and storage, which matters for API responses and config files where every byte counts; pretty-printed JSON is for humans, minified JSON is for machines.'
    ),
    createPlainTextFaqItem(
        'What does a "trailing comma" or "expected property name" JSON error mean?',
        'Browsers word this error differently (for example "Expected property name or \'}\'" in Firefox, or "Expected double-quoted property name" in Chrome), but the cause is the same: the parser expected a quoted property name or a closing brace at that position and found something else instead - commonly a trailing comma before a closing brace (e.g. {"a":1,}) or a missing key. Enable "Auto fix" before formatting to have the tool correct common cases like trailing commas automatically, or use "Go to error" to jump to the exact spot and fix it manually.'
    )
];

export interface ToolHowToStep {
    name: string;
    text: string;
}

export const HOWTO_STEPS: ToolHowToStep[] = [
    {
        name: 'Enter JSON Data',
        text: 'Paste your JSON string into the input area, or use the "Load Sample" button if you are just trying out the tool.'
    },
    {
        name: '(Optional) Update Configuration',
        text: 'Toggle the "Auto fix" checkbox to enable or disable automatic error correction, toggle "Sort keys" to enable or disable key sorting, and pick an "Indent" option (2 spaces, 4 spaces, Tab, or Minified).'
    },
    {
        name: 'Validate and Format',
        text: 'Click "Format JSON" to validate and format the input with proper indentation.'
    },
    {
        name: 'Pick your preferred result view',
        text: 'Switch between tree view and plain text to inspect the formatted JSON the way you prefer.'
    },
    {
        name: 'Copy formatted JSON',
        text: 'Click "Copy Output" to copy the result after the tool confirms the operation succeeded.'
    },
    {
        name: 'Handle errors',
        text: 'If the JSON is invalid, the input is preserved and the error message indicates the issue so you can fix it quickly.'
    }
];

export const FEATURE_LIST: string[] = [
    'Pretty-print with selectable indentation',
    'Minify to a single line',
    'Alphabetical key sorting',
    'Syntax validation with line/column error detail',
    'Auto fix for common JSON errors',
    'Copy to clipboard and download as .json',
    'Syntax highlighting',
    'Tree node expand/collapse',
    'Real-time size comparison'
];

export function JsonFormatterIntro(): JSX.Element {
    return (
        <section className="c-tool-article c-tool-article--intro c-surface-card" aria-labelledby="json-formatter-intro-heading">
            <div className="c-tool-article__content">
                <h2 id="json-formatter-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    A JSON formatter is a tool that takes raw or minified JSON and rewrites it with indentation,
                    line breaks, and syntax highlighting so it is readable and easy to debug. Use one whenever you
                    need to inspect an API response, validate a config file, or track down a syntax error in JSON
                    that arrived as a single unreadable line.
                </p>
                <p className="c-tool-article__lead">
                    Our free Online JSON Formatter beautifies raw JSON instantly, adding indentation and color
                    highlights so you can actually read it. Paste your JSON and get a clear, error-checked output
                    in seconds. Bonus: it even sorts object keys alphabetically for consistency.
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
                        <li><strong>Pretty-print:</strong> Beautifies and formats JSON data with selectable indentation (2 spaces, 4 spaces, or Tab).</li>
                        <li><strong>Minify:</strong> Compacts JSON to a single line with no whitespace via the "Minified" indentation option.</li>
                        <li><strong>Key Sorting:</strong> Optionally sorts object keys alphabetically for consistent output.</li>
                        <li><strong>Validation:</strong> Validates JSON syntax with detailed error messages, the exact line and column, and a &ldquo;Go to error&rdquo; jump that highlights the offending character in your input.</li>
                        <li><strong>Auto Fix:</strong> Auto-fixes common JSON errors and is enabled by default.</li>
                        <li><strong>Copy to clipboard / Download:</strong> Copy formatted output with confirmation or download it as a <code>.json</code> file.</li>
                        <li><strong>Syntax highlighting:</strong> Color-coded keys and values improve readability in tree view.</li>
                        <li><strong>Tree Node Expand/Collapse:</strong> Expand or collapse nested objects and arrays while preserving structure, with Expand All / Collapse All controls.</li>
                        <li><strong>Size Comparison:</strong> Real-time size updates support bytes, KB, MB, and GB with accurate formatting.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="json-formatter-how-to-use" title="How to Format JSON (Step-by-Step)">
                    <ol>
                        {HOWTO_STEPS.map((step) => (
                            <li key={step.name}>
                                <strong>{step.name}</strong>
                                <p>{step.text}</p>
                            </li>
                        ))}
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
                    <p>You will see any errors below the input area, including the line and column where the tool detected the issue. Use the &ldquo;Go to error&rdquo; button to jump straight to that spot in your input, with the offending character selected.</p>
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
