function analyzeText(text = '') {
    // Convert null/undefined to empty string and ensure we're working with a string
    text = String(text);

    // Handle empty input
    if (!text) {
        return {
            charCount: 0,
            wordCount: 0,
            lineCount: 0,
            sentenceCount: 0,
            paragraphCount: 0,
            avgWordLength: '0.00',
            avgSentenceLength: '0.00',
            periodCount: 0,
            commaCount: 0,
            questionCount: 0,
            exclamationCount: 0
        };
    }

    // Character count is straightforward
    const charCount = text.length;

    // Word count: split on whitespace and filter out empty strings
    const words = text.trim() ? text.trim().split(/\s+/) : [];
    const wordCount = words.length;

    // Average Word Length: calculate after stripping punctuation
    const cleanedWords = words.map(word => word.replace(/[^a-zA-Z0-9]/g, '')); // Remove all non-alphanumeric
    const totalWordLength = cleanedWords.reduce((sum, word) => sum + word.length, 0);
    const avgWordLength = wordCount > 0 ? (totalWordLength / wordCount).toFixed(2) : '0.00';

    // Line count: split on newlines, but return 0 for empty string
    const lineCount = text ? text.split('\n').length : 0;

    // Sentence count
    let sentenceCount = 0;
    const trimmedText = text.trim();
    if (trimmedText) {
        // Match sentences ending with . ! ? followed by whitespace or end of string
        const sentences = trimmedText.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [];
        sentenceCount = sentences.length;
        // If there's remaining text without punctuation, count it as a sentence
        const remainingText = trimmedText.replace(/[^.!?]+[.!?]+(?:\s+|$)/g, '').trim();
        if (remainingText) {
            sentenceCount++;
        }
    }

    // Paragraph count
    let paragraphCount = 0;
    if (trimmedText) {
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
        paragraphCount = paragraphs.length;
    }

    // Average Sentence Length (in words)
    let avgSentenceLength = '0.00'; // Default to string "0.00"
    if (sentenceCount > 0) {
        const totalWordsInSentences = words.length; // Assuming all words belong to some sentence
        avgSentenceLength = (totalWordsInSentences / sentenceCount).toFixed(2);
    }

    // Punctuation Counts
    const periodCount = (text.match(/\./g) || []).length;
    const commaCount = (text.match(/,/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;
    const exclamationCount = (text.match(/!/g) || []).length;

    return {
        charCount,
        wordCount,
        lineCount,
        sentenceCount,
        paragraphCount,
        avgWordLength,
        avgSentenceLength,
        periodCount,
        commaCount,
        questionCount,
        exclamationCount
    };
}

// Export for both ES modules and CommonJS
export { analyzeText };
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { analyzeText };
}

import { TextAnalyzerUI } from './TextAnalyzerUI.js';

// Browser event handling
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        new TextAnalyzerUI();
    });
}
