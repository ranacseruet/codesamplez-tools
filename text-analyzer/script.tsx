import { hydrate, render } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { NotificationManager } from '../common/notification-manager';
import ClearButton from '../common/clear-button/ClearButton';
import { registerDropZone } from '../common/drop-zone';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { analyzeText, type TextAnalysisResult } from './TextAnalyzer';
import { createLazyRunner, type LazyRunner } from '../common/lazy-runner';
import { TextAnalyzerArticle, TextAnalyzerIntro } from './content';
import toolMetadata from './tool.meta.json';

const SAMPLE_TEXT = "This is a sample text for analysis. It has multiple sentences and paragraphs.\n\nLet's see how well it works!";

/**
 * Inputs at or below this length are analyzed synchronously on the main thread:
 * the work is sub-millisecond and a worker round-trip would only add latency and
 * a frame of flicker. Above it, analysis is offloaded to a Web Worker so typing
 * stays responsive (INP) on very large texts. Kept here (not in analyzer-runner)
 * so the SSR/prerender graph never imports the worker module, which uses
 * `import.meta.url` and must only be evaluated in the browser.
 */
const WORKER_CHAR_THRESHOLD = 5_000;

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
    const runnerRef = useRef<LazyRunner<string, TextAnalysisResult> | null>(null);

    // Small inputs (and the initial paint) are analyzed synchronously: it is
    // sub-millisecond work, keeps hydration deterministic, and avoids worker
    // round-trip latency/flicker. Returns null for large inputs so they take the
    // off-main-thread path below.
    const syncResult = useMemo(
        () => (text.length <= WORKER_CHAR_THRESHOLD ? analyzeText(text) : null),
        [text]
    );
    const [asyncResult, setAsyncResult] = useState<TextAnalysisResult | null>(null);
    // True while a worker analysis for the current (large) input is still in
    // flight — the displayed `result` is stale until it resolves, so Copy
    // Results must stay disabled during that window.
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Large inputs are offloaded to the worker. `createLazyRunner` handles the
    // lazy import (code-splitting the worker out of the main bundle and off the
    // SSR/prerender graph), instance reuse, and the main-thread fallback for
    // both an unavailable worker and a failed chunk load. `active` drops
    // superseded results so only the latest keystroke's analysis is rendered.
    useEffect(() => {
        if (text.length <= WORKER_CHAR_THRESHOLD) {
            setIsAnalyzing(false);
            return undefined;
        }
        let active = true;
        setIsAnalyzing(true);
        if (!runnerRef.current) {
            runnerRef.current = createLazyRunner(
                () => import('./analyzer-runner').then((module) => module.createAnalyzerRunner),
                analyzeText
            );
        }
        // `shouldAbort` drops a run superseded while the worker chunk was still
        // loading (don't dispatch stale text); the `active` guard then drops any
        // result that lands after this effect was torn down.
        runnerRef.current.run(text, () => !active).then((analysis) => {
            if (active) {
                setAsyncResult(analysis);
                setIsAnalyzing(false);
            }
        });
        return () => {
            active = false;
        };
    }, [text]);

    useEffect(() => () => runnerRef.current?.terminate(), []);

    // Prefer the fresh synchronous result; for large inputs fall through to the
    // most recent worker result until the next one arrives.
    const result = syncResult ?? asyncResult ?? analyzeText('');

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

    // A dropped file behaves exactly like Load Sample carrying that file's
    // contents. Analysis is live here, so setting the text is the whole job.
    useLayoutEffect(() => {
        if (!(textAreaRef.current instanceof HTMLTextAreaElement)) {
            /* istanbul ignore next */
            return undefined;
        }

        return registerDropZone(textAreaRef.current, {
            onText: (droppedText, file) => {
                setText(droppedText);
                NotificationManager.show(`Loaded ${file.name}`, 2000, { type: 'success' });
            },
            onError: (message) => NotificationManager.show(message, 3000, { type: 'error' })
        });
    }, []);

    const handleLoadSample = () => {
        setText(SAMPLE_TEXT);
        NotificationManager.show('Sample text loaded', 3000, { type: 'success' });
    };

    // The stat wells are span-based (no single copyable element), so one
    // explicit button serializes the results — the contract's "one pattern
    // per output type" for structured outputs.
    const handleCopyResults = async () => {
        const lines = [...PRIMARY_STATS, ...PUNCTUATION_STATS].map(
            ([key, label]) => `${label}: ${String(result[key])}`
        );
        const frequency = result.wordFrequency && result.wordFrequency.length > 0
            ? result.wordFrequency.map((item) => `${item.word}: ${item.count}`).join(', ')
            : 'No words to analyze';
        const content = [...lines, `Word Frequency (Top 5): ${frequency}`].join('\n');

        const onSuccess = () => NotificationManager.show('Results copied to clipboard!', 2000, { type: 'success' });
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(content);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = content;
                textarea.style.position = 'fixed';
                textarea.style.left = '-999999px';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                try {
                    if (!document.execCommand('copy')) {
                        throw new Error('execCommand copy failed');
                    }
                } finally {
                    document.body.removeChild(textarea);
                }
            }
            onSuccess();
        } catch {
            NotificationManager.show('Failed to copy results', 3000, { type: 'error' });
        }
    };

    const handleTextInput = (event) => {
        const input = event.target;
        setText(input instanceof HTMLTextAreaElement ? input.value : '');
    };

    const renderWordFrequency = () => {
        const wordFrequency = result.wordFrequency;
        if (!wordFrequency || wordFrequency.length === 0) {
            return (
                <div className="word-frequency-empty c-empty-state" role="listitem">
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
                            className="c-button c-button--ghost ta-load-sample-btn"
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
                        placeholder="Enter your text here, or drop a file..."
                        aria-label="Input text to analyze"
                        value={text}
                        onInput={handleTextInput}
                    />
                </div>
            </div>

            <div className="text-analyzer-stats ta-stats-panel c-surface-card">
                <div className="text-analyzer-stats-header ta-stats-header">
                    <h3 className="text-analyzer-stats-title ta-stats-title">Statistics</h3>
                    <button
                        id="copy-results"
                        className="c-button c-button--secondary c-button--small ta-copy-results-btn"
                        onClick={() => void handleCopyResults()}
                        disabled={!text || isAnalyzing}
                    >
                        Copy Results
                    </button>
                </div>
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
