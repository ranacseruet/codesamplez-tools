// text-analyzer.worker.js
// Self-contained Web Worker for text analysis

/**
 * Pure text analysis logic
 */
function analyzeText(text) {
    // Convert null/undefined to empty string and ensure we're working with a string
    text = String(text || '');

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

// Listen for messages from the main thread
self.onmessage = function(e) {
    try {
        console.log('Worker received message:', e.data);
        const text = e.data;
        
        // Analyze the text
        const result = analyzeText(text);
        
        // Send the result back to the main thread
        self.postMessage({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Worker: Error during text analysis:', error);
        // Send error back to main thread
        self.postMessage({
            success: false,
            error: error.message || 'Unknown error occurred during analysis'
        });
    }
};

// Handle worker errors
self.onerror = function(error) {
    console.error('Worker: Global error:', error);
    self.postMessage({
        success: false,
        error: 'Worker encountered a critical error'
    });
};
