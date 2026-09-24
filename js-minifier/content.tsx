import type { JSX } from 'preact';
import { ToolArticleNextSteps, ToolArticleSection, ToolFaqList, type ToolArticleProps, type ToolFaqItem } from '../common/tool-article/ToolArticle';

function createPlainTextFaqItem(question: string, answer: string): ToolFaqItem {
    return {
        question,
        answer,
        structuredDataAnswer: answer
    };
}

export const FAQ_ITEMS: ToolFaqItem[] = [
    createPlainTextFaqItem(
        'What is JavaScript minification and why is it important?',
        'JavaScript minification is the process of compressing code by removing unnecessary characters like spaces, line breaks, and comments, and sometimes shortening variable names without changing the code\'s behavior. It is important because it reduces file size, which helps web pages load faster and improves performance, especially for mobile users and large applications.'
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
        'The exact savings depend on the code, but many files shrink by 20 to 30 percent, and some can be reduced by 50 percent or more. Libraries and heavily commented files often see the biggest gains. Even smaller reductions help improve load speed.'
    ),
    createPlainTextFaqItem(
        'Is minification the same as obfuscation?',
        'No. Minification focuses on reducing file size and improving performance, while obfuscation is designed to make code harder for humans to read. Minified code may look dense because whitespace and long names are removed, but the primary goal is optimization, not concealment.'
    )
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

export function JSMinifierArticle({ relatedTools }: ToolArticleProps): JSX.Element {
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
                    </ul>

                    <ToolArticleNextSteps relatedTools={relatedTools} />
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
                    <p>Here is a simple before-and-after example using the same style of code shown in the tool&apos;s sample input.</p>

                    <p><strong>Original Code:</strong></p>
                    <pre><code>{`// Example JavaScript function
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
console.log("The sum is: " + result);`}</code></pre>

                    <p><strong>Minified Code:</strong></p>
                    <pre><code>{`function a(numbers){let b=0;for(let c=0;c<numbers.length;c++){b=b+numbers[c]}return b}const d=[1,2,3,4,5],e=a(d);console.log("The sum is: "+e)`}</code></pre>
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
                    <pre><code>{`// Original code
const user = { firstName: "John", lastName: "Doe" };
console.log(user.firstName + " " + user.lastName);

// Minified with property mangling
const user={a:"John",b:"Doe"};console.log(user.a+" "+user.b);`}</code></pre>
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
                        <li>Use source maps and production-grade minifiers in a CI/CD pipeline when shipping larger projects.</li>
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
