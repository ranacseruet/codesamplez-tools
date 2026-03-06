import { analyzeText, type TextAnalysisResult } from './TextAnalyzer';
import { NotificationManager } from '../common/notification-manager';
import ClearButton from '../common/clear-button/ClearButton';

const TEXT_STAT_KEYS = [
    'charCount',
    'wordCount',
    'lineCount',
    'sentenceCount',
    'paragraphCount',
    'avgWordLength',
    'avgSentenceLength',
    'periodCount',
    'commaCount',
    'questionCount',
    'exclamationCount'
] as const;

type TextStatKey = typeof TEXT_STAT_KEYS[number];
type WordFrequencyEntry = NonNullable<TextAnalysisResult['wordFrequency']>[number];

export class TextAnalyzerUI {
    textInput: HTMLTextAreaElement | null;
    loadSampleButton: HTMLButtonElement | null;
    clearBtnInstance: ClearButton | null;
    elements: Record<TextStatKey, HTMLElement | null>;
    wordFrequencyChart: HTMLElement | null;

    constructor() {
        this.textInput = document.getElementById('textInput') as HTMLTextAreaElement | null;
        this.loadSampleButton = document.getElementById('load-sample') as HTMLButtonElement | null;
        this.clearBtnInstance = this.textInput ? new ClearButton(this.textInput) : null;

        this.elements = {
            charCount: document.getElementById('charCount'),
            wordCount: document.getElementById('wordCount'),
            lineCount: document.getElementById('lineCount'),
            sentenceCount: document.getElementById('sentenceCount'),
            paragraphCount: document.getElementById('paragraphCount'),
            avgWordLength: document.getElementById('avgWordLength'),
            avgSentenceLength: document.getElementById('avgSentenceLength'),
            periodCount: document.getElementById('periodCount'),
            commaCount: document.getElementById('commaCount'),
            questionCount: document.getElementById('questionCount'),
            exclamationCount: document.getElementById('exclamationCount')
        };

        this.wordFrequencyChart = document.getElementById('wordFrequencyChart');

        this.initializeEventListeners();
        this.updateCounts();
    }

    updateCounts(): void {
        if (!this.textInput) {
            return;
        }

        const result = analyzeText(this.textInput.value);
        TEXT_STAT_KEYS.forEach((key) => {
            const element = this.elements[key];
            if (element) {
                element.textContent = String(result[key]);
            }
        });

        this.updateWordFrequencyChart(result.wordFrequency);
    }

    updateWordFrequencyChart(wordFrequency: TextAnalysisResult['wordFrequency']): void {
        if (!this.wordFrequencyChart) {
            return;
        }

        this.wordFrequencyChart.innerHTML = '';

        if (!wordFrequency || wordFrequency.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'word-frequency-empty';
            emptyMessage.textContent = 'No words to analyze';
            emptyMessage.style.cssText = `
                text-align: center;
                color: var(--color-text-secondary);
                font-style: italic;
                padding: var(--spacing-md);
            `;
            this.wordFrequencyChart.appendChild(emptyMessage);
            return;
        }

        const maxCount = Math.max(...wordFrequency.map((item) => item.count));

        wordFrequency.forEach((item) => {
            this.wordFrequencyChart?.appendChild(this.createWordFrequencyItem(item, maxCount));
        });
    }

    createWordFrequencyItem(item: WordFrequencyEntry, maxCount: number): HTMLDivElement {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'word-frequency-item';
        itemDiv.setAttribute('role', 'listitem');

        const labelSpan = document.createElement('span');
        labelSpan.className = 'word-frequency-label';
        labelSpan.textContent = item.word;

        const barContainer = document.createElement('div');
        barContainer.className = 'word-frequency-bar-container';
        barContainer.setAttribute('aria-hidden', 'true');

        const bar = document.createElement('div');
        bar.className = 'word-frequency-bar';
        bar.setAttribute('data-count', String(item.count));

        const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
        bar.style.width = `${percentage}%`;

        const countSpan = document.createElement('span');
        countSpan.className = 'word-frequency-count sr-only';
        countSpan.textContent = `${item.count} occurrences`;

        barContainer.appendChild(bar);
        itemDiv.appendChild(labelSpan);
        itemDiv.appendChild(barContainer);
        itemDiv.appendChild(countSpan);
        return itemDiv;
    }

    initializeEventListeners(): void {
        if (this.textInput) {
            this.textInput.addEventListener('input', () => {
                this.updateCounts();
            });

            this.textInput.addEventListener('textCleared', () => {
                this.updateCounts();
                NotificationManager.show('Text cleared', 3000, { type: 'success' });
            });
        }

        if (this.loadSampleButton) {
            this.loadSampleButton.addEventListener('click', () => {
                if (!this.textInput) {
                    return;
                }

                const sampleText =
                    "This is a sample text for analysis. It has multiple sentences and paragraphs.\n\nLet's see how well it works!";
                this.textInput.value = sampleText;
                this.updateCounts();
                this.clearBtnInstance?.updateVisibility();
                NotificationManager.show('Sample text loaded', 3000, { type: 'success' });
            });
        }
    }
}

export default TextAnalyzerUI;
