document.addEventListener('DOMContentLoaded', () => {
    const textInput = document.getElementById('textInput');
    const clearButton = document.getElementById('clear-input');
    const loadSampleButton = document.getElementById('load-sample');
    const analyzeButton = document.getElementById('analyze-btn');
    const notification = document.getElementById('notification');
    
    // Analyze text on input (real-time)
    textInput.addEventListener('input', analyzeText);
    
    // Clear button functionality
    clearButton.addEventListener('click', () => {
        document.getElementById('textInput').value = '';
        analyzeText();
        showNotification('Text cleared!');
    });
    
    // Load sample text
    loadSampleButton.addEventListener('click', () => {
        textInput.value = getSampleText();
        analyzeText();
    });
    
    // Analyze button functionality
    analyzeButton.addEventListener('click', () => {
        analyzeText();
        showNotification('Text analyzed successfully!');
    });
    
    // Initial analysis
    analyzeText();
});

// Show notification
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Sample text for the "Load Sample" button
function getSampleText() {
    return `The quick brown fox jumps over the lazy dog. This pangram contains every letter of the English alphabet at least once.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris!

How are you today? I hope you're doing well. This sample text demonstrates various punctuation marks, including commas, periods, question marks, and exclamation points.`;
}

function analyzeText() {
    const text = document.getElementById('textInput').value;
    
    // Basic counts
    updateWordCount(text);
    updateCharCount(text);
    updateParagraphCount(text);
    updateAverageWordLength(text);
    updateAverageSentenceLength(text);
    updatePunctuationStats(text);
}

function updateWordCount(text) {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    document.getElementById('wordCount').textContent = words.length;
    return words.length;
}

function updateCharCount(text) {
    document.getElementById('charCount').textContent = text.length;
    return text.length;
}

function updateParagraphCount(text) {
    // Split on double newlines to count paragraphs
    const paragraphs = text.trim().split(/\n\s*\n/).filter(para => para.length > 0);
    document.getElementById('paragraphCount').textContent = paragraphs.length || 0;
    return paragraphs.length || 0;
}

function updateAverageWordLength(text) {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    if (words.length === 0) {
        document.getElementById('avgWordLength').textContent = '0';
        return '0';
    }
    
    // Calculate total characters in words (excluding punctuation)
    // Calculate average word length by summing individual word lengths after removing punctuation
    const totalChars = words.reduce((sum, word) => {
        const cleanWord = word.replace(/[^a-zA-Z]/g, '');
        return sum + cleanWord.length;
    }, 0);
    
    const avgLength = (totalChars / words.length).toFixed(1);
    document.getElementById('avgWordLength').textContent = avgLength;
    return avgLength;
}

function updateAverageSentenceLength(text) {
    // Split on sentence terminators
    const sentences = text.trim().split(/[.!?]+/).filter(sent => sent.trim().length > 0);
    if (sentences.length === 0) {
        document.getElementById('avgSentenceLength').textContent = '0';
        return '0';
    }
    
    // Count words in each sentence
    const totalWords = sentences.reduce((sum, sentence) => {
        const words = sentence.trim().split(/\s+/).filter(word => word.length > 0);
        return sum + words.length;
    }, 0);
    
    const avgLength = (totalWords / sentences.length).toFixed(1);
    document.getElementById('avgSentenceLength').textContent = avgLength;
    return avgLength;
}

function updatePunctuationStats(text) {
    const stats = {
        periods: text.split('').filter(char => char === '.').length,
        commas: (text.match(/,/g) || []).length,
        questions: (text.match(/\?/g) || []).length,
        exclamations: (text.match(/!/g) || []).length
    };
    
    document.getElementById('periodCount').textContent = stats.periods;
    document.getElementById('commaCount').textContent = stats.commas;
    document.getElementById('questionCount').textContent = stats.questions;
    document.getElementById('exclamationCount').textContent = stats.exclamations;
    
    return stats;
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        updateWordCount,
        updateCharCount,
        updateParagraphCount,
        updateAverageWordLength,
        updateAverageSentenceLength,
        updatePunctuationStats,
        getSampleText
    };
}
