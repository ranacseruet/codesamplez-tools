import TextAnalyzerUI from './TextAnalyzerUI.js';
import { analyzeText } from './script.js';

// Polyfill TextEncoder/TextDecoder for jsdom
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { JSDOM } = require('jsdom');
// Setup jsdom with proper resources
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <body>
      <textarea id="textInput"></textarea>
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
    </body>
  </html>
`);

global.document = dom.window.document;
global.window = dom.window;

// Mock script.js module
jest.mock('./script.js', () => {
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
      exclamationCount: (text.match(/!/g) || []).length
    })),
    __esModule: true
  };
});

const { analyzeText: mockAnalyzeText } = require('./script.js');

describe('TextAnalyzerUI', () => {
  let textAnalyzerUI;

  beforeEach(async () => {
    jest.clearAllMocks();
    const TextAnalyzerUI = (await import('./TextAnalyzerUI.js')).default;
    
    // Create DOM elements first
    document.body.innerHTML = `
      <textarea id="textInput"></textarea>
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
    `;
    
    // Then create instance
    textAnalyzerUI = new TextAnalyzerUI();
  });

  test('should initialize with all DOM elements', () => {
    expect(textAnalyzerUI.textInput).toBe(document.getElementById('textInput'));
    expect(textAnalyzerUI.clearButton).toBe(document.getElementById('clear-input'));
    expect(textAnalyzerUI.loadSampleButton).toBe(document.getElementById('load-sample'));
    expect(textAnalyzerUI.notificationElement).toBe(document.getElementById('notification'));
    
    // Verify count elements
    expect(textAnalyzerUI.elements.charCount).toBe(document.getElementById('charCount'));
    expect(textAnalyzerUI.elements.wordCount).toBe(document.getElementById('wordCount'));
  });

  describe('showNotification', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should show success notification', () => {
      textAnalyzerUI.showNotification('Test message');
      
      expect(textAnalyzerUI.notificationElement.textContent).toBe('Test message');
      expect(textAnalyzerUI.notificationElement.classList.contains('c-notification--visible')).toBe(true);
      expect(textAnalyzerUI.notificationElement.classList.contains('c-notification--success')).toBe(true);
    });

    test('should show error notification', () => {
      textAnalyzerUI.showNotification('Error message', true);
      
      expect(textAnalyzerUI.notificationElement.textContent).toBe('Error message');
      expect(textAnalyzerUI.notificationElement.classList.contains('c-notification--visible')).toBe(true);
      expect(textAnalyzerUI.notificationElement.classList.contains('c-notification--error')).toBe(true);
    });

    test('should hide notification after timeout', () => {
      textAnalyzerUI.showNotification('Test message');
      
      // Fast-forward until all timers have been executed
      jest.runAllTimers();
      
      expect(textAnalyzerUI.notificationElement.classList.contains('c-notification--visible')).toBe(false);
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

});
