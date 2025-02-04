document.addEventListener('DOMContentLoaded', () => {
    const textInput = document.querySelector('.text-analyzer-input');
    
    // Update stats whenever text changes
    textInput.addEventListener('input', analyzeText);
});

function analyzeText() {
    const text = document.querySelector('.text-analyzer-input').value;
    
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
    document.querySelector('#wordCount.text-analyzer-stat-value').textContent = words.length;
}

function updateCharCount(text) {
    document.querySelector('#charCount.text-analyzer-stat-value').textContent = text.length;
}

function updateParagraphCount(text) {
    // Split on double newlines to count paragraphs
    const paragraphs = text.trim().split(/\n\s*\n/).filter(para => para.length > 0);
    document.querySelector('#paragraphCount.text-analyzer-stat-value').textContent = paragraphs.length;
}

function updateAverageWordLength(text) {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    if (words.length === 0) {
        document.querySelector('#avgWordLength.text-analyzer-stat-value').textContent = '0';
        return;
    }
    
    // Calculate total characters in words (excluding punctuation)
    const totalChars = words.reduce((sum, word) => {
        // Remove punctuation when counting word length
        return sum + word.replace(/[.,!?;:'"(){}[\]]/g, '').length;
    }, 0);
    
    const avgLength = (totalChars / words.length).toFixed(1);
    document.querySelector('#avgWordLength.text-analyzer-stat-value').textContent = avgLength;
}

function updateAverageSentenceLength(text) {
    // Split on sentence terminators
    const sentences = text.trim().split(/[.!?]+/).filter(sent => sent.trim().length > 0);
    if (sentences.length === 0) {
        document.querySelector('#avgSentenceLength.text-analyzer-stat-value').textContent = '0';
        return;
    }
    
    // Count words in each sentence
    const totalWords = sentences.reduce((sum, sentence) => {
        const words = sentence.trim().split(/\s+/).filter(word => word.length > 0);
        return sum + words.length;
    }, 0);
    
    const avgLength = (totalWords / sentences.length).toFixed(1);
    document.querySelector('#avgSentenceLength.text-analyzer-stat-value').textContent = avgLength;
}

function updatePunctuationStats(text) {
    const stats = {
        periods: (text.match(/\./g) || []).length,
        commas: (text.match(/,/g) || []).length,
        questions: (text.match(/\?/g) || []).length,
        exclamations: (text.match(/!/g) || []).length
    };
    
    document.querySelector('#periodCount.text-analyzer-stat-value').textContent = stats.periods;
    document.querySelector('#commaCount.text-analyzer-stat-value').textContent = stats.commas;
    document.querySelector('#questionCount.text-analyzer-stat-value').textContent = stats.questions;
    document.querySelector('#exclamationCount.text-analyzer-stat-value').textContent = stats.exclamations;
}
