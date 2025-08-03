import { analyzeText } from './script.js';
import { NotificationManager } from '../common/notification-manager.js';
import ClearButton from '../common/clear-button/ClearButton.js';

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
