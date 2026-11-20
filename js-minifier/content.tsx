import type { JSX } from 'preact';
import { formatBytes } from '../common/format-utils';
import { SITE_BASE_URL, buildSiteHref } from '../common/siteBaseUrl';
import { ToolArticleSection, ToolFaqList, type ToolFaqItem } from '../common/tool-article/ToolArticle';
import { JSMinifier } from './minifier';

function createPlainTextFaqItem(question: string, answer: string): ToolFaqItem {
    return {
        question,
        answer,
        structuredDataAnswer: answer
    };
}

/**
 * Worked script for the guide. The output is whatever `new JSMinifier(options).minify`
 * returns — the same call the Minify JavaScript button makes — with Remove comments,
 * Remove whitespace, and Shorten variable names on, and Mangle properties off.
 * That option set is what produces the example already published on this page.
 * The page does not trim the textarea before minify; this string has no outer whitespace.
 */
export const JS_MINIFY_EXAMPLE_INPUT = `// Example JavaScript function
function calculateSum(numbers) {
  // This function calculates the sum of all numbers in an array
  let sum = 0;

  for (let i = 0; i < numbers.length; i++) {
    // Add each number to the sum
    sum = sum + numbers[i];
  }

  // Return the final sum
  return sum;
}

const myNumbers = [1, 2, 3, 4, 5];
const result = calculateSum(myNumbers);
console.log("The sum is: " + result);`;

const JS_MINIFY_EXAMPLE_OPTIONS = {
    removeComments: true,
    removeWhitespace: true,
    shortenVariables: true,
    mangleProperties: false
};

const JS_MINIFY_EXAMPLE_OUTPUT = new JSMinifier(JS_MINIFY_EXAMPLE_OPTIONS).minify(JS_MINIFY_EXAMPLE_INPUT);
const JS_MINIFY_EXAMPLE_ORIGINAL_BYTES = new Blob([JS_MINIFY_EXAMPLE_INPUT]).size;
const JS_MINIFY_EXAMPLE_MINIFIED_BYTES = new Blob([JS_MINIFY_EXAMPLE_OUTPUT]).size;

/** Sizes the Statistics panel prints: Blob byte length, then formatBytes, and Compression Ratio to two decimals. */
export const JS_MINIFY_EXAMPLE = {
    input: JS_MINIFY_EXAMPLE_INPUT,
    output: JS_MINIFY_EXAMPLE_OUTPUT,
    originalBytes: JS_MINIFY_EXAMPLE_ORIGINAL_BYTES,
    minifiedBytes: JS_MINIFY_EXAMPLE_MINIFIED_BYTES,
    originalSizeLabel: formatBytes(JS_MINIFY_EXAMPLE_ORIGINAL_BYTES),
    minifiedSizeLabel: formatBytes(JS_MINIFY_EXAMPLE_MINIFIED_BYTES),
    ratioLabel: `${((1 - JS_MINIFY_EXAMPLE_MINIFIED_BYTES / JS_MINIFY_EXAMPLE_ORIGINAL_BYTES) * 100).toFixed(2)}%`
};

const PROPERTY_MANGLE_INPUT = `const user = { firstName: "John", lastName: "Doe" };
console.log(user.firstName + " " + user.lastName);`;

const PROPERTY_MANGLE_OUTPUT = new JSMinifier({
    removeComments: true,
    removeWhitespace: true,
    shortenVariables: false,
    mangleProperties: true
}).minify(PROPERTY_MANGLE_INPUT);

const CODE_MINIFIER_FAQ_ANSWER = 'No. This page minifies JavaScript only. Minify stylesheets with the CSS Minifier. For JSON, open the JSON Formatter and choose the Minified indentation option. Do not paste CSS or JSON into this page.';

export const FAQ_ITEMS: ToolFaqItem[] = [
    createPlainTextFaqItem(
        'What is JavaScript minification and why is it important?',
        'JavaScript minification removes characters the program does not need to run, such as spaces, line breaks, and comments, and can shorten local names when that option is on. The logic stays the same. A smaller file reaches the browser sooner, which helps on slow connections and large scripts.'
    ),
    createPlainTextFaqItem(
        'Will minifying JavaScript break my code?',
        'No, minification does not break code if done correctly. It only removes or alters characters that do not affect execution, such as stripping comments or shortening safe identifiers. The logic and functionality remain the same, but you should still test minified output before deployment, especially if you enable experimental options.'
    ),
    createPlainTextFaqItem(
        'Is this JavaScript minifier tool free to use?',
        'Yes. The CodeSamplez JavaScript Minifier, like the other tools on CodeSamplez.com, is completely free to use with no signup required. You can minify as many files or lines of code as you need.'
    ),
    createPlainTextFaqItem(
        'Does the tool send my code to a server?',
        'No. Everything runs locally in your browser. The tool uses in-browser scripts to compress your code, so your JavaScript never leaves your computer. That keeps the workflow private and secure.'
    ),
    createPlainTextFaqItem(
        'How much can JS minification reduce file size?',
        `It depends on comments, indentation, and whether Shorten variable names is on. The before-and-after example on this page is ${JS_MINIFY_EXAMPLE.originalSizeLabel} (${JS_MINIFY_EXAMPLE.originalBytes} bytes) before and ${JS_MINIFY_EXAMPLE.minifiedSizeLabel} (${JS_MINIFY_EXAMPLE.minifiedBytes} bytes) after, which is ${JS_MINIFY_EXAMPLE.ratioLabel} smaller, with Remove comments, Remove whitespace, and Shorten variable names checked and Mangle properties off. The Statistics panel shows those Original Size, Minified Size, and Compression Ratio labels for the JavaScript you paste. A file that is already one line saves less.`
    ),
    createPlainTextFaqItem(
        'Is minification the same as obfuscation?',
        'No. Minification focuses on reducing file size and improving performance, while obfuscation is designed to make code harder for humans to read. Minified code may look dense because whitespace and long names are removed, but the primary goal is optimization, not concealment.'
    ),
    createPlainTextFaqItem(
        'Is minifying JavaScript the same as gzip compression?',
        `No. Minifying rewrites the source by removing comments and whitespace, and it can shorten local names when that option is on. gzip and Brotli compress the bytes during transfer and leave your source file unchanged. Use both: minify, then let the server compress the smaller file. The Compression Ratio on this page is the minification savings. For the example that is ${JS_MINIFY_EXAMPLE.originalSizeLabel} to ${JS_MINIFY_EXAMPLE.minifiedSizeLabel}, ${JS_MINIFY_EXAMPLE.ratioLabel} smaller, not a gzip ratio.`
    ),
    {
        question: 'Can I use this as a general code minifier for CSS or JSON?',
        answer: (
            <p>
                No. This page minifies JavaScript only. Minify stylesheets with the{' '}
                <a href={buildSiteHref('/css-minifier/')}>CSS Minifier</a>
                {'. For JSON, open the '}
                <a href={buildSiteHref('/json-formatter/')}>JSON Formatter</a>
                {' '}and choose the Minified indentation option. Do not paste CSS or JSON into this page.
            </p>
        ),
        structuredDataAnswer: CODE_MINIFIER_FAQ_ANSWER
    }
];

export function JSMinifierIntro(): JSX.Element {
    return (
        <section className="c-tool-article c-tool-article--intro c-surface-card" aria-labelledby="js-minifier-intro-heading">
            <div className="c-tool-article__content">
                <h2 id="js-minifier-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    Minify your JavaScript code online to dramatically reduce file size and improve web performance.
                    This free online JavaScript Minifier removes unnecessary characters such as comments and
                    whitespace and compresses code without changing its functionality. With configurable options and
                    real-time output, it helps you produce smaller, faster-loading files in seconds.
                </p>
            </div>
        </section>
    );
}

export function JSMinifierArticle(): JSX.Element {
    return (
        <section className="c-tool-article c-surface-card" aria-labelledby="js-minifier-article-heading">
            <div className="c-tool-article__content">
                <h2 id="js-minifier-article-heading" className="c-tool-article__sr-only">JavaScript Minifier Guide</h2>

                <ToolArticleSection id="js-minifier-why" title="Why Minify JavaScript?">
                    <p>
                        Minification converts your code into an equivalent form with fewer characters by stripping out
                        anything not needed for execution. That can shrink JavaScript files substantially and improve
                        delivery performance without changing how the program behaves.
                    </p>
                    <ul>
                        <li><strong>Faster downloads:</strong> Smaller files reach the browser sooner, so pages render faster.</li>
                        <li><strong>Reduced bandwidth usage:</strong> Leaner assets save data for end users and lower transfer costs.</li>
                        <li><strong>Lower server overhead:</strong> Smaller payloads are cheaper to serve at scale.</li>
                        <li><strong>Same functionality, smaller footprint:</strong> The code still does the same job after comments and extra spacing are removed.</li>
                        <li>
                            Pair minification with the <a href={buildSiteHref('/css-minifier/')}>CSS Minifier</a> on
                            the same page, format JSON configs with the{' '}
                            <a href={buildSiteHref('/json-formatter/')}>JSON Formatter</a>, and verify output with the{' '}
                            <a href={buildSiteHref('/diff-checker/')}>Diff Checker</a>.
                        </li>
                    </ul>

                    <div className="c-tool-article__cta-row">
                        <a className="c-button" href={SITE_BASE_URL}>
                            Explore More Dev Tools
                        </a>
                    </div>
                </ToolArticleSection>

                <ToolArticleSection id="js-minifier-how-to-use" title="How to Use the JavaScript Minifier">
                    <ol>
                        <li><strong>Paste your JavaScript code</strong> into the Original JavaScript textarea, or click Upload File to choose a local text file.</li>
                        <li>
                            <strong>Select the minification options</strong> you want:
                            <ul>
                                <li>Remove comments</li>
                                <li>Remove whitespace</li>
                                <li>Shorten variable names (experimental)</li>
                                <li>Mangle properties (experimental)</li>
                            </ul>
                        </li>
                        <li><strong>Click Minify JavaScript</strong> to process the code.</li>
                        <li><strong>Review the Minified JavaScript output</strong> and the live size statistics.</li>
                        <li><strong>Copy the result or load the sample</strong> to compare behavior before using it in your project.</li>
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="js-minifier-features" title="Features of This Online JS Minifier">
                    <ul>
                        <li><strong>Local and secure:</strong> All minification happens in your browser, so code is never uploaded.</li>
                        <li><strong>Free and unlimited:</strong> No signup, no download, and no usage cap.</li>
                        <li><strong>Real-time statistics:</strong> See original size, minified size, and compression ratio immediately.</li>
                        <li><strong>Customizable compression:</strong> Choose whether to remove comments, remove whitespace, or enable experimental shortening options.</li>
                        <li><strong>One-click copy workflow:</strong> Copy the minified output directly from the result panel.</li>
                        <li><strong>Local file input:</strong> Click Upload File or drag a JavaScript text file into the input; files are read in the browser and never uploaded.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="js-minifier-example" title="JavaScript Minification Example">
                    <p>
                        Paste the script below. Check Remove comments, Remove whitespace, and Shorten
                        variable names. Leave Mangle properties unchecked. Remove comments and Remove
                        whitespace start checked. Shorten variable names and Mangle properties start
                        unchecked, so turn Shorten variable names on before you click Minify JavaScript.
                        Load Sample fills a different script, with an extra comment, and minifies it with
                        whatever is checked.
                    </p>
                    <p><strong>Before</strong> ({JS_MINIFY_EXAMPLE.originalSizeLabel}, {JS_MINIFY_EXAMPLE.originalBytes} bytes):</p>
                    <pre><code>{JS_MINIFY_EXAMPLE.input}</code></pre>
                    <p>
                        <strong>After</strong> ({JS_MINIFY_EXAMPLE.minifiedSizeLabel}, {JS_MINIFY_EXAMPLE.minifiedBytes} bytes, {JS_MINIFY_EXAMPLE.ratioLabel} smaller):
                    </p>
                    <pre><code>{JS_MINIFY_EXAMPLE.output}</code></pre>
                    <p>
                        That is the string Minify JavaScript writes for this input with those options.
                        The comments are gone. Inside the function, <code>numbers</code>, <code>sum</code>, and{' '}
                        <code>i</code> are <code>a</code>, <code>b</code>, and <code>c</code>. The names{' '}
                        <code>calculateSum</code>, <code>myNumbers</code>, and <code>result</code> stay, because
                        this page leaves top-level bindings and function declarations under their original names.
                        The Statistics panel shows the same figures: Original Size {JS_MINIFY_EXAMPLE.originalSizeLabel},
                        Minified Size {JS_MINIFY_EXAMPLE.minifiedSizeLabel}, Compression Ratio {JS_MINIFY_EXAMPLE.ratioLabel}.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="js-minifier-how-to-test" title="How to Test Your Minified JavaScript">
                    <p>Check the result the same way you would check any script you are about to ship.</p>
                    <ol>
                        <li>
                            <strong>Compare the file size</strong>
                            <p>
                                After Minify JavaScript, read Original Size, Minified Size, and Compression Ratio.
                                Those labels are the UTF-8 byte size of the input, the UTF-8 byte size of the output,
                                and the percent saved, rounded to two decimals. For the example above they read{' '}
                                {JS_MINIFY_EXAMPLE.originalSizeLabel}, {JS_MINIFY_EXAMPLE.minifiedSizeLabel}, and{' '}
                                {JS_MINIFY_EXAMPLE.ratioLabel}.
                            </p>
                        </li>
                        <li>
                            <strong>Run the project tests, or a quick smoke test</strong>
                            <p>
                                Swap the minified file in and run the tests that cover it. With no suite, call the
                                same function. <code>calculateSum([1, 2, 3, 4, 5])</code> is still <code>15</code>, and
                                the console line still prints <code>The sum is: 15</code>. The names{' '}
                                <code>calculateSum</code>, <code>myNumbers</code>, and <code>result</code> are still in
                                the output, so another script on the page can still call them.
                            </p>
                        </li>
                        <li>
                            <strong>Check the browser console</strong>
                            <p>
                                Load the page that uses the minified file and look for errors. Invalid JavaScript is
                                not minified: under Original JavaScript the page shows a message that starts with{' '}
                                <code>Invalid JavaScript syntax:</code> and includes the parser line and column, and
                                Minified JavaScript stays empty. Paste the minified output back into Original
                                JavaScript and click Minify JavaScript again. Valid output fills Minified JavaScript
                                with no error.
                            </p>
                        </li>
                        <li>
                            <strong>Watch what the options change</strong>
                            <p>
                                Remove comments and Remove whitespace are on by default. They drop comments and extra
                                space. Text inside quotes, template literals, and regular expressions stays.
                            </p>
                            <p>
                                Shorten variable names is experimental and off by default. The example turns it on.
                                Locals inside a function are renamed. Top-level <code>const</code>, <code>let</code>, and{' '}
                                <code>var</code> names stay, and so do function and class declaration names. Bindings
                                that direct <code>eval</code>, a <code>Function</code> constructor, or a <code>with</code>{' '}
                                statement can see are left unchanged. Short names come from one counter for the whole
                                file, so two functions that never share a variable can still receive <code>a</code> and
                                then <code>b</code>. This page has no control that renames top-level names.
                            </p>
                            <p>
                                Mangle properties is experimental and off by default. It renames static keys only on a
                                local object literal that does not escape, use dynamic access, act as a method receiver,
                                or sit where <code>eval</code> or <code>with</code> can see it. Exported objects, class
                                members, and objects that use <code>this</code> stay as written. An unrelated string is
                                left unchanged.
                            </p>
                            <p>
                                <code>import</code>, <code>export</code>, and top-level <code>await</code> are accepted
                                and minified. The module specifier stays as written. This page does not bundle files,
                                drop unused exports, or transpile. TypeScript and JSX have to be plain JavaScript first.
                            </p>
                            <p>
                                This page returns only the minified source. It does not produce a source map. Keep the
                                original file when you need to debug.
                            </p>
                        </li>
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="js-minifier-minify-vs-compress" title="Minify vs. Compress (gzip/Brotli) vs. Obfuscate">
                    <p>Minifying and compressing do different jobs, and a production page usually does both.</p>
                    <p>
                        Minifying rewrites the source once. This page removes comments and whitespace, and, only when
                        those boxes are checked, shortens local names or mangles local properties. You save that
                        smaller text. The example goes from {JS_MINIFY_EXAMPLE.originalSizeLabel} to{' '}
                        {JS_MINIFY_EXAMPLE.minifiedSizeLabel}, which is {JS_MINIFY_EXAMPLE.ratioLabel} smaller.
                    </p>
                    <p>
                        gzip and Brotli compress those bytes while the server sends the file. They leave the source
                        you keep unchanged. A minified file still compresses, so the two stack. Compression Ratio in
                        the Statistics panel is the minification savings, not a gzip or Brotli ratio.
                    </p>
                    <p>
                        Minifying is not obfuscation, and it is not a way to hide secrets. Short names are harder to
                        read, and a formatter can expand them again. A secret in the script is still in the file the
                        browser downloads.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="js-minifier-advanced-options" title="Advanced Options">
                    <h3>String and RegExp Handling</h3>
                    <ul>
                        <li>Preserves string literals, including single quotes, double quotes, and template literals.</li>
                        <li>Maintains regular expressions and their flags.</li>
                        <li>Prevents comment stripping from accidentally modifying string contents.</li>
                    </ul>

                    <h3>Whitespace Optimization</h3>
                    <ul>
                        <li>Preserves spaces that are still required around operators and keywords.</li>
                        <li>Trims redundant whitespace everywhere else.</li>
                        <li>Keeps syntax valid while compressing the output.</li>
                    </ul>

                    <h3>Property Mangling (Experimental)</h3>
                    <p>
                        The minified line below is what Minify JavaScript writes when Mangle properties is checked and
                        Shorten variable names is not. <code>firstName</code> and <code>lastName</code> become <code>a</code> and{' '}
                        <code>b</code>. <code>user</code> stays because it is a top-level binding.
                    </p>
                    <pre><code>{`// Original code
${PROPERTY_MANGLE_INPUT}

// Minified with property mangling
${PROPERTY_MANGLE_OUTPUT}`}</code></pre>
                </ToolArticleSection>

                <ToolArticleSection id="js-minifier-limitations" title="Limitations">
                    <ul>
                        <li><strong>Variable name shortening and property mangling are experimental:</strong> they may break code in some cases, so test carefully.</li>
                        <li><strong>Property mangling scope:</strong> only static keys on local object literals that do not escape, use dynamic access, act as method receivers, or are visible to direct <code>eval</code> or <code>with</code> scopes are renamed; API/config objects, <code>this</code>-dependent objects, and class members stay unchanged.</li>
                        <li><strong>Dynamic scopes:</strong> bindings visible to direct <code>eval</code> or referenced inside <code>with</code> statements are not shortened.</li>
                        <li><strong>Input syntax:</strong> TypeScript and JSX must be transpiled to JavaScript first; this tool does not transpile, bundle, or tree-shake code.</li>
                        <li><strong>Reflection and dynamic property access can be risky:</strong> property mangling may break code that depends on property names remaining unchanged.</li>
                        <li><strong>Browser-specific behavior still needs validation:</strong> minified output should be tested in the environments you ship.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="js-minifier-best-practices" title="Best Practices">
                    <ul>
                        <li>Always test minified code thoroughly before deployment.</li>
                        <li>Keep the original source for maintenance and debugging.</li>
                        <li>This page returns only the minified source and does not produce a source map. Keep the original file, and use a build pipeline with source maps when you ship a larger project.</li>
                        <li>Be cautious with experimental options in production code.</li>
                        <li>Verify that external dependencies still behave correctly after minification.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="js-minifier-privacy" title="Privacy & Security">
                    <ul>
                        <li>100% client-side processing: JavaScript is minified directly in your browser.</li>
                        <li>No data storage: pasted code is not uploaded or retained by the tool.</li>
                        <li>Private workflow: proprietary snippets stay on the current device.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="js-minifier-feedback" title="Feedback">
                    <p>
                        Please <a href="https://codesamplez.com/contact">contact us</a> for any bug report, feature
                        request, or feedback about the JavaScript Minifier.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="js-minifier-faqs" title="JavaScript Minifier FAQs">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
