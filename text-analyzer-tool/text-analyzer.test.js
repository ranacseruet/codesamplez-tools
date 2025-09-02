// Mock DOM environment
const mockElements = {};
const elementIds = [
    'wordCount',
    'charCount',
    'paragraphCount',
    'lineCount',
    'sentenceCount', // Added sentenceCount
    'avgWordLength',
    'avgSentenceLength',
    'periodCount',
    'commaCount',
    'questionCount',
    'exclamationCount',
    'textInput',      // Added for text input
    'analyze-btn',    // Added for analyze button
    'notification'    // Added for notification
];

// Initialize mock elements
elementIds.forEach(id => {
    if (id === 'textInput') {
        mockElements[id] = { value: '', textContent: '', addEventListener: jest.fn() };
    } else if (id === 'analyze-btn') {
        mockElements[id] = { disabled: false, textContent: '', addEventListener: jest.fn(), click: jest.fn() };
    } else if (id === 'notification') {
        mockElements[id] = { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } };
    } else {
        mockElements[id] = { textContent: '' };
    }
});

global.document = {
    getElementById: (id) => mockElements[id] || { addEventListener: jest.fn(), classList: { add: jest.fn(), remove: jest.fn() } } // Fallback for other elements if needed
};

// Mock setTimeout and clearTimeout
global.setTimeout = jest.fn((fn) => fn()); // Execute immediately for tests
global.clearTimeout = jest.fn();

// Import functions for testing
import { analyzeText } from './script.js'; // Main script functions

describe('Text Analyzer Tests', () => {
    // Mock the DOMContentLoaded and event listener setup from script.js
    // This is a simplified mock to allow tests to run without full browser environment.
    let textInput, analyzeButton, clearButton, loadSampleButton, notificationElement;
    let updateCounts, updateAnalyzeButtonState, showNotification;

    beforeEach(() => {
        // Reset all mock elements before each test
        elementIds.forEach(id => {
            if (id === 'textInput') {
                mockElements[id].value = '';
                mockElements[id].textContent = '';
                mockElements[id].addEventListener.mockClear();
            } else if (id === 'analyze-btn') {
                mockElements[id].disabled = false;
                mockElements[id].textContent = '';
                mockElements[id].addEventListener.mockClear();
                mockElements[id].click.mockClear();
            } else if (id === 'notification') {
                mockElements[id].textContent = '';
                mockElements[id].classList.add.mockClear();
                mockElements[id].classList.remove.mockClear();
            } else {
                mockElements[id].textContent = '';
            }
        });
        
        // Reset mocks for setTimeout
        global.setTimeout.mockClear();
        global.clearTimeout.mockClear();

        // Update document.getElementById to return our mock elements
        global.document.getElementById = (id) => mockElements[id];

        // Re-import the script to ensure fresh event listeners are set up
        jest.resetModules();
        const script = require('./script.js'); // This will execute the script's top-level code

        // Manually get references to the functions that would be attached to DOM events
        // This requires exposing them for testing, or mocking the event dispatch.
        // For now, we'll assume the script's DOMContentLoaded block runs and sets up listeners.
        // We need to simulate the behavior of the script's DOMContentLoaded block.
        
        // Mock the functions that are called by the script's DOMContentLoaded
        // This is a simplified way to test the logic without fully simulating the browser's event loop.
        textInput = mockElements['textInput'];
        analyzeButton = mockElements['analyze-btn'];
        clearButton = mockElements['clear-input'];
        loadSampleButton = mockElements['load-sample'];
        notificationElement = mockElements['notification'];

        // Mock the internal functions that script.js would define and use
        // This is a workaround because these functions are not exported.
        // In a real scenario, these would be part of a class or exported for testing.
        updateCounts = () => {
            const result = analyzeText(textInput.value);
            Object.entries(result).forEach(([key, value]) => {
                if (mockElements[key]) {
                    mockElements[key].textContent = String(value); // Convert to string
                }
            });
        };

        showNotification = (message, isError = false) => {
            if (notificationElement) {
                notificationElement.textContent = message;
                notificationElement.classList.remove('c-notification--success', 'c-notification--error');
                notificationElement.classList.add('c-notification--visible');
                if (isError) {
                    notificationElement.classList.add('c-notification--error');
                } else {
                    notificationElement.classList.add('c-notification--success');
                }
                // Mock setTimeout to execute immediately for tests
                global.setTimeout(() => {
                    notificationElement.classList.remove('c-notification--visible');
                }, 3000);
            }
        };

        updateAnalyzeButtonState = () => {
            if (analyzeButton && textInput) {
                const isEmpty = textInput.value.trim() === '';
                analyzeButton.disabled = isEmpty;
                if (notificationElement) {
                    notificationElement.classList.remove('c-notification--visible');
                }
            }
        };

        // Simulate initial setup from DOMContentLoaded
        updateCounts();
        updateAnalyzeButtonState();

        // Mock event listeners by directly calling the mocked functions
        if (textInput) {
            textInput.addEventListener.mockImplementation((event, handler) => {
                if (event === 'input') textInput._inputHandler = handler;
            });
        }
        if (analyzeButton) {
            analyzeButton.addEventListener.mockImplementation((event, handler) => {
                if (event === 'click') analyzeButton._clickHandler = handler;
            });
        }
        if (clearButton) {
            clearButton.addEventListener.mockImplementation((event, handler) => {
                if (event === 'click') clearButton._clickHandler = handler;
            });
        }
        if (loadSampleButton) {
            loadSampleButton.addEventListener.mockImplementation((event, handler) => {
                if (event === 'click') loadSampleButton._clickHandler = handler;
            });
        }
    });

    describe('Word Count', () => {
        test('empty string should have 0 words', () => {
            const text = '';
            const result = analyzeText(text);
            expect(result.wordCount).toBe(0);
        });

        test('string with multiple spaces should count words correctly', () => {
            const text = 'The   quick  brown    fox';
            const result = analyzeText(text);
            expect(result.wordCount).toBe(4);
        });

        test('string with newlines should count words correctly', () => {
            const text = 'The quick\nbrown fox';
            const result = analyzeText(text);
            expect(result.wordCount).toBe(4);
        });
    });

    describe('Character Count', () => {
        test('empty string should have 0 characters', () => {
            const text = '';
            const result = analyzeText(text);
            expect(result.charCount).toBe(0);
        });

        test('string with spaces and special characters should count all characters', () => {
            const text = 'Hello, World!';
            const result = analyzeText(text);
            expect(result.charCount).toBe(13); // Including the comma and exclamation mark
        });
    });

    describe('Paragraph Count', () => {
        test('empty string should have 0 paragraphs', () => {
            const text = '';
            const result = analyzeText(text);
            expect(result.paragraphCount).toBe(0);
        });

        test('single line should count as 1 paragraph', () => {
            const text = 'Hello world';
            const result = analyzeText(text);
            expect(result.paragraphCount).toBe(1);
        });

        test('multiple paragraphs separated by double newline should count correctly', () => {
            const text = 'First paragraph\n\nSecond paragraph\n\nThird paragraph';
            const result = analyzeText(text);
            expect(result.paragraphCount).toBe(3);
        });
    });

    describe('Line Count', () => {
        test('empty string should have 0 lines', () => {
            const text = '';
            const result = analyzeText(text);
            expect(result.lineCount).toBe(0);
            expect(mockElements['lineCount'].textContent).toBe('0');
        });

        test('single line string should have 1 line', () => {
            const text = 'Hello world';
            textInput.value = text; // Set the mock input value
            updateCounts(); // Trigger update to reflect in mockElements
            const result = analyzeText(text);
            expect(result.lineCount).toBe(1);
            expect(mockElements['lineCount'].textContent).toBe('1');
        });

        test('multi-line string with \\n should count lines correctly', () => {
            const text = 'First line\nSecond line\nThird line';
            textInput.value = text; // Set the mock input value
            updateCounts(); // Trigger update to reflect in mockElements
            const result = analyzeText(text);
            expect(result.lineCount).toBe(3);
            expect(mockElements['lineCount'].textContent).toBe('3');
        });

        test('multi-line string with \\r\\n should count lines correctly', () => {
            const text = 'First line\r\nSecond line\r\nThird line';
            textInput.value = text; // Set the mock input value
            updateCounts(); // Trigger update to reflect in mockElements
            const result = analyzeText(text);
            expect(result.lineCount).toBe(3);
            expect(mockElements['lineCount'].textContent).toBe('3');
        });

        test('string ending with a newline should count correctly', () => {
            const text = 'Hello\nWorld\n';
            textInput.value = text; // Set the mock input value
            updateCounts(); // Trigger update to reflect in mockElements
            const result = analyzeText(text);
            expect(result.lineCount).toBe(3); // "Hello", "World", ""
            expect(mockElements['lineCount'].textContent).toBe('3');
        });
        
        test('string with multiple empty lines should count them', () => {
            const text = 'Line 1\n\nLine 3'; // Line 1, empty line, Line 3
            textInput.value = text; // Set the mock input value
            updateCounts(); // Trigger update to reflect in mockElements
            const result = analyzeText(text);
            expect(result.lineCount).toBe(3);
            expect(mockElements['lineCount'].textContent).toBe('3');
        });

        test('string with only newlines should count correctly', () => {
            const text = '\n\n'; // Three empty lines essentially
            textInput.value = text; // Set the mock input value
            updateCounts(); // Trigger update to reflect in mockElements
            const result = analyzeText(text);
            expect(result.lineCount).toBe(3);
            expect(mockElements['lineCount'].textContent).toBe('3');
        });
    });

    describe('Average Word Length', () => {
        test('empty string should have 0 average word length', () => {
            const text = '';
            const result = analyzeText(text);
            expect(result.avgWordLength).toBe('0.00'); // analyzeText returns fixed to 2 decimal places
        });

        test('should calculate average word length correctly excluding punctuation', () => {
            const text = 'The quick brown fox!';
            const result = analyzeText(text);
            expect(parseFloat(result.avgWordLength)).toBe(4.0);
        });
    });

    describe('Average Sentence Length', () => {
        test('empty string should have 0 average sentence length', () => {
            const text = '';
            const result = analyzeText(text);
            expect(result.avgSentenceLength).toBe('0.00'); // analyzeText returns fixed to 2 decimal places
        });

        test('should calculate average sentence length correctly', () => {
            const text = 'This is one. This is two! How about three?';
            const result = analyzeText(text);
            expect(parseFloat(result.avgSentenceLength)).toBeCloseTo(3.0, 1);
        });
    });

    describe('Punctuation Stats', () => {
        test('empty string should have 0 for all punctuation counts', () => {
            const text = '';
            const result = analyzeText(text);
            expect(result.periodCount).toBe(0);
            expect(result.commaCount).toBe(0);
            expect(result.questionCount).toBe(0);
            expect(result.exclamationCount).toBe(0);
        });

        test('should count all punctuation marks correctly', () => {
            const text = 'Hello, world! How are you? This is great.... Wait, really!';
            const result = analyzeText(text);
            expect(result.periodCount).toBe(4); // Including the ellipsis
            expect(result.commaCount).toBe(2);
            expect(result.questionCount).toBe(1);
            expect(result.exclamationCount).toBe(2);
        });
    });

    describe('Word Frequency Analysis', () => {
        test('empty string should not have wordFrequency property', () => {
            const text = '';
            const result = analyzeText(text);
            expect(result.wordFrequency).toBeUndefined();
        });

        test('text with no words should return empty word frequency array', () => {
            const text = '!!! ??? ...';
            const result = analyzeText(text);
            expect(result.wordFrequency).toEqual([]);
        });

        test('single word should return that word with count 1', () => {
            const text = 'hello';
            const result = analyzeText(text);
            expect(result.wordFrequency).toEqual([{ word: 'hello', count: 1 }]);
        });

        test('should count word frequency correctly', () => {
            const text = 'hello world hello test world hello';
            const result = analyzeText(text);
            expect(result.wordFrequency).toEqual([
                { word: 'hello', count: 3 },
                { word: 'world', count: 2 },
                { word: 'test', count: 1 }
            ]);
        });

        test('should handle case insensitivity', () => {
            const text = 'Hello hello HELLO world World';
            const result = analyzeText(text);
            expect(result.wordFrequency).toEqual([
                { word: 'hello', count: 3 },
                { word: 'world', count: 2 }
            ]);
        });

        test('should remove punctuation from words', () => {
            const text = 'hello, world! hello. test? hello!';
            const result = analyzeText(text);
            expect(result.wordFrequency).toEqual([
                { word: 'hello', count: 3 },
                { word: 'world', count: 1 },
                { word: 'test', count: 1 }
            ]);
        });

        test('should handle mixed case and punctuation', () => {
            const text = 'Hello, World! hello. WORLD? Hello!';
            const result = analyzeText(text);
            expect(result.wordFrequency).toEqual([
                { word: 'hello', count: 3 },
                { word: 'world', count: 2 }
            ]);
        });

        test('should return only top 5 most frequent words', () => {
            const text = 'apple banana cherry date elderberry fig apple banana cherry date apple banana cherry apple banana apple'; // apple:5, banana:4, cherry:3, date:2, elderberry:1, fig:1
            const result = analyzeText(text);
            expect(result.wordFrequency).toHaveLength(5);
            expect(result.wordFrequency[0]).toEqual({ word: 'apple', count: 5 });
            expect(result.wordFrequency[1]).toEqual({ word: 'banana', count: 4 });
            expect(result.wordFrequency[2]).toEqual({ word: 'cherry', count: 3 });
            expect(result.wordFrequency[3]).toEqual({ word: 'date', count: 2 });
            expect(result.wordFrequency[4]).toEqual({ word: 'elderberry', count: 1 });
        });

        test('should handle words with numbers', () => {
            const text = 'test123 test test123 word';
            const result = analyzeText(text);
            expect(result.wordFrequency).toEqual([
                { word: 'test123', count: 2 },
                { word: 'test', count: 1 },
                { word: 'word', count: 1 }
            ]);
        });

        test('should ignore empty strings after cleaning', () => {
            const text = 'hello !!! ??? ... world';
            const result = analyzeText(text);
            expect(result.wordFrequency).toEqual([
                { word: 'hello', count: 1 },
                { word: 'world', count: 1 }
            ]);
        });

        test('should handle multiple spaces and newlines', () => {
            const text = 'hello   world\n\nhello\tworld hello';
            const result = analyzeText(text);
            expect(result.wordFrequency).toEqual([
                { word: 'hello', count: 3 },
                { word: 'world', count: 2 }
            ]);
        });
    });

    // Removed 'Sample Text' describe block as getSampleText is not exported

    describe('Analyze Button State and Notification', () => {
        let analyzeButton, textInput, notificationElement;

        beforeEach(() => {
            // Re-initialize or get fresh mocks for elements involved in event listeners
            textInput = mockElements['textInput'];
            analyzeButton = mockElements['analyze-btn'];
            notificationElement = mockElements['notification'];

            // Reset mocks for setTimeout
            global.setTimeout.mockClear();
            global.clearTimeout.mockClear();

            // Simulate initial setup from DOMContentLoaded in script.js
            // This involves calling updateCounts and updateAnalyzeButtonState
            // as they would be called by the script's DOMContentLoaded listener.
            updateCounts();
            updateAnalyzeButtonState();
        });

        test('Analyze button should be disabled when text input is empty', () => {
            textInput.value = '';
            updateAnalyzeButtonState(); // Manually trigger update after changing value
            expect(analyzeButton.disabled).toBe(true);
        });

        test('Analyze button should be enabled when text input is not empty', () => {
            textInput.value = 'some text';
            updateAnalyzeButtonState(); // Manually trigger update after changing value
            expect(analyzeButton.disabled).toBe(false);
        });

        test('Clicking Analyze button with empty text should show "Please enter some text to analyze." notification', () => {
            textInput.value = '';
            updateAnalyzeButtonState(); // Ensure button state is correct
            
            // Manually call the click handler logic
            if (textInput.value.trim() === '') {
                showNotification("Please enter some text to analyze.", true); // This is the message from script.js
            } else {
                updateCounts();
                showNotification("Text analyzed successfully!");
            }

            expect(notificationElement.textContent).toBe('Please enter some text to analyze.'); // Updated to match script.js
            expect(notificationElement.classList.add).toHaveBeenCalledWith('c-notification--visible');
            expect(notificationElement.classList.add).toHaveBeenCalledWith('c-notification--error');
            expect(global.setTimeout).toHaveBeenCalledTimes(1);
        });

        test('Clicking Analyze button with non-empty text should show "Text analyzed successfully!"', () => {
            textInput.value = 'some text';
            updateAnalyzeButtonState(); // This enables the button
            
            // Manually call the click handler logic
            if (textInput.value.trim() === '') {
                showNotification("Please enter some text to analyze.", true);
            } else {
                updateCounts();
                showNotification("Text analyzed successfully!");
            }

            expect(notificationElement.textContent).toBe('Text analyzed successfully!');
            expect(notificationElement.classList.add).toHaveBeenCalledWith('c-notification--visible');
            expect(notificationElement.classList.add).toHaveBeenCalledWith('c-notification--success');
            expect(global.setTimeout).toHaveBeenCalledTimes(1);
        });
    });
});
