import type { JSX } from 'preact';
import { formatBytes } from '../common/format-utils';
import { buildSiteHref, SITE_BASE_URL } from '../common/siteBaseUrl';
import { ToolArticleSection, ToolFaqList, type ToolFaqItem } from '../common/tool-article/ToolArticle';
import { minifyCSS } from './minifier';

function createPlainTextFaqItem(question: string, answer: string): ToolFaqItem {
    return {
        question,
        answer,
        structuredDataAnswer: answer
    };
}

/**
 * Worked stylesheet for the guide. The output is whatever minifyCSS returns
 * with the default options the page starts with (every checkbox checked).
 * The page trims the input before that call; this string has no outer whitespace.
 */
export const CSS_MINIFY_EXAMPLE_INPUT = `/* Card on a light page */
.card {
  margin: 0px;
  padding: 16px;
  color: #ffffff;
  width: calc(100% - 24px);
}

@media (max-width: 600px) {
  .card {
    padding: 12px;
  }
}`;

const CSS_MINIFY_EXAMPLE_SOURCE = CSS_MINIFY_EXAMPLE_INPUT.trim();
const CSS_MINIFY_EXAMPLE_OUTPUT = minifyCSS(CSS_MINIFY_EXAMPLE_SOURCE);
const CSS_MINIFY_EXAMPLE_ORIGINAL_BYTES = new Blob([CSS_MINIFY_EXAMPLE_SOURCE]).size;
const CSS_MINIFY_EXAMPLE_MINIFIED_BYTES = new Blob([CSS_MINIFY_EXAMPLE_OUTPUT]).size;

/** Sizes the Statistics panel prints for the example: Blob byte length, then formatBytes, and savings to one decimal. */
export const CSS_MINIFY_EXAMPLE = {
    input: CSS_MINIFY_EXAMPLE_INPUT,
    output: CSS_MINIFY_EXAMPLE_OUTPUT,
    originalBytes: CSS_MINIFY_EXAMPLE_ORIGINAL_BYTES,
    minifiedBytes: CSS_MINIFY_EXAMPLE_MINIFIED_BYTES,
    originalSizeLabel: formatBytes(CSS_MINIFY_EXAMPLE_ORIGINAL_BYTES),
    minifiedSizeLabel: formatBytes(CSS_MINIFY_EXAMPLE_MINIFIED_BYTES),
    savingsLabel: `${((1 - CSS_MINIFY_EXAMPLE_MINIFIED_BYTES / CSS_MINIFY_EXAMPLE_ORIGINAL_BYTES) * 100).toFixed(1)}%`
};

const JS_MINIFIER_FAQ_ANSWER = 'No. This page minifies CSS only. Minify scripts with the JavaScript Minifier and keep the two files separate. Do not paste JavaScript into this page.';

export const FAQ_ITEMS: ToolFaqItem[] = [
    createPlainTextFaqItem(
        'Does minifying CSS affect how my styles work?',
        'No. The rendered styles stay the same. The tool removes comments, extra whitespace, the unit on a zero, a repeated hex digit, and the last semicolon in a rule. It keeps quoted content, the spaces around + and - in calc(), and the order of your rules. The file is only smaller.'
    ),
    createPlainTextFaqItem(
        'Is the CodeSamplez CSS Minifier free to use?',
        'Yes, the CSS Minifier (and all tools on CodeSamplez.com) are completely free to use. There is no registration required and no usage limits, so you can minify as many CSS files as you need.'
    ),
    createPlainTextFaqItem(
        'Does this tool store or send my CSS data?',
        'No, the tool does not store your code. All minification is done on the fly in the browser, without saving any data. Your pasted CSS is not retained or shared, ensuring your code stays private.'
    ),
    createPlainTextFaqItem(
        'Can I unminify (beautify) the CSS again later?',
        'While minified CSS is harder to read or edit, you can revert it using a CSS beautifier or formatter tool. It is a good practice to keep a formatted copy of your CSS for development, and use the minified version for production.'
    ),
    createPlainTextFaqItem(
        'How much does CSS minification reduce file size?',
        `It depends on comments and indentation. The before-and-after example on this page is ${CSS_MINIFY_EXAMPLE.originalSizeLabel} (${CSS_MINIFY_EXAMPLE.originalBytes} bytes) before and ${CSS_MINIFY_EXAMPLE.minifiedSizeLabel} (${CSS_MINIFY_EXAMPLE.minifiedBytes} bytes) after, which is ${CSS_MINIFY_EXAMPLE.savingsLabel} smaller. The Statistics panel shows those Original Size, Minified Size, and Savings labels for the CSS you paste. A stylesheet that is already one line saves less.`
    ),
    createPlainTextFaqItem(
        'Can minifying CSS break my site?',
        'It can, if a minifier drops a space the browser still needs. This page keeps spaces inside quoted content and the spaces around + and - in calc(), min(), max(), and clamp(). It also keeps @media rules in the order you wrote them. It removes comments, extra whitespace, the unit on a zero, a repeated hex digit, and the last semicolon in a rule. Invalid CSS is not minified: the page shows "Invalid CSS input. Please check your CSS syntax." and leaves Minified Output empty. Compare the rendered page before you replace the file.'
    ),
    {
        question: 'Should I minify CSS and JS together?',
        answer: (
            <p>
                No. This page minifies CSS only. Minify scripts with the{' '}
                <a href={buildSiteHref('/js-minifier/')}>JavaScript Minifier</a>
                {' '}and keep the two files separate. Do not paste JavaScript into this page.
            </p>
        ),
        structuredDataAnswer: JS_MINIFIER_FAQ_ANSWER
    }
];

export function CssMinifierIntro(): JSX.Element {
    return (
        <section className="c-tool-article c-tool-article--intro c-surface-card" aria-labelledby="css-minifier-intro-heading">
            <div className="c-tool-article__content">
                <h2 id="css-minifier-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    CSS Minification is the process of removing unnecessary characters such as spaces, line breaks,
                    and comments from CSS code. This free online CSS minifier tool streamlines your stylesheets by
                    stripping out extraneous content without changing how your CSS works, resulting in smaller file
                    sizes and faster webpage load times.
                </p>
            </div>
        </section>
    );
}

export function CssMinifierArticle(): JSX.Element {
    return (
        <section className="c-tool-article c-surface-card" aria-labelledby="css-minifier-article-heading">
            <div className="c-tool-article__content">
                <h2 id="css-minifier-article-heading" className="c-tool-article__sr-only">CSS Minifier Guide</h2>

                <ToolArticleSection id="css-minifier-what-is" title="What is a CSS Minifier?">
                    <p>
                        A CSS minifier is an online tool or program that compresses CSS code by removing unnecessary
                        characters such as whitespace, line breaks, and comments without changing the CSS output. In
                        short, it streamlines your stylesheet to reduce its file size and help web pages load faster.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="css-minifier-why" title="Why minify CSS?">
                    <p>Minifying CSS offers several benefits:</p>
                    <ul>
                        <li>It reduces file size, which means your web pages load faster and consume less bandwidth.</li>
                        <li>Faster load times improve user experience and can help SEO since search engines favor speed.</li>
                        <li>Minified files also reduce server load and make your codebase more efficient.</li>
                    </ul>
                    <p>
                        In short, it is a best practice to minify your CSS and other assets before deploying a website
                        for better performance.
                    </p>

                    <div className="c-tool-article__cta-row">
                        <a className="c-button" href={SITE_BASE_URL}>
                            Explore More Dev Tools
                        </a>
                    </div>
                </ToolArticleSection>

                <ToolArticleSection id="css-minifier-how-to-use" title="How do I minify CSS online?">
                    <ol>
                        <li>
                            <strong>Enter your CSS code</strong>
                            <p>Paste the code you are trying to minify.</p>
                        </li>
                        <li>
                            <strong>(Optional) Configure your preferences</strong>
                            <p>Check or uncheck options if you have any specific preferences about what aspects to minify.</p>
                        </li>
                        <li>
                            <strong>Click the &ldquo;Minify CSS&rdquo; button</strong>
                            <p>The minified output will show up in the result area.</p>
                        </li>
                        <li>
                            <strong>Copy your result</strong>
                            <p>Select the minified CSS output or use the copy button for quick copy-to-clipboard.</p>
                        </li>
                    </ol>

                    <h3>Example Workflow</h3>
                    <p><strong>Input:</strong></p>
                    <pre><code>{`/* Header styling */
body {
  font-family: Arial, sans-serif;
}

.header {
  padding: 20px;
}`}</code></pre>

                    <p><strong>Output:</strong></p>
                    <pre><code>{`body{font-family:Arial,sans-serif}.header{padding:20px}`}</code></pre>
                </ToolArticleSection>

                <ToolArticleSection id="css-minifier-example" title="CSS Minification Example (Before and After)">
                    <p>
                        Paste the stylesheet below and leave every minification option checked. Those checkboxes
                        start checked. Load Sample fills a different stylesheet. This example has a comment,
                        indentation, a media query, and a <code>calc()</code>.
                    </p>
                    <p><strong>Before</strong> ({CSS_MINIFY_EXAMPLE.originalSizeLabel}, {CSS_MINIFY_EXAMPLE.originalBytes} bytes):</p>
                    <pre><code>{CSS_MINIFY_EXAMPLE.input}</code></pre>
                    <p>
                        <strong>After</strong> ({CSS_MINIFY_EXAMPLE.minifiedSizeLabel}, {CSS_MINIFY_EXAMPLE.minifiedBytes} bytes, {CSS_MINIFY_EXAMPLE.savingsLabel} smaller):
                    </p>
                    <pre><code>{CSS_MINIFY_EXAMPLE.output}</code></pre>
                    <p>
                        That is the string Minify CSS writes for this input. The comment is gone, <code>0px</code> is{' '}
                        <code>0</code>, and <code>#ffffff</code> is <code>#fff</code> (the same color). The spaces in{' '}
                        <code>calc(100% - 24px)</code> stay. Without those spaces the declaration is invalid and
                        browsers drop it. The <code>@media</code> rule still follows the base <code>.card</code> rule,
                        so the <code>12px</code> padding still wins at that breakpoint. The Statistics panel shows the
                        same figures: Original Size {CSS_MINIFY_EXAMPLE.originalSizeLabel}, Minified Size{' '}
                        {CSS_MINIFY_EXAMPLE.minifiedSizeLabel}, Savings {CSS_MINIFY_EXAMPLE.savingsLabel}.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="css-minifier-how-to-test" title="How to Test Your Minified CSS">
                    <p>Check the result the same way you would check any stylesheet you are about to ship.</p>
                    <ol>
                        <li>
                            <strong>Compare the file size</strong>
                            <p>
                                After Minify CSS, read Original Size, Minified Size, and Savings in the Statistics
                                panel. Those labels are the UTF-8 byte size of the input, the UTF-8 byte size of the
                                output, and the percent saved, rounded to one decimal. For the example above they
                                read {CSS_MINIFY_EXAMPLE.originalSizeLabel}, {CSS_MINIFY_EXAMPLE.minifiedSizeLabel}, and{' '}
                                {CSS_MINIFY_EXAMPLE.savingsLabel}.
                            </p>
                        </li>
                        <li>
                            <strong>Run the output through validation</strong>
                            <p>
                                Paste the minified CSS back into Input CSS and click Minify CSS again. The tool checks
                                the text with the browser&apos;s CSS parser before it minifies. Valid CSS fills Minified
                                Output. Invalid CSS shows{' '}
                                <code>Invalid CSS input. Please check your CSS syntax.</code> and Minified Output stays
                                empty.
                            </p>
                        </li>
                        <li>
                            <strong>Check that the page renders the same</strong>
                            <p>
                                Swap the minified file in for the original and compare the page in browser devtools or
                                a visual diff. <code>#fff</code> is the same color as <code>#ffffff</code>, and{' '}
                                <code>0</code> is the same length as <code>0px</code>.
                            </p>
                        </li>
                        <li>
                            <strong>Watch the edge cases this tool keeps</strong>
                            <p>
                                Spaces, commas, and braces inside a quoted <code>content</code> value stay in the
                                output. Spaces around <code>+</code> and <code>-</code> inside <code>calc()</code>,{' '}
                                <code>min()</code>, <code>max()</code>, and <code>clamp()</code> stay; the example
                                keeps <code>calc(100% - 24px)</code>. An <code>@media</code> block stays after the
                                rules written above it, so a later rule of the same specificity still overrides the
                                earlier one.
                            </p>
                        </li>
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="css-minifier-features" title="Online CSS Minifier Tool Features">
                    <h3>Core Optimizations</h3>
                    <ul>
                        <li><strong>Comment Removal:</strong> Eliminates both single-line and multi-line <code>/* ... */</code> comments.</li>
                        <li><strong>Whitespace Optimization:</strong> Removes unnecessary spaces, tabs, and line breaks while preserving essential spaces in selectors and around syntax.</li>
                        <li><strong>Media Query Optimization:</strong> Maintains media query structure while minimizing internal content.</li>
                        <li><strong>Unit Optimization:</strong> Removes unnecessary units such as <code>0px</code> to <code>0</code>.</li>
                        <li><strong>Selector Combination:</strong> Merges rules with identical declarations.</li>
                        <li><strong>Syntax Preservation:</strong> Maintains valid CSS syntax throughout optimization.</li>
                    </ul>

                    <h3>Advanced Features</h3>
                    <ul>
                        <li><strong>Media Query Support:</strong> Properly handles nested media queries while maintaining functionality.</li>
                        <li><strong>Smart Space Management:</strong> Optimizes spaces around selectors, operators, and brackets while preserving spaces needed in complex selectors.</li>
                        <li><strong>Declaration Block Optimization:</strong> Combines identical selectors, maintains proper semicolon placement, and preserves important declarations.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="css-minifier-error-handling" title="Error Handling">
                    <p>
                        The tool performs an initial validation of the input CSS using the browser&apos;s built-in CSS
                        parser before running the minification pipeline.
                    </p>
                    <ul>
                        <li><strong>Invalid CSS Syntax:</strong> If the CSS is syntactically incorrect, the tool shows an error message and stops processing.</li>
                        <li><strong>Statistics reset:</strong> Original size, minified size, and savings are cleared or remain in an error-safe state when validation fails.</li>
                        <li><strong>Safer processing:</strong> This validation step helps ensure the minifier only processes structurally sound CSS.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="css-minifier-security" title="Security Features">
                    <ul>
                        <li><strong>Input Validation:</strong> The tool processes user-provided CSS without executing it, minimizing injection risks.</li>
                        <li><strong>No External Dependencies:</strong> Self-contained processing reduces potential security vulnerabilities.</li>
                        <li><strong>Client-Side Only:</strong> All processing happens locally in the browser without sending data to remote servers.</li>
                        <li><strong>Output Sanitization:</strong> The minified output preserves valid CSS syntax without introducing unsafe modifications.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="css-minifier-browser-compatibility" title="Browser Compatibility">
                    <h3>Full Support</h3>
                    <ul>
                        <li>Chrome 49+</li>
                        <li>Firefox 45+</li>
                        <li>Safari 9+</li>
                        <li>Edge 12+</li>
                        <li>Opera 36+</li>
                    </ul>

                    <h3>Partial Support</h3>
                    <ul>
                        <li>Internet Explorer 11 for basic functionality</li>
                        <li>Older mobile browsers</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="css-minifier-limitations" title="Limitations">
                    <ul>
                        <li>Does not optimize property names such as <code>margin-left</code> to abbreviated aliases.</li>
                        <li>Maintains CSS syntax validity during minification instead of doing aggressive transforms.</li>
                        <li>Best for basic optimization of a modern CSS code base.</li>
                        <li>
                            Tidy JSON config shipped alongside styles with the{' '}
                            <a href={buildSiteHref('/json-formatter/')}>JSON Formatter</a>, or{' '}
                            <a href={buildSiteHref('/diff-checker/')}>diff the minified CSS</a> against your source
                            file.
                        </li>
                    </ul>
                    <p>
                        For advanced optimization, consider using tools like PurifyCSS or a dedicated build pipeline.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="css-minifier-related-tool" title="Related Tool">
                    <p>
                        Need to minify JavaScript code too? Try our{' '}
                        <a href={buildSiteHref('/js-minifier/')}>JavaScript Minifier</a>.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="css-minifier-faqs" title="CSS Minifier FAQs">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
