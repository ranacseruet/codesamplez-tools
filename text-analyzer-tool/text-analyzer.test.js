// Mock DOM environment
const mockElements = {};
const elementIds = [
    'wordCount',
    'charCount',
    'paragraphCount',
    'avgWordLength',
    'avgSentenceLength',
    'periodCount',
    'commaCount',
    'questionCount',
    'exclamationCount'
];

// Initialize mock elements
elementIds.forEach(id => {
    mockElements[id] = { textContent: '' };
});


global.document = {
    getElementById: (id) => mockElements[id] || null
};

describe('Text Analyzer Tests', () => {
    // Import functions for testing
    const functions = require('./script.js');

    beforeEach(() => {
        // Reset all mock elements before each test
        elementIds.forEach(id => {
            mockElements[id].textContent = '';
        });
        
        // Update document.getElementById to return our mock elements
        global.document.getElementById = (id) => mockElements[id];
    });

    describe('Word Count', () => {
        test('empty string should have 0 words', () => {
            const text = '';
            const count = functions.updateWordCount(text);
            expect(count).toBe(0);
        });

        test('string with multiple spaces should count words correctly', () => {
            const text = 'The   quick  brown    fox';
            const result = functions.updateWordCount(text);
            expect(result).toBe(4);
        });

        test('string with newlines should count words correctly', () => {
            const text = 'The quick\nbrown fox';
            const result = functions.updateWordCount(text);
            expect(result).toBe(4);
        });
    });

    describe('Character Count', () => {
        test('empty string should have 0 characters', () => {
            const text = '';
            const result = functions.updateCharCount(text);
            expect(result).toBe(0);
        });

        test('string with spaces and special characters should count all characters', () => {
            const text = 'Hello, World!';
            const count = functions.updateCharCount(text);
            expect(count).toBe(13); // Including the comma and exclamation mark
        });
    });

    describe('Paragraph Count', () => {
        test('empty string should have 0 paragraphs', () => {
            const text = '';
            const result = functions.updateParagraphCount(text);
            expect(result).toBe(0);
        });

        test('single line should count as 1 paragraph', () => {
            const text = 'Hello world';
            const result = functions.updateParagraphCount(text);
            expect(result).toBe(1);
        });

        test('multiple paragraphs separated by double newline should count correctly', () => {
            const text = 'First paragraph\n\nSecond paragraph\n\nThird paragraph';
            const result = functions.updateParagraphCount(text);
            expect(result).toBe(3);
        });
    });

    describe('Average Word Length', () => {
        test('empty string should have 0 average word length', () => {
            const text = '';
            const result = functions.updateAverageWordLength(text);
            expect(result).toBe('0');
        });

        test('should calculate average word length correctly excluding punctuation', () => {
            const text = 'The quick brown fox!';
            const avgLength = functions.updateAverageWordLength(text);
            expect(parseFloat(avgLength)).toBe(4.0);
        });
    });

    describe('Average Sentence Length', () => {
        test('empty string should have 0 average sentence length', () => {
            const text = '';
            const result = functions.updateAverageSentenceLength(text);
            expect(result).toBe('0');
        });

        test('should calculate average sentence length correctly', () => {
            const text = 'This is one. This is two! How about three?';
            const avgLength = functions.updateAverageSentenceLength(text);
            expect(parseFloat(avgLength)).toBeCloseTo(3.0, 1);
        });
    });

    describe('Punctuation Stats', () => {
        test('empty string should have 0 for all punctuation counts', () => {
            const text = '';
            const stats = functions.updatePunctuationStats(text);
            expect(stats).toEqual({
                periods: 0,
                commas: 0,
                questions: 0,
                exclamations: 0
            });
        });

        test('should count all punctuation marks correctly', () => {
            const text = 'Hello, world! How are you? This is great.... Wait, really!';
            const stats = functions.updatePunctuationStats(text);
            expect(stats).toEqual({
                periods: 4, // Including the ellipsis
                commas: 2,
                questions: 1,
                exclamations: 2
            });
        });
    });

    describe('Sample Text', () => {
        test('getSampleText should return non-empty string', () => {
            const text = functions.getSampleText();
            expect(typeof text).toBe('string');
            expect(text.length).toBeGreaterThan(0);
        });
    });
});
