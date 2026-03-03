import { analyzeText } from './TextAnalyzer';
import { NotificationManager } from '../common/notification-manager';
import ClearButton from '../common/clear-button/ClearButton';

export class TextAnalyzerUI {
    constructor() {
        this.textInput = document.getElementById('textInput');
        this.loadSampleButton = document.getElementById('load-sample');
        this.clearBtnInstance = new ClearButton(this.textInput);

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

    updateCounts() {
        if (!this.textInput) return;
        const result = analyzeText(this.textInput.value);
        Object.entries(result).forEach(([key, value]) => {
            if (this.elements[key]) {
                this.elements[key].textContent = String(value);
            }
        });

        // Update word frequency chart
        this.updateWordFrequencyChart(result.wordFrequency);
    }

    updateWordFrequencyChart(wordFrequency) {
        if (!this.wordFrequencyChart) return;

        // Clear existing chart
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

        // Find the maximum count for scaling the bars
        const maxCount = Math.max(...wordFrequency.map(item => item.count));

        // Create bars for each word
        wordFrequency.forEach(item => {
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
            bar.setAttribute('data-count', item.count);

            // Calculate bar width as percentage of max count
            const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
            bar.style.width = `${percentage}%`;

            const countSpan = document.createElement('span');
            countSpan.className = 'word-frequency-count sr-only';
            countSpan.textContent = `${item.count} occurrences`;

            barContainer.appendChild(bar);
            itemDiv.appendChild(labelSpan);
            itemDiv.appendChild(barContainer);
            itemDiv.appendChild(countSpan);

            this.wordFrequencyChart.appendChild(itemDiv);
        });
    }

    initializeEventListeners() {
        if (this.textInput) {
            this.textInput.addEventListener('input', () => {
                this.updateCounts();
            });
        }

        if (this.textInput) {
            this.textInput.addEventListener('textCleared', () => {
                this.updateCounts();
                NotificationManager.show("Text cleared", 3000, {type: 'success'});
            });
        }

        if (this.loadSampleButton) {
            this.loadSampleButton.addEventListener('click', () => {
                const sampleText = "This is a sample text for analysis. It has multiple sentences and paragraphs.\n\nLet's see how well it works!";
                this.textInput.value = sampleText;
                this.updateCounts();
                this.clearBtnInstance.updateVisibility();
                NotificationManager.show("Sample text loaded", 3000, {type: 'success'});
            });
        }
    }
}

// Export for both ES modules and CommonJS
export default TextAnalyzerUI;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextAnalyzerUI;
}
