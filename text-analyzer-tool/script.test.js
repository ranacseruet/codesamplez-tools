import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/dom';
import { render as preactRender } from 'preact';

const clearButtonInstances = [];

jest.mock('../common/notification-manager.js', () => ({
    NotificationManager: {
        show: jest.fn()
    }
}));

jest.mock('../common/app-shell/mountToolShell.js', () => ({
    mountToolShell: jest.fn()
}));

jest.mock('../common/clear-button/ClearButton.js', () => ({
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

import { NotificationManager } from '../common/notification-manager.js';
import { mountToolShell } from '../common/app-shell/mountToolShell.js';
import { TextAnalyzerToolUI } from './script.js';
import ClearButton from '../common/clear-button/ClearButton.js';

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
        expect(clearButtonInstances.length).toBeGreaterThan(0);
        const clearButtonInstance = clearButtonInstances.at(-1);
        expect(clearButtonInstance.disconnect).toHaveBeenCalled();
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
