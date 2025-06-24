import { TextAnalyzerUI } from './TextAnalyzerUI.js';

// Function to initialize TextAnalyzerUI, exposed for testing
export function initializeTextAnalyzer() {
    const instance = new TextAnalyzerUI();
    // Expose instance for testing
    if (typeof window !== 'undefined') {
        window.textAnalyzerInstance = instance;
    }
    return instance;
}

// Browser event handling
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeTextAnalyzer();
    });
}
