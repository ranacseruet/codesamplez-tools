import { hydrate, render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { NotificationManager } from '../common/notification-manager.js';
import ClearButton from '../common/clear-button/ClearButton.js';
import { mountToolShell } from '../common/app-shell/mountToolShell.js';

const STOP_WORDS = new Set('a an the and or but in on at to for of with by from as is are was were be been being have has had do does did will would could should may might must can shall this that these those i me my myself we our ours you your yours he him his she her hers it its they them their theirs up down out about into through during before after above below between among under over again further then once here there when where why how all any both each few more most other some such no nor not only own same so than too very s t just don now d ll m o re ve y ain aren couldn didn doesn hadn hasn haven isn ma mightn mustn needn shan shouldn wasn weren won wouldn'.split(' '));

function analyzeText(text = '') {
    // Convert null/undefined to empty string and ensure we're working with a string
    text = String(text);

    // Handle empty input
    if (!text) {
        return {
            charCount: 0,
            wordCount: 0,
            lineCount: 0,
            sentenceCount: 0,
            paragraphCount: 0,
            avgWordLength: '0.00',
            avgSentenceLength: '0.00',
            periodCount: 0,
            commaCount: 0,
            questionCount: 0,
            exclamationCount: 0
        };
    }

    // Character count is straightforward
    const charCount = text.length;

    // Word count: split on whitespace and filter out empty strings
    const words = text.trim() ? text.trim().split(/\s+/) : [];
    const wordCount = words.length;

    // Average Word Length: calculate after stripping punctuation
    const totalWordLength = words.reduce((sum, word) => sum + word.replace(/[^a-zA-Z0-9]/g, '').length, 0);
    const avgWordLength = wordCount > 0 ? (totalWordLength / wordCount).toFixed(2) : '0.00';

    // Line count: split on newlines, but return 0 for empty string
    const lineCount = text ? text.split('\n').length : 0;

    // Sentence count
    let sentenceCount = 0;
    const trimmedText = text.trim();
    if (trimmedText) {
        // Match sentences ending with . ! ? followed by whitespace or end of string
        const sentences = trimmedText.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [];
        sentenceCount = sentences.length;
        // If there's remaining text without punctuation, count it as a sentence
        const remainingText = trimmedText.replace(/[^.!?]+[.!?]+(?:\s+|$)/g, '').trim();
        if (remainingText) {
            sentenceCount++;
        }
    }

    // Paragraph count
    let paragraphCount = 0;
    if (trimmedText) {
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
        paragraphCount = paragraphs.length;
    }

    // Average Sentence Length (in words)
    let avgSentenceLength = '0.00'; // Default to string "0.00"
    if (sentenceCount > 0) {
        const totalWordsInSentences = words.length; // Assuming all words belong to some sentence
        avgSentenceLength = (totalWordsInSentences / sentenceCount).toFixed(2);
    }

    // Punctuation Counts
    let periodCount = 0;
    let commaCount = 0;
    let questionCount = 0;
    let exclamationCount = 0;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '.') {
            periodCount++;
        } else if (char === ',') {
            commaCount++;
        } else if (char === '?') {
            questionCount++;
        } else if (char === '!') {
            exclamationCount++;
        }
    }

    // Word Frequency Analysis
    const wordFrequency = {};
    if (words.length > 0) {
        words.forEach(word => {
            // Clean word: remove punctuation and convert to lowercase
            const cleanWord = word.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
            if (cleanWord && cleanWord.length > 0 && !STOP_WORDS.has(cleanWord)) {
                wordFrequency[cleanWord] = (wordFrequency[cleanWord] || 0) + 1;
            }
        });
    }

    // Get top 5 most frequent words
    const topWords = Object.entries(wordFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([word, count]) => ({ word, count }));

    return {
        charCount,
        wordCount,
        lineCount,
        sentenceCount,
        paragraphCount,
        avgWordLength,
        avgSentenceLength,
        periodCount,
        commaCount,
        questionCount,
        exclamationCount,
        wordFrequency: topWords
    };
}

const SAMPLE_TEXT = "This is a sample text for analysis. It has multiple sentences and paragraphs.\n\nLet's see how well it works!";

const PRIMARY_STATS = [
    ['wordCount', 'Word Count'],
    ['charCount', 'Character Count'],
    ['paragraphCount', 'Paragraph Count'],
    ['sentenceCount', 'Sentence Count'],
    ['lineCount', 'Lines Counter'],
    ['avgWordLength', 'Average Word Length'],
    ['avgSentenceLength', 'Average Sentence Length']
];

const PUNCTUATION_STATS = [
    ['periodCount', 'Periods'],
    ['commaCount', 'Commas'],
    ['questionCount', 'Question Marks'],
    ['exclamationCount', 'Exclamation Marks']
];

export function TextAnalyzerApp() {
    const [text, setText] = useState('');
    const textAreaRef = useRef(null);
    const clearButtonRef = useRef(null);
    const result = useMemo(() => analyzeText(text), [text]);

    useEffect(() => {
        if (!(textAreaRef.current instanceof HTMLTextAreaElement)) {
            return undefined;
        }

        const textArea = textAreaRef.current;
        clearButtonRef.current = new ClearButton(textArea);

        const handleTextCleared = () => {
            setText(textArea.value);
            NotificationManager.show('Text cleared', 3000, { type: 'success' });
        };

        textArea.addEventListener('textCleared', handleTextCleared);
        return () => {
            textArea.removeEventListener('textCleared', handleTextCleared);
            clearButtonRef.current?.disconnect?.();
        };
    }, []);

    useEffect(() => {
        clearButtonRef.current?.updateVisibility?.();
    }, [text]);

    const handleLoadSample = () => {
        setText(SAMPLE_TEXT);
        NotificationManager.show('Sample text loaded', 3000, { type: 'success' });
    };

    const renderWordFrequency = () => {
        const wordFrequency = result.wordFrequency;
        if (!wordFrequency || wordFrequency.length === 0) {
            return (
                <div className="word-frequency-empty" role="listitem">
                    No words to analyze
                </div>
            );
        }

        const maxCount = Math.max(...wordFrequency.map((item) => item.count), 0);
        return wordFrequency.map((item) => {
            const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
            return (
                <div key={item.word} className="word-frequency-item" role="listitem">
                    <span className="word-frequency-label">{item.word}</span>
                    <div className="word-frequency-bar-container" aria-hidden="true">
                        <div
                            className="word-frequency-bar"
                            data-count={item.count}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                    <span className="word-frequency-count sr-only">{item.count} occurrences</span>
                </div>
            );
        });
    };

    return (
        <div className="tool-container text-analyzer-tool">
            <div className="text-analyzer-editor-container ta-editor-container">
                <div className="text-analyzer-panel ta-panel ta-input-panel">
                    <div className="text-analyzer-panel-header ta-panel-header">
                        <h3>Input Text</h3>
                        <div className="text-analyzer-toolbar ta-toolbar">
                            <button
                                className="c-button c-button--secondary ta-load-sample-btn"
                                id="load-sample"
                                onClick={handleLoadSample}
                            >
                                Load Sample
                            </button>
                        </div>
                    </div>
                    <textarea
                        id="textInput"
                        ref={textAreaRef}
                        className="c-input c-input--textarea ta-input-textarea"
                        placeholder="Enter your text here..."
                        aria-label="Input text to analyze"
                        value={text}
                        onInput={(event) => setText(event.target.value)}
                    />
                </div>
            </div>

            <div className="text-analyzer-stats ta-stats-panel">
                {PRIMARY_STATS.map(([key, label]) => (
                    <div key={key} className="text-analyzer-stat-item ta-stat-item">
                        <span className="text-analyzer-stat-label">{label}</span>
                        <span id={key} className="text-analyzer-stat-value">{String(result[key])}</span>
                    </div>
                ))}
            </div>

            <div className="text-analyzer-punctuation ta-punctuation-panel">
                <h4>Punctuation Statistics</h4>
                <div className="text-analyzer-checkbox-group ta-punctuation-grid">
                    {PUNCTUATION_STATS.map(([key, label]) => (
                        <div key={key} className="text-analyzer-stat-item ta-stat-item">
                            <span className="text-analyzer-stat-label">{label}</span>
                            <span id={key} className="text-analyzer-stat-value">{String(result[key])}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="text-analyzer-word-frequency ta-word-frequency-panel">
                <h4>Word Frequency (Top 5)</h4>
                <div
                    id="wordFrequencyChart"
                    className="word-frequency-chart ta-word-frequency-chart"
                    role="list"
                    aria-label="Word Frequency Statistics"
                >
                    {renderWordFrequency()}
                </div>
            </div>

            <div id="notification" className="c-notification" role="status" aria-live="polite" />
        </div>
    );
}

export class TextAnalyzerToolUI {
    constructor(rootSelector = '#text-analyzer-app') {
        const root = document.querySelector(rootSelector) || document.querySelector('.tool-container');
        if (!root) {
            throw new Error('Text Analyzer root element not found');
        }

        const mount = root.hasChildNodes() ? hydrate : render;
        mount(<TextAnalyzerApp />, root);
    }
}

// Export for both ES modules and CommonJS
export { analyzeText };
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { analyzeText, TextAnalyzerApp, TextAnalyzerToolUI };
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', () => {
        mountToolShell({
            title: 'Text Analyzer',
            description: 'Analyze your text to get word count, character statistics, and more.',
            homeHref: '/'
        });
        new TextAnalyzerToolUI();
    });
}
