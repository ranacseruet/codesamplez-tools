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
        'Does the tool work offline?',
        'Yes! Once the page loads, all comparisons happen locally in your browser, so you can use it without an internet connection.'
    ),
    createPlainTextFaqItem(
        'How large of text or code files can I compare?',
        'It handles multiline text and code well, including syntax highlighting, but performance may slow with extremely large inputs because everything processes in-browser. For huge files, consider splitting them or using a desktop diff tool.'
    ),
    createPlainTextFaqItem(
        'Why does it ignore whitespace by default?',
        'This is intentional for cleaner code comparisons because minor formatting changes do not clutter the results. You can toggle the Ignore Whitespace option off if you need exact matching, including every space and newline.'
    ),
    createPlainTextFaqItem(
        'Can I compare code from different programming languages?',
        'Yes. You can compare text from any source regardless of language. The tool performs a text-based diff, so it works across programming languages and file types.'
    ),
    createPlainTextFaqItem(
        'Is my code stored when using the diff checker?',
        'No. All comparisons are processed in your browser. Your code is never sent to our servers, which keeps the comparison private.'
    ),
    createPlainTextFaqItem(
        'What file formats does the diff checker support?',
        'The diff checker supports plain text, code files such as Python, JavaScript, Java, and C++, plus JSON, XML, HTML, and CSS. You can paste any textual content into the two editors.'
    ),
    createPlainTextFaqItem(
        'Is the diff checker free to use?',
        'Yes. The diff checker is completely free and does not require registration. You can compare unlimited text and code differences instantly.'
    )
];

export function DiffCheckerIntro(): JSX.Element {
    return (
        <section className="c-tool-article c-tool-article--intro c-surface-card" aria-labelledby="diff-checker-intro-heading">
            <div className="c-tool-article__content">
                <h2 id="diff-checker-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    The Diff Checker Tool is a lightweight, web-based utility designed to compare two blocks of text
                    and highlight their differences. It provides an intuitive interface for users to paste texts,
                    compare them, and view the changes in a clear, colour-coded format. The tool compares multiline
                    texts, programming code, HTML, or other textual content. All processing is done client-side,
                    right in the browser.
                </p>
            </div>
        </section>
    );
}

export function DiffCheckerArticle(): JSX.Element {
    return (
        <section className="c-tool-article c-surface-card" aria-labelledby="diff-checker-article-heading">
            <div className="c-tool-article__content">
                <h2 id="diff-checker-article-heading" className="c-tool-article__sr-only">Diff Checker Guide</h2>

                <ToolArticleSection id="diff-checker-what-is" title="What is a Diff Checker?">
                    <p>
                        A diff checker is an online tool that compares two blocks of text or code to highlight their
                        differences. It shows added content in green, removed content in red, and unchanged content in
                        neutral formatting. Developers use diff checkers to compare code versions, track changes in
                        configuration files, and identify modifications between file versions.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="diff-checker-features" title="Diff Checker Tool Features:">
                    <ul>
                        <li>
                            <strong>Both Text and Code Difference Detection:</strong> Automatically detects if a code
                            snippet is provided and shows the code comparison result syntax highlighted.
                        </li>
                        <li>
                            <strong>Smart whitespace handling:</strong> Configurable sensitivity lets you ignore
                            formatting-only changes or compare every space and line ending exactly.
                        </li>
                        <li>
                            <strong>Multiline support:</strong> Handles multi-line inputs seamlessly, which makes it
                            suitable for code, HTML, or large documents.
                        </li>
                        <li>
                            <strong>Word-level difference support:</strong> The tool analyzes and shows word-level
                            differences for every line change.
                        </li>
                        <li>
                            <strong>Color-coded differences:</strong> Added lines are highlighted in green, removed
                            lines in red, and unchanged lines remain neutral.
                        </li>
                        <li>
                            <strong>Difference navigation:</strong> Use the Prev and Next buttons above the results to
                            jump between highlighted blocks of consecutive line differences. A counter shows the current
                            difference number and the total count.
                        </li>
                        <li>
                            <strong>Cross-browser compatibility:</strong> Works in modern browsers without extra plugins
                            or configuration.
                        </li>
                        <li>
                            <strong>Sophisticated diff algorithm:</strong> Uses the{' '}
                            <a href="https://www.npmjs.com/package/diff">Myers difference algorithm-based javascript library</a>{' '}
                            for change detection.
                        </li>
                    </ul>

                    <div className="c-tool-article__cta-row">
                        <a className="c-button" href="https://codesamplez.com/tools">
                            Explore More Dev Tools
                        </a>
                    </div>
                </ToolArticleSection>

                <ToolArticleSection id="diff-checker-usage" title="Usage Example">
                    <h3 className="c-tool-article__subheading">Step-by-Step Guide</h3>
                    <ol>
                        <li>
                            <strong>Input Texts</strong>
                            <p>Paste the first text block into the left textarea and the second text block into the right textarea.</p>
                        </li>
                        <li>
                            <strong>Configure Ignore Whitespace</strong>
                            <p>Keep it checked to ignore differences in spaces, tabs, and line endings, or uncheck it to compare whitespace exactly.</p>
                        </li>
                        <li>
                            <strong>Compare Texts</strong>
                            <p>Click the Compare button to analyze the differences between the two texts.</p>
                        </li>
                        <li>
                            <strong>View Results</strong>
                            <p>The differences appear below in a styled output area with added lines in green, removed lines in red, and unchanged lines unstyled.</p>
                        </li>
                    </ol>

                    <p><strong>Example Input 1:</strong></p>
                    <pre><code>{`function greet(name) {
  console.log("Hello, " + name);
}`}</code></pre>

                    <p><strong>Example Input 2:</strong></p>
                    <pre><code>{`function greet(name) {
  console.log("Hi, " + name);
}`}</code></pre>

                    <p><strong>Example diff checker result output:</strong></p>
                    <figure className="c-tool-article__figure">
                        <img
                            src="https://tools.codesamplez.com/diff-checker/images/diff-result-view-example.webp"
                            alt="Online Diff Checker interface code difference result example"
                            width="402"
                            height="137"
                            loading="lazy"
                            decoding="async"
                        />
                        <figcaption className="c-tool-article__figcaption">
                            The result view highlights the changed greeting line so added and removed content is easy to spot at a glance.
                        </figcaption>
                    </figure>
                </ToolArticleSection>

                <ToolArticleSection id="diff-checker-limitations" title="Limitations:">
                    <ol>
                        <li>
                            <strong>Performance with Large Inputs</strong>
                            <p>While the tool efficiently handles moderate-sized texts, extremely large inputs may impact performance because it is not optimized for very large datasets.</p>
                        </li>
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="diff-checker-privacy" title="Privacy & Security">
                    <ul>
                        <li>100% Client-Side Processing: All text comparisons are performed locally in your browser.</li>
                        <li>No Data Storage: Your text content is never saved or transmitted to any server.</li>
                        <li>Offline Capability: Works without an internet connection once loaded.</li>
                        <li>Data Privacy: No cookies, tracking, or data collection of any kind.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="diff-checker-faqs" title="Diff Checker FAQs">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>

                <ToolArticleSection id="diff-checker-feedback" title="Feedback">
                    <p>
                        Please <a href="https://codesamplez.com/contact">message us</a> for any bug reports, feature
                        requests, or feedback.
                    </p>
                </ToolArticleSection>
            </div>
        </section>
    );
}
