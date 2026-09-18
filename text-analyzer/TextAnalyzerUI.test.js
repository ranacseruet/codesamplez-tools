import { TextAnalyzerUI } from './TextAnalyzerUI';
import { analyzeText } from './TextAnalyzer';
import { NotificationManager } from '../common/notification-manager';

// Mock TextAnalyzer module
jest.mock('./TextAnalyzer', () => {
  return {
    analyzeText: jest.fn().mockImplementation((text) => ({
      charCount: text.length,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      lineCount: text.split(/\n/).length,
      sentenceCount: text.split(/[.!?]+/).filter(Boolean).length,
      paragraphCount: text.split(/\n\n/).filter(Boolean).length,
      avgWordLength: '0.00',
      avgSentenceLength: '0.00',
      periodCount: (text.match(/\./g) || []).length,
      commaCount: (text.match(/,/g) || []).length,
      questionCount: (text.match(/\?/g) || []).length,
      exclamationCount: (text.match(/!/g) || []).length,
      wordFrequency: [
        { word: 'hello', count: 3 },
        { word: 'world', count: 2 },
        { word: 'test', count: 1 }
      ]
    })),
    __esModule: true
  };
});

// Mock NotificationManager
jest.mock('../common/notification-manager', () => {
  return {
    NotificationManager: {
      show: jest.fn()
    }
  };
});

const { analyzeText: mockAnalyzeText } = require('./TextAnalyzer');

describe('TextAnalyzerUI', () => {
  let textAnalyzerUI;

  beforeEach(async () => {
    jest.clearAllMocks();
    const { TextAnalyzerUI } = await import('./TextAnalyzerUI');
    
    // Create DOM elements first
    document.body.innerHTML = `
      <textarea id="textInput" aria-label="Input text to analyze"></textarea>
      <button id="clear-input"></button>
      <button id="load-sample"></button>
      <div id="notification" class="c-notification"></div>
      <div id="charCount"></div>
      <div id="wordCount"></div>
      <div id="lineCount"></div>
      <div id="sentenceCount"></div>
      <div id="paragraphCount"></div>
      <div id="avgWordLength"></div>
      <div id="avgSentenceLength"></div>
      <div id="periodCount"></div>
      <div id="commaCount"></div>
      <div id="questionCount"></div>
      <div id="exclamationCount"></div>
      <div id="wordFrequencyChart"></div>
    `;
    
    // Then create instance
    textAnalyzerUI = new TextAnalyzerUI();
  });

  test('should initialize with all DOM elements', () => {
    expect(textAnalyzerUI.textInput).toBe(document.getElementById('textInput'));
    expect(textAnalyzerUI.loadSampleButton).toBe(document.getElementById('load-sample'));
    
    // Verify count elements
    expect(textAnalyzerUI.elements.charCount).toBe(document.getElementById('charCount'));
    expect(textAnalyzerUI.elements.wordCount).toBe(document.getElementById('wordCount'));
  });

  test('textarea should have accessible label', () => {
    expect(textAnalyzerUI.textInput.getAttribute('aria-label')).toBe('Input text to analyze');
  });

  describe('NotificationManager integration', () => {test('should call NotificationManager.show when clearing text', () => {
      const textArea = document.getElementById('textInput');
      textArea.dispatchEvent(new Event('textCleared')); // Trigger clear input event
      
      expect(NotificationManager.show).toHaveBeenCalledWith(
        "Text cleared", 
        3000, 
        {type: 'success'}
      );
    });
    test('should call NotificationManager.show when loading sample text', () => {
      const loadSampleButton = document.getElementById('load-sample');
      loadSampleButton.click();
      
      expect(NotificationManager.show).toHaveBeenCalledWith(
        "Sample text loaded", 
        3000, 
        {type: 'success'}
      );
    });
  });

  describe('updateCounts', () => {
    test('should update all count elements', () => {
      const textInput = document.getElementById('textInput');
      textInput.value = 'Test text';

      textAnalyzerUI.updateCounts();

      expect(mockAnalyzeText).toHaveBeenCalledWith('Test text');
      const countElements = [
        'charCount', 'wordCount', 'lineCount', 'sentenceCount', 'paragraphCount',
        'avgWordLength', 'avgSentenceLength', 'periodCount', 'commaCount',
        'questionCount', 'exclamationCount'
      ];

      countElements.forEach(id => {
        const el = document.getElementById(id);
        expect(el.textContent).toBeDefined();
      });
    });
  });

  describe('Word Frequency Chart', () => {
    test('should initialize with word frequency chart element', () => {
      expect(textAnalyzerUI.wordFrequencyChart).toBe(document.getElementById('wordFrequencyChart'));
    });

    test('should clear existing chart content when updating', () => {
      const chart = document.getElementById('wordFrequencyChart');
      chart.innerHTML = '<div>existing content</div>';

      textAnalyzerUI.updateCounts();

      expect(chart.innerHTML).not.toContain('existing content');
    });

    test('should display word frequency bars for valid data', () => {
      const chart = document.getElementById('wordFrequencyChart');

      textAnalyzerUI.updateCounts();

      // Check that bars are created
      const bars = chart.querySelectorAll('.word-frequency-bar');
      expect(bars.length).toBeGreaterThan(0);

      // Check that word frequency items are created
      const items = chart.querySelectorAll('.word-frequency-item');
      expect(items.length).toBeGreaterThan(0);

      // Check that each item has label and count
      items.forEach(item => {
        const label = item.querySelector('.word-frequency-label');
        const count = item.querySelector('.word-frequency-count');
        expect(label).toBeTruthy();
        expect(count).toBeTruthy();
        expect(label.textContent).toMatch(/\w+/);
        expect(count.textContent).toMatch(/\d+/);
      });
    });

    test('should handle empty word frequency data', () => {
      // Mock empty word frequency
      mockAnalyzeText.mockReturnValueOnce({
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
        exclamationCount: 0,
        wordFrequency: []
      });

      const chart = document.getElementById('wordFrequencyChart');

      textAnalyzerUI.updateCounts();

      // Should display empty message
      expect(chart.textContent).toContain('No words to analyze');
    });

    test('should handle null word frequency data', () => {
      // Mock null word frequency
      mockAnalyzeText.mockReturnValueOnce({
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
        exclamationCount: 0,
        wordFrequency: null
      });

      const chart = document.getElementById('wordFrequencyChart');

      textAnalyzerUI.updateCounts();

      // Should display empty message
      expect(chart.textContent).toContain('No words to analyze');
    });

    test('should scale bars based on maximum count', () => {
      const chart = document.getElementById('wordFrequencyChart');

      textAnalyzerUI.updateCounts();

      const bars = chart.querySelectorAll('.word-frequency-bar');
      const maxBar = Array.from(bars).reduce((max, bar) => {
        const width = parseFloat(bar.style.width);
        return width > (max || 0) ? width : max;
      }, 0);

      // The bar with the highest count should have 100% width
      expect(maxBar).toBe(100);
    });

    test('should display word and count correctly', () => {
      const chart = document.getElementById('wordFrequencyChart');

      textAnalyzerUI.updateCounts();

      const items = chart.querySelectorAll('.word-frequency-item');
      expect(items.length).toBe(3); // Based on our mock data

      // Check that we have the expected words and counts
      const labels = Array.from(items).map(item => item.querySelector('.word-frequency-label').textContent);
      const counts = Array.from(items).map(item => item.querySelector('.word-frequency-count').textContent);

      expect(labels).toContain('hello');
      expect(labels).toContain('world');
      expect(labels).toContain('test');

      // The count text now includes "occurrences"
      expect(counts).toContain('3 occurrences');
      expect(counts).toContain('2 occurrences');
      expect(counts).toContain('1 occurrences');
    });

    test('should have accessible attributes', () => {
      const chart = document.getElementById('wordFrequencyChart');
      // Set roles manually as they would be in the real HTML or added by JS if we did that
      chart.setAttribute('role', 'list');

      textAnalyzerUI.updateCounts();

      const items = chart.querySelectorAll('.word-frequency-item');
      items.forEach(item => {
        expect(item.getAttribute('role')).toBe('listitem');

        const barContainer = item.querySelector('.word-frequency-bar-container');
        expect(barContainer.getAttribute('aria-hidden')).toBe('true');

        const countSpan = item.querySelector('.word-frequency-count');
        expect(countSpan.classList.contains('sr-only')).toBe(true);
      });
    });
  });

});
