import { hydrate, render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { NotificationManager } from '../common/notification-manager';
import ClearButton from '../common/clear-button/ClearButton';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { analyzeText } from './TextAnalyzer';
import { TextAnalyzerArticle, TextAnalyzerIntro } from './content';
import toolMetadata from './tool.meta.json';

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

    const handleTextInput = (event) => {
        const input = event.target;
        setText(input instanceof HTMLTextAreaElement ? input.value : '');
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
        <div className="tool-container text-analyzer-tool c-tool-stack">
            <div className="text-analyzer-editor-container ta-editor-container">
                <div className="text-analyzer-panel ta-panel ta-input-panel c-surface-card c-surface-panel">
                    <div className="text-analyzer-panel-header ta-panel-header c-surface-panel__header">
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
                        className="c-input c-input--textarea c-editor-fill ta-input-textarea"
                        placeholder="Enter your text here..."
                        aria-label="Input text to analyze"
                        value={text}
                        onInput={handleTextInput}
                    />
                </div>
            </div>

            <div className="text-analyzer-stats ta-stats-panel c-surface-card">
                {PRIMARY_STATS.map(([key, label]) => (
                    <div key={key} className="text-analyzer-stat-item ta-stat-item">
                        <span className="text-analyzer-stat-label">{label}</span>
                        <span id={key} className="text-analyzer-stat-value">{String(result[key])}</span>
                    </div>
                ))}
            </div>

            <div className="text-analyzer-punctuation ta-punctuation-panel c-surface-card">
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

            <div className="text-analyzer-word-frequency ta-word-frequency-panel c-surface-card">
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

            {/* Tool-first ordering: About intro + guide below the interactive tool. */}
            <TextAnalyzerIntro />
            <TextAnalyzerArticle />
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
            title: toolMetadata.title,
            description: toolMetadata.description,
            homeHref: '/'
        });
        new TextAnalyzerToolUI();
    });
}
