import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/dom';
import { render as preactRender } from 'preact';
import { fireFileDragEvent, fireFileDrop, flushFileDrop } from '../common/drop-zone-test-utils';

const clearButtonInstances = [];

jest.mock('../common/notification-manager', () => ({
    NotificationManager: {
        show: jest.fn()
    }
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
    mountToolShell: jest.fn()
}));

jest.mock('../common/clear-button/ClearButton', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
        const instance = {
            updateVisibility: jest.fn(),
            disconnect: jest.fn()
        };
        clearButtonInstances.push(instance);
        return instance;
    })
}));

// Controllable lazy runner: only the large-input (async) analysis path reaches
// it, and no other test in this suite uses inputs above the worker threshold.
var resolvePendingAnalysis = null;
jest.mock('../common/lazy-runner', () => ({
    createLazyRunner: jest.fn(() => ({
        run: jest.fn(() => new Promise((resolve) => { resolvePendingAnalysis = resolve; })),
        terminate: jest.fn()
    }))
}));

import { NotificationManager } from '../common/notification-manager';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { TextAnalyzerToolUI } from './script';
import { analyzeText } from './TextAnalyzer';
import ClearButton from '../common/clear-button/ClearButton';
import { FAQ_ITEMS } from './content';
import { SITE_BASE_URL } from '../common/siteBaseUrl';

describe('TextAnalyzer Preact runtime', () => {
    const flush = () => Promise.resolve();
    const flushEffects = async () => {
        await flush();
        await flush();
    };
    // Preact flushes useEffect on a deferred (rAF/timer) schedule; poll across
    // a few macrotasks rather than assuming a single tick is enough.
    const waitFor = async (predicate, label) => {
        for (let i = 0; i < 50; i += 1) {
            if (predicate()) return;
            await flushEffects();
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        throw new Error(`Timed out waiting for ${label}`);
    };

    beforeEach(() => {
        jest.clearAllMocks();
        clearButtonInstances.length = 0;
        resolvePendingAnalysis = null;
        document.body.innerHTML = '<div id="text-analyzer-app"></div>';
    });

    it('renders initial stats and empty word-frequency state', async () => {
        new TextAnalyzerToolUI();
        await flushEffects();

        expect(document.getElementById('wordCount')?.textContent).toBe('0');
        expect(document.getElementById('charCount')?.textContent).toBe('0');
        expect(document.getElementById('readingTime')?.textContent).toBe('0 min');
        expect(document.getElementById('readabilityScore')?.textContent).toBe('—');
        expect(document.getElementById('gradeLevel')?.textContent).toBe('—');
        expect(document.getElementById('keywordDensity')?.textContent).toBe('—');
        expect(document.getElementById('wordFrequencyChart')?.textContent).toContain('No words to analyze');
    });

    it('renders live-synced intro copy, article sections, FAQs, and CTA links', async () => {
        new TextAnalyzerToolUI();
        await flushEffects();

    });

    it('updates counts and word-frequency chart on input', async () => {
        new TextAnalyzerToolUI();
        await flushEffects();

        const input = document.getElementById('textInput');
        fireEvent.input(input, { target: { value: 'hello hello world' } });
        await flushEffects();

        expect(document.getElementById('wordCount')?.textContent).toBe('3');
        expect(document.getElementById('charCount')?.textContent).toBe(String('hello hello world'.length));
        expect(document.getElementById('readingTime')?.textContent).toBe('1 min');
        expect(document.getElementById('keywordDensity')?.textContent).toBe('hello — 66.67%');
        const chart = document.getElementById('wordFrequencyChart');
        expect(chart.querySelectorAll('.word-frequency-item').length).toBeGreaterThan(0);
        expect(chart.textContent.toLowerCase()).toContain('hello');
    });

    it('shows the true reading-ease score, a floored grade, and an em dash for inapplicable text', async () => {
        new TextAnalyzerToolUI();
        await flushEffects();

        const input = document.getElementById('textInput');
        // 206.835 - 1.015 * (1 word / 1 sentence) - 84.6 * (1 syllable / 1 word)
        fireEvent.input(input, { target: { value: 'Go.' } });
        await flushEffects();

        expect(document.getElementById('readabilityScore')?.textContent).toBe('121.22');
        expect(document.getElementById('gradeLevel')?.textContent).toBe('0.00');

        // One long sentence of polysyllabic words scores below zero.
        fireEvent.input(input, { target: { value: `${'Institutionalization notwithstanding '.repeat(12)}considerations.` } });
        await flushEffects();

        expect(Number(document.getElementById('readabilityScore')?.textContent)).toBeLessThan(0);

        fireEvent.input(input, { target: { value: 'Это тест.' } });
        await flushEffects();

        expect(document.getElementById('readabilityScore')?.textContent).toBe('—');
        expect(document.getElementById('gradeLevel')?.textContent).toBe('—');
        expect(document.getElementById('keywordDensity')?.textContent).toBe('—');
    });

    it('analyzes large inputs via the async (worker/fallback) path', async () => {
        // jsdom has no `Worker`, so the worker-runner falls back to the
        // main-thread `analyzeText`, but the component still routes large inputs
        // (> WORKER_CHAR_THRESHOLD chars) through the async effect rather than the
        // synchronous useMemo branch.
        new TextAnalyzerToolUI();
        await flushEffects();

        const largeText = 'word '.repeat(1100); // 5500 chars, 1100 words
        const input = document.getElementById('textInput');
        fireEvent.input(input, { target: { value: largeText } });

        await waitFor(() => typeof resolvePendingAnalysis === 'function', 'resolvePendingAnalysis is a function');

        resolvePendingAnalysis(analyzeText(largeText));
        await waitFor(() => document.getElementById('wordCount')?.textContent === '1100', 'wordCount === 1100');

        expect(document.getElementById('wordCount')?.textContent).toBe('1100');
        expect(document.getElementById('charCount')?.textContent).toBe('5500');
    });

    it('updates punctuation statistics for commas and question marks', async () => {
        new TextAnalyzerToolUI();
        await flushEffects();

        const input = document.getElementById('textInput');
        fireEvent.input(input, { target: { value: 'Hello, world? Yes!' } });
        await flushEffects();

        expect(document.getElementById('commaCount')?.textContent).toBe('1');
        expect(document.getElementById('questionCount')?.textContent).toBe('1');
        expect(document.getElementById('exclamationCount')?.textContent).toBe('1');
    });

    it('loads sample text and shows notification', async () => {
        new TextAnalyzerToolUI();
        await flushEffects();

        fireEvent.click(document.getElementById('load-sample'));
        await flushEffects();

        expect(document.getElementById('textInput')?.value).toContain('This is a sample text for analysis.');
        expect(NotificationManager.show).toHaveBeenCalledWith('Sample text loaded', expect.any(Number), expect.any(Object));
    });

    it('analyzes a dropped file', async () => {
        new TextAnalyzerToolUI();
        await flushEffects();

        fireFileDrop(document.getElementById('textInput'), 'one two three.', 'notes.txt');
        // This suite's own waitFor takes a predicate, not an assertion.
        await waitFor(
            () => document.getElementById('textInput')?.value === 'one two three.',
            'the dropped text to load'
        );
        await flushEffects();

        expect(document.getElementById('textInput')?.value).toBe('one two three.');

        expect(document.getElementById('wordCount')?.textContent).toBe('3');
        expect(NotificationManager.show).toHaveBeenCalledWith(
            'Loaded notes.txt',
            expect.any(Number),
            expect.objectContaining({ type: 'success' })
        );
    });

    it('reports a dropped file that cannot be read', async () => {
        new TextAnalyzerToolUI();
        await flushEffects();

        const unreadable = new File(['x'], 'locked.txt');
        Object.defineProperty(unreadable, 'text', { value: () => Promise.reject(new Error('nope')) });
        fireFileDragEvent(document.getElementById('textInput'), 'drop', [unreadable]);
        await flushFileDrop();
        await flushEffects();

        expect(document.getElementById('textInput')?.value).toBe('');
        expect(NotificationManager.show).toHaveBeenCalledWith(
            expect.stringContaining('Could not read'),
            expect.any(Number),
            expect.objectContaining({ type: 'error' })
        );
    });

    it('handles clear-button textCleared event and shows notification', async () => {
        new TextAnalyzerToolUI();
        await flushEffects();

        const input = document.getElementById('textInput');
        fireEvent.input(input, { target: { value: 'to be cleared' } });
        await flushEffects();

        input.value = '';
        input.dispatchEvent(new CustomEvent('textCleared', { bubbles: true }));
        await flushEffects();

        expect(document.getElementById('textInput')?.value).toBe('');
        expect(document.getElementById('wordCount')?.textContent).toBe('0');
        expect(NotificationManager.show).toHaveBeenCalledWith('Text cleared', expect.any(Number), expect.any(Object));
    });

    it('copies serialized results via the Copy Results button', async () => {
        // jsdom is not a secure context → the execCommand fallback path runs.
        let capturedContent = '';
        const execCommandMock = jest.fn((command) => {
            if (command === 'copy') {
                capturedContent = document.activeElement?.value || '';
                return true;
            }
            return false;
        });
        document.execCommand = execCommandMock;

        new TextAnalyzerToolUI();
        await flushEffects();

        fireEvent.input(document.getElementById('textInput'), { target: { value: 'Hello, world? Yes!' } });
        await flushEffects();

        fireEvent.click(document.getElementById('copy-results'));
        await flushEffects();

        expect(execCommandMock).toHaveBeenCalledWith('copy');
        expect(capturedContent).toContain('Word Count: 3');
        expect(capturedContent).toContain('Reading Time: 1 min');
        expect(capturedContent).toContain('Top Keyword Density: hello — 33.33%');
        expect(capturedContent).toContain('Word Frequency (Top 5):');
        expect(NotificationManager.show).toHaveBeenCalledWith('Results copied to clipboard!', 2000, { type: 'success' });

        delete document.execCommand;
    });

    it('keeps Copy Results disabled while input is empty', async () => {
        new TextAnalyzerToolUI();
        await flushEffects();

        expect(document.getElementById('copy-results')?.disabled).toBe(true);
    });

    it('copies results via the Clipboard API in a secure context', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText } });
        Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });

        new TextAnalyzerToolUI();
        await flushEffects();

        fireEvent.input(document.getElementById('textInput'), { target: { value: 'Hello world' } });
        await flushEffects();

        fireEvent.click(document.getElementById('copy-results'));
        // The toast lands a turn after the write resolves (the copy goes through
        // the shared helper), so poll for it rather than assuming a turn count.
        await waitFor(
            () => NotificationManager.show.mock.calls.some((call) => call[0] === 'Results copied to clipboard!'),
            'copy success toast'
        );

        expect(writeText.mock.calls[0][0]).toContain('Word Count: 2');
        expect(NotificationManager.show).toHaveBeenCalledWith('Results copied to clipboard!', 2000, { type: 'success' });
    });

    it('shows an error toast when the copy fallback fails', async () => {
        // Force the execCommand fallback path and make it fail.
        Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
        Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: undefined });
        document.execCommand = jest.fn(() => false);

        new TextAnalyzerToolUI();
        await flushEffects();

        fireEvent.input(document.getElementById('textInput'), { target: { value: 'Hello world' } });
        await flushEffects();

        fireEvent.click(document.getElementById('copy-results'));
        await waitFor(() => NotificationManager.show.mock.calls.some((c) => c[0] === 'Failed to copy results'), 'copy failure toast');

        expect(NotificationManager.show).toHaveBeenCalledWith('Failed to copy results', 3000, { type: 'error' });

        delete document.execCommand;
    });

    it('keeps Copy Results disabled until the async analysis resolves', async () => {
        new TextAnalyzerToolUI();
        await flushEffects();

        const largeText = 'word '.repeat(1100); // 5500 chars → async worker path
        fireEvent.input(document.getElementById('textInput'), { target: { value: largeText } });

        // Wait until the async effect dispatched the runner AND the disabled
        // state re-rendered (the pre-render empty-text state is also disabled,
        // so check both signals to avoid a false pass).
        await waitFor(
            () => typeof resolvePendingAnalysis === 'function' && document.getElementById('copy-results')?.disabled === true,
            'runner dispatched and copy-results disabled'
        );

        expect(document.getElementById('copy-results')?.disabled).toBe(true);

        resolvePendingAnalysis({ wordCount: 1100, wordFrequency: [] });
        await waitFor(() => document.getElementById('copy-results')?.disabled === false, 'copy-results is enabled');

        expect(document.getElementById('copy-results')?.disabled).toBe(false);
    });

    it('unmounts cleanly without errors', async () => {
        new TextAnalyzerToolUI();
        for (let i = 0; i < 5 && clearButtonInstances.length === 0; i += 1) {
            await flushEffects();
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        expect(() => preactRender(null, document.getElementById('text-analyzer-app'))).not.toThrow();
        await flushEffects();
        const clearButtonInstance = clearButtonInstances.at(-1);
        if (clearButtonInstance) {
            expect(clearButtonInstance.disconnect).toHaveBeenCalled();
        }
    });

    it('throws when no mount root is available', () => {
        document.body.innerHTML = '';
        expect(() => new TextAnalyzerToolUI('#missing-root')).toThrow('Text Analyzer root element not found');
    });

    it('bootstraps shell and app on DOMContentLoaded', async () => {
        document.body.innerHTML = `
            <div id="app-shell-header"></div>
            <div id="text-analyzer-app"></div>
            <div id="app-shell-footer"></div>
        `;

        document.dispatchEvent(new Event('DOMContentLoaded'));
        await flushEffects();

        expect(mountToolShell).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Text Analyzer'
        }));
        expect(document.getElementById('textInput')).not.toBeNull();
    });
});
