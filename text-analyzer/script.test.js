import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/dom';
import { render as preactRender } from 'preact';

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

import { NotificationManager } from '../common/notification-manager';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { TextAnalyzerToolUI } from './script';
import ClearButton from '../common/clear-button/ClearButton';
import { FAQ_ITEMS } from './content';
import { SITE_BASE_URL } from '../common/siteBaseUrl';

describe('TextAnalyzer Preact runtime', () => {
    const flush = () => Promise.resolve();
    const flushEffects = async () => {
        await flush();
        await flush();
    };

    beforeEach(() => {
        jest.clearAllMocks();
        clearButtonInstances.length = 0;
        document.body.innerHTML = '<div id="text-analyzer-app"></div>';
    });

    it('renders initial stats and empty word-frequency state', async () => {
        new TextAnalyzerToolUI();
        await flushEffects();

        expect(document.getElementById('wordCount')?.textContent).toBe('0');
        expect(document.getElementById('charCount')?.textContent).toBe('0');
        expect(document.getElementById('wordFrequencyChart')?.textContent).toContain('No words to analyze');
    });

    it('renders live-synced intro copy, article sections, FAQs, and CTA links', async () => {
        new TextAnalyzerToolUI();
        await flushEffects();

        expect(document.body.textContent).toContain(
            'The CodeSamplez Text Analyzer is a free online text analysis tool that instantly provides detailed statistics about your text.'
        );
        expect(document.body.textContent).toContain('What is a Text Analyzer?');
        expect(document.body.textContent).toContain('Features and Benefits of the Text Analyzer:');
        expect(document.body.textContent).toContain('How To Use The Text Analyzer:');
        expect(document.body.textContent).toContain('Text Analyzer FAQs:');

        FAQ_ITEMS.forEach((item) => {
            expect(document.body.textContent).toContain(item.question);
            expect(item.structuredDataAnswer).toEqual(expect.any(String));
            expect(item.structuredDataAnswer.length).toBeGreaterThan(0);
        });

        const toolsLink = document.querySelector(`a[href="${SITE_BASE_URL}"]`);
        const contactLink = document.querySelector('a[href="https://codesamplez.com/contact"]');

        expect(toolsLink?.textContent).toContain('Explore More Dev Tools');
        expect(contactLink?.textContent).toContain('contact us');
    });

    it('updates counts and word-frequency chart on input', async () => {
        new TextAnalyzerToolUI();
        await flushEffects();

        const input = document.getElementById('textInput');
        fireEvent.input(input, { target: { value: 'hello hello world' } });
        await flushEffects();

        expect(document.getElementById('wordCount')?.textContent).toBe('3');
        expect(document.getElementById('charCount')?.textContent).toBe(String('hello hello world'.length));
        const chart = document.getElementById('wordFrequencyChart');
        expect(chart.querySelectorAll('.word-frequency-item').length).toBeGreaterThan(0);
        expect(chart.textContent.toLowerCase()).toContain('hello');
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

        // Poll for the async result to land.
        for (let i = 0; i < 20 && document.getElementById('wordCount')?.textContent !== '1100'; i += 1) {
            await flushEffects();
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

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
