import type { JSX } from 'preact';
import { SITE_BASE_URL, buildSiteHref } from '../common/siteBaseUrl';
import { ToolArticleSection, ToolFaqList, type ToolFaqItem } from '../common/tool-article/ToolArticle';
import { analyzeText, type TextAnalysisResult } from './TextAnalyzer';
import { TEXT_ANALYZER_SAMPLE_TEXT } from './sample-text';

const SAMPLE_RESULT = analyzeText(TEXT_ANALYZER_SAMPLE_TEXT);
const SAMPLE_FREQUENCY = SAMPLE_RESULT.wordFrequency!;

const SAMPLE_STAT_FIELDS = [
    ['wordCount', 'Word Count'],
    ['charCount', 'Character Count'],
    ['paragraphCount', 'Paragraph Count'],
    ['sentenceCount', 'Sentence Count'],
    ['lineCount', 'Lines Counter'],
    ['avgWordLength', 'Average Word Length'],
    ['avgSentenceLength', 'Average Sentence Length'],
    ['readingTime', 'Reading Time'],
    ['readabilityScore', 'Flesch Reading Ease'],
    ['gradeLevel', 'Flesch-Kincaid Grade'],
    ['keywordDensity', 'Top Keyword Density'],
    ['periodCount', 'Periods'],
    ['commaCount', 'Commas'],
    ['questionCount', 'Question Marks'],
    ['exclamationCount', 'Exclamation Marks']
] as const;

function formatSampleStat(key: string, result: TextAnalysisResult): string {
    if (key === 'readingTime') {
        return `${result.readingTime} min`;
    }

    if (key === 'readabilityScore') {
        return result.readabilityScore!.toFixed(2);
    }

    if (key === 'gradeLevel') {
        return Math.max(result.gradeLevel!, 0).toFixed(2);
    }

    if (key === 'keywordDensity') {
        return `${result.topKeyword!} \u2014 ${result.keywordDensity.toFixed(2)}%`;
    }

    return String(result[key as keyof TextAnalysisResult]);
}

/** Statistics the guide quotes for Load Sample. Values match the statistics panel. */
export const SAMPLE_GUIDE_STATS = SAMPLE_STAT_FIELDS.map(([key, label]) => ({
    key,
    label,
    value: formatSampleStat(key, SAMPLE_RESULT)
}));

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
        'A word counter typically counts the number of words, and often characters, in a text. A text analyzer provides a broader set of statistics. In addition to word count, the CodeSamplez Text Analyzer counts sentences and lines, estimates reading time, reports readability scores, and shows keyword density. In short, a text analyzer includes word counting as one of its features while giving you a more complete view of your text.'
    ),
    createPlainTextFaqItem(
        'Does the Text Analyzer support multiple languages?',
        'Yes, you can analyze text in any language for basic counts. Spaced text, including Korean, is split on whitespace. Chinese characters, Japanese hiragana or katakana, Thai, Khmer, Lao, and Myanmar are split with Intl.Segmenter when the browser provides it, and on whitespace otherwise. Readability scores use an English-oriented syllable heuristic, so treat those estimates as approximate for non-English text.'
    ),
    createPlainTextFaqItem(
        'Are the results from the Text Analyzer accurate?',
        'The Text Analyzer uses straightforward algorithms for word and character counts. Spaced text is split on whitespace, and Chinese, Japanese kana, Thai, Khmer, Lao, and Myanmar text uses Intl.Segmenter when the browser provides it. Sentences are counted from punctuation such as periods, question marks, and exclamation points, and syllables are estimated for readability scoring. Automated tools can miss edge cases like abbreviations, ellipses, names, and technical terms, so readability and sentence metrics should be treated as helpful estimates.'
    ),
    createPlainTextFaqItem(
        'How does the keyword density calculation work?',
        'Each word is lowercased and punctuation is removed. Tokens with no letter, including a number on its own, are ignored, as are English stop words such as the, and, is, and for. The tool ranks the words that remain and lists the five most frequent. Top keyword density is the leading word\'s count divided by the total word count, stop words included, multiplied by 100 and rounded to two decimals. A key phrase is not scored as one keyword. Its words are counted separately, and a tie keeps the word that appeared first.'
    ),
    createPlainTextFaqItem(
        'Is my text uploaded anywhere?',
        'No. Text you type, paste, load with Load Sample, or open with Upload File is analyzed in this browser and is not uploaded by the tool. Closing the tab clears it. This site uses Google Analytics and Google AdSense cookies to measure usage and show ads.'
    ),
    createPlainTextFaqItem(
        'What counts as a word, including text without spaces?',
        'Spaced text is split on whitespace, so a hyphenated compound such as state-of-the-art is one word. When the text includes Chinese characters, Japanese hiragana or katakana, Thai, Khmer, Lao, or Myanmar, the whole input is split with Intl.Segmenter at word granularity if the browser provides it. Korean Hangul keeps the whitespace split. Keyword checks use Unicode letters, so a Cyrillic or CJK word can be a keyword, while digits alone cannot.'
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
                    <strong>words</strong>, <strong>sentences</strong>, and <strong>paragraphs</strong>, and estimates{' '}
                    <strong>reading time</strong>, <strong>readability</strong>, and <strong>keyword density</strong> in
                    real time. This tool is ideal for students, writers, and anyone who needs to evaluate or monitor
                    text length, structure, and clarity in a document.
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
                        guidelines, or improving writing clarity. Compare a revision with the{' '}
                        <a href={buildSiteHref('/diff-checker/')}>Diff Checker</a>, format embedded{' '}
                        <a href={buildSiteHref('/json-formatter/')}>JSON snippets</a> before counting them, or turn a
                        short string into a <a href={buildSiteHref('/qr-code-generator/')}>QR code</a>.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="text-analyzer-keyword-analysis" title="Keyword and Key Phrase Analysis">
                    <p>
                        A keyword on this page is a single word. The analyzer does not score a multi-word key phrase
                        as one unit. In the phrase &ldquo;text analysis tool&rdquo;, text, analysis, and tool are three
                        separate keywords.
                    </p>
                    <p>What counts as a word:</p>
                    <ul>
                        <li>
                            Spaced text, including English, is split on whitespace. A hyphenated compound such as
                            state-of-the-art stays one word, and repeated spaces do not add empty words.
                        </li>
                        <li>
                            If the text contains Chinese characters, Japanese hiragana or katakana, Thai, Khmer, Lao,
                            or Myanmar, the whole input is split with the browser&apos;s <code>Intl.Segmenter</code> at
                            word granularity, because those scripts often have no spaces between words. Korean Hangul
                            is not in that set and keeps the whitespace split, since Korean words are usually separated
                            by spaces. When the browser has no <code>Intl.Segmenter</code>, the analyzer falls back to
                            splitting on whitespace.
                        </li>
                        <li>
                            Text that mixes those space-less scripts with English is segmented as a whole, so a
                            hyphenated English compound in that mix is counted as its parts.
                        </li>
                    </ul>
                    <p>
                        Keyword matching then lowercases each token and drops characters that are not Unicode letters
                        or numbers. A token must still contain a letter. Digits alone, such as 2026, stay in the word
                        count and are not keywords. Average word length uses the same letter-and-number measure, so a
                        CJK or Cyrillic word keeps its length. An apostrophe is punctuation, so Let&apos;s becomes lets.
                    </p>
                    <p>
                        Stop words are a fixed English list of function words, including a, an, the, and, or, but, is,
                        are, of, to, for, in, and on, plus common pronouns and auxiliaries. They remain in the word
                        count and are left out of the keyword list. The list is English, so function words in other
                        languages are not removed.
                    </p>
                    <p>
                        The Word Frequency chart shows up to five of the remaining words, highest count first. When
                        counts tie, the earlier word stays ahead. Top Keyword Density is that first word&apos;s count
                        divided by the total word count, including stop words, multiplied by 100 and rounded to two
                        decimal places. If every token is a stop word or a number, the density is an em dash.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="text-analyzer-how-to-analyze" title="How to Analyze Text">
                    <p>
                        Click <strong>Load Sample</strong>. The box fills with this text, including the blank line
                        between the paragraphs:
                    </p>
                    <pre><code>{TEXT_ANALYZER_SAMPLE_TEXT}</code></pre>
                    <p>The statistics panel then shows:</p>
                    <ul>
                        {SAMPLE_GUIDE_STATS.map((stat) => (
                            <li key={stat.key}>
                                <strong>{stat.label}:</strong> {stat.value}
                            </li>
                        ))}
                    </ul>
                    <p>
                        {SAMPLE_RESULT.topKeyword} leads because it is the first word left after English stop words
                        are removed, and each remaining keyword in this sample appears once. Top Keyword Density
                        divides that one occurrence by all {SAMPLE_RESULT.wordCount} words. The Word Frequency chart
                        keeps the first five: {SAMPLE_FREQUENCY.map((entry) => entry.word).join(', ')}.
                    </p>
                    <p>
                        Reading Time is {SAMPLE_RESULT.readingTime} min because {SAMPLE_RESULT.wordCount} words at 200
                        words per minute rounds up to the next minute. Flesch Reading Ease and the Flesch-Kincaid
                        grade use the tool&apos;s English syllable estimate. Paste, type, or choose <strong>Upload File</strong>{' '}
                        to analyze different text. The figures update as you edit, and the text is not uploaded.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="text-analyzer-features" title="Features and Benefits of the Text Analyzer:">
                    <ul>
                        <li>
                            <strong>Real-Time Counting:</strong> The Text Analyzer updates the word, character,
                            sentence, and line counts immediately as you type or paste text. It also refreshes the
                            reading-time, readability, and keyword-density estimates without a submit button.
                        </li>
                        <li>
                            <strong>Counts:</strong>
                            <ul>
                                <li><strong>Characters</strong>: Counts every character in the text, including spaces and punctuation.</li>
                                <li><strong>Words</strong>: Counts words by splitting spaced text on whitespace. Chinese, Japanese kana, Thai, Khmer, Lao, and Myanmar text uses Intl.Segmenter when the browser provides it.</li>
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
                        <li><strong>Word frequency analysis:</strong> Shows the top 5 most frequently used non-stop words; numeric-only tokens are ignored.</li>
                        <li><strong>Reading time:</strong> Estimates reading time at 200 words per minute, rounded up to the next minute.</li>
                        <li><strong>Readability:</strong> Reports Flesch Reading Ease and Flesch-Kincaid grade level from estimated syllable counts; shows an em dash when no applicable English score is available. Reading Ease is shown unclamped, so very simple text can score above 100 and very dense text below 0.</li>
                        <li><strong>Keyword density:</strong> Reports the most frequent non-stop word and what percentage of all words it represents.</li>
                        <li><strong>Local file input:</strong> Click Upload File or drag a text file into the input; files are read in the browser and never uploaded.</li>
                    </ul>

                    <div className="c-tool-article__cta-row">
                        <a className="c-button" href={SITE_BASE_URL}>
                            Explore More Dev Tools
                        </a>
                    </div>
                </ToolArticleSection>

                <ToolArticleSection id="how-to-use-text-analyzer" title="How To Use The Text Analyzer:">
                    <ol>
                        <li>
                            <strong>Paste, type, or upload your text</strong> into the input field. Click Upload File
                            to choose a local text file, or enter any length of text from a single sentence to multiple paragraphs.
                        </li>
                        <li>
                            <strong>View instant results</strong> - as you input the text, the tool will immediately
                            display key statistics such as the character count, word count, sentence count, line count,
                            reading time, readability, and keyword density. The results update in real time with each
                            keystroke.
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
                        <li>Readability scores use an English-oriented syllable heuristic and are estimates for names, technical terms, and non-English text; an em dash means no applicable English score was available.</li>
                        <li>Keyword density reports the most frequent non-stop word rather than every possible keyword or phrase, and ignores numeric-only tokens.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="text-analyzer-privacy" title="Privacy & Security">
                    <ul>
                        <li>100% Client-Side Processing: All text analysis happens locally in your browser.</li>
                        <li>No Data Storage: Your text is never saved or transmitted to any server.</li>
                        <li>Offline Support: Works without an internet connection after the initial page load.</li>
                        <li>Site cookies: Your input is processed in this browser and is not uploaded by the tool. This site uses Google Analytics and Google AdSense cookies to measure usage and show ads.</li>
                        <li>Session Privacy: All text is cleared when you close the browser tab.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="text-analyzer-future" title="Future Improvements">
                    <ul>
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
