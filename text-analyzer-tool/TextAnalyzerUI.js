import { analyzeText } from './script.js';

export class TextAnalyzerUI {
    constructor() {
        this.textInput = document.getElementById('textInput');
        this.clearButton = document.getElementById('clear-input');
        this.loadSampleButton = document.getElementById('load-sample');
        this.notificationElement = document.getElementById('notification');

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

        this.initializeEventListeners();
        this.updateCounts();
    }

    showNotification(message, isError = false) {
        if (this.notificationElement) {
            this.notificationElement.textContent = message;
            this.notificationElement.classList.remove('c-notification--success', 'c-notification--error');
            this.notificationElement.classList.add('c-notification--visible');
            if (isError) {
                this.notificationElement.classList.add('c-notification--error');
            } else {
                this.notificationElement.classList.add('c-notification--success');
            }
            setTimeout(() => {
                this.notificationElement.classList.remove('c-notification--visible');
            }, 3000);
        }
    }

    updateCounts() {
        if (!this.textInput) return;
        const result = analyzeText(this.textInput.value);
        Object.entries(result).forEach(([key, value]) => {
            if (this.elements[key]) {
                this.elements[key].textContent = String(value);
            }
        });
    }

    initializeEventListeners() {
        if (this.textInput) {
            this.textInput.addEventListener('input', () => {
                this.updateCounts();
                if (this.notificationElement) {
                    this.notificationElement.classList.remove('c-notification--visible');
                }
            });
        }

        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => {
                this.textInput.value = '';
                this.updateCounts();
                this.showNotification("Text cleared.", false);
            });
        }

        if (this.loadSampleButton) {
            this.loadSampleButton.addEventListener('click', () => {
                const sampleText = "This is a sample text for analysis. It has multiple sentences and paragraphs.\n\nLet's see how well it works!";
                this.textInput.value = sampleText;
                this.updateCounts();
                this.showNotification("Sample text loaded.", false);
            });
        }
    }
}

// Export for both ES modules and CommonJS
export default TextAnalyzerUI;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextAnalyzerUI;
}
