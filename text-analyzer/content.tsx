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
        'Is the Text Analyzer tool free to use?',
        'Yes. The CodeSamplez Text Analyzer is completely free to use. There are no fees or licenses required, and you do not need to sign up. Simply visit the tool page, paste your text, and get your analysis instantly.'
    ),
    createPlainTextFaqItem(
        'Can the Text Analyzer handle large texts or word documents?',
        'Yes. You can paste large amounts of text into the analyzer, and it will still provide results in real time. The tool is designed to handle everything from short paragraphs to lengthy essays. For very large documents, you might experience a brief processing delay, but it works quickly for most inputs. If you have a Word document, copy the text from the document and paste it into the tool\'s text box.'
    ),
    createPlainTextFaqItem(
        'What\'s the difference between a text analyzer and a word counter?',
        'A word counter typically counts the number of words, and often characters, in a text. A text analyzer provides a broader set of statistics. In addition to word count, the CodeSamplez Text Analyzer counts sentences and lines, and analyzers can provide broader insights like keyword frequency or readability. In short, a text analyzer includes word counting as one of its features while giving you a more complete view of your text.'
    ),
    createPlainTextFaqItem(
        'Does the Text Analyzer support multiple languages?',
        'Yes, you can analyze text in any language. The tool counts characters and words regardless of language or script. It does not translate text or identify language-specific grammar, but non-English texts are handled for counting just as easily as English.'
    ),
    createPlainTextFaqItem(
        'Are the results from the Text Analyzer accurate?',
        'Absolutely. The Text Analyzer uses straightforward counting algorithms to provide accurate word and character counts. It treats words as whitespace-separated tokens and counts sentences using punctuation such as periods, question marks, and exclamation points. While automated tools can miss edge cases like abbreviations or ellipses, the reported numbers are highly reliable for general editing and review.'
    )
];

export function TextAnalyzerIntro(): JSX.Element {
    return (
        <section className="c-tool-article c-tool-article--intro c-surface-card" aria-labelledby="text-analyzer-intro-heading">
            <div className="c-tool-article__content">
                <h2 id="text-analyzer-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    The CodeSamplez Text Analyzer is a <strong>free online text analysis tool</strong> that instantly
                    provides detailed statistics about your text. It counts <strong>characters</strong>,{' '}
                    <strong>words</strong>, <strong>sentences</strong>, and <strong>paragraphs</strong> in real time,
                    giving you immediate insight into your content. This tool is ideal for students, writers, and
                    anyone who needs to evaluate or monitor text length and structure in a document.
                </p>
            </div>
        </section>
    );
}

export function TextAnalyzerArticle(): JSX.Element {
    return (
        <section className="c-tool-article c-surface-card" aria-labelledby="text-analyzer-article-heading">
            <div className="c-tool-article__content">
                <h2 id="text-analyzer-article-heading" className="c-tool-article__sr-only">Text Analyzer Guide</h2>

                <ToolArticleSection id="what-is-text-analyzer" title="What is a Text Analyzer?">
                    <p>
                        A text analyzer is an <strong>online tool that examines written text and provides statistical insights</strong>{' '}
                        about it. It can count elements like words, characters, sentences, paragraphs and more,
                        helping users understand the structure and length of their content. In essence, it breaks down
                        your text and delivers instant metrics, which is useful for editing, compliance with length
                        guidelines, or improving writing clarity.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="text-analyzer-features" title="Features and Benefits of the Text Analyzer:">
                    <ul>
                        <li>
                            <strong>Real-Time Counting:</strong> The Text Analyzer updates the word, character,
                            sentence, and line counts immediately as you type or paste text. There is no need to
                            click a submit button, making it efficient for quick checks.
                        </li>
                        <li>
                            <strong>Counts:</strong>
                            <ul>
                                <li><strong>Characters</strong>: Counts every character in the text, including spaces and punctuation.</li>
                                <li><strong>Words</strong>: Calculates the number of words by splitting text on whitespace.</li>
                                <li><strong>Sentences</strong>: Estimates the number of sentences by identifying common sentence endings (., !, ?).</li>
                                <li><strong>Lines:</strong> Calculates the number of lines by splitting text on newline character (<code>\n</code>).</li>
                                <li><strong>Paragraphs</strong>: Counts paragraphs by identifying text blocks separated by blank lines.</li>
                            </ul>
                        </li>
                        <li><strong>Average Word Length</strong>: Calculates the mean length of words (excluding punctuation).</li>
                        <li><strong>Average Sentence Length</strong>: Computes the average number of words per sentence.</li>
                        <li>
                            <strong>Punctuation Statistics</strong>: Tracks usage frequency of common punctuation marks
                            (periods, commas, question marks, exclamation marks).
                        </li>
                        <li><strong>Word frequency analysis:</strong> Tracks usage density of keywords and show top 5 most frequently used words.</li>
                    </ul>

                    <div className="c-tool-article__cta-row">
                        <a className="c-button" href="https://codesamplez.com/tools">
                            Explore More Dev Tools
                        </a>
                    </div>
                </ToolArticleSection>

                <ToolArticleSection id="how-to-use-text-analyzer" title="How To Use The Text Analyzer:">
                    <ol>
                        <li>
                            <strong>Paste or type your text</strong> into the input field. You can enter any length of
                            text, from a single sentence to multiple paragraphs.
                        </li>
                        <li>
                            <strong>View instant results</strong> - as you input the text, the tool will immediately
                            display key statistics such as the character count, word count, sentence count, and line
                            count. The counts update in real time with each keystroke.
                        </li>
                        <li>
                            <strong>Analyze the output:</strong> Check if your content meets your requirements. Writers
                            can ensure an article stays under a word limit, and students can verify the number of
                            sentences in an essay.
                        </li>
                        <li>
                            <strong>Refine your text if needed</strong>, then copy the text or note the statistics as
                            required. You can edit the text in the box to see how changes, like shortening or
                            lengthening sentences, affect your counts instantly.
                        </li>
                        <li>
                            <em>Optional:</em> <strong>Reset or start a new analysis</strong> by clearing the text box.
                            The tool often includes a "Reset" button to quickly clear the input field and let
                            you analyze a new block of text without refreshing the page.
                        </li>
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="text-analyzer-limitations" title="Limitations">
                    <ul>
                        <li>Word count is approximate and may not handle all international writing systems perfectly.</li>
                        <li>Sentence detection is basic and may not catch all edge cases, such as abbreviations with periods.</li>
                        <li>Line count includes empty lines after trimming whitespace.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="text-analyzer-privacy" title="Privacy & Security">
                    <ul>
                        <li>100% Client-Side Processing: All text analysis happens locally in your browser.</li>
                        <li>No Data Storage: Your text is never saved or transmitted to any server.</li>
                        <li>Offline Support: Works without an internet connection after the initial page load.</li>
                        <li>Zero Data Collection: No cookies, tracking, or data persistence.</li>
                        <li>Session Privacy: All text is cleared when you close the browser tab.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="text-analyzer-future" title="Future Improvements">
                    <ul>
                        <li>
                            <strong>Advanced Word Analysis</strong>:
                            <ul>
                                <li>Reading time estimation.</li>
                                <li>Readability scoring, such as Flesch-Kincaid.</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Trends Analysis:</strong>
                            <ul>
                                <li>Keyword frequency and most-used words or phrases.</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Export Capabilities</strong>:
                            <ul>
                                <li>Export analysis results as CSV or PDF.</li>
                                <li>Save text with statistics for later reference.</li>
                            </ul>
                        </li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="text-analyzer-feedback" title="Feedback:">
                    <p>
                        Do you have any feature requests or any issues or bugs to report? Feel free to{' '}
                        <a href="https://codesamplez.com/contact">contact us</a>!
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="text-analyzer-faqs" title="Text Analyzer FAQs:">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
