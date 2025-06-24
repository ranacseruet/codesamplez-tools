// Mock Web Worker before any imports
global.Worker = jest.fn().mockImplementation(function() {
    this.onmessage = null;
    this.onerror = null;
    this.postMessage = jest.fn((data) => {
        if (this.onmessage) {
            // Mock the worker response with analysis results
            const result = {
                success: true,
                data: {
                    charCount: data.length,
                    wordCount: data.trim() ? data.trim().split(/\s+/).length : 0,
                    lineCount: data ? data.split('\n').length : 0,
                    sentenceCount: data.trim() ? (data.match(/[.!?]+/g) || []).length : 0,
                    paragraphCount: data.trim() ? data.split(/\n\s*\n/).filter(p => p.trim()).length : 0,
                    avgWordLength: '0.00',
                    avgSentenceLength: '0.00',
                    periodCount: (data.match(/\./g) || []).length,
                    commaCount: (data.match(/,/g) || []).length,
                    questionCount: (data.match(/\?/g) || []).length,
                    exclamationCount: (data.match(/!/g) || []).length
                }
            };
            // Simulate async worker response
            setTimeout(() => {
                this.onmessage({ data: result });
            }, 0);
        }
    });
    return this;
});

// Use Jest's fake timers for async operations
jest.useFakeTimers();

import TextAnalyzerUI from './TextAnalyzerUI.js';

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
      <button id="analyze-button"></button>
      <div id="loading-indicator" style="display: none;"></div>
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

// Mock NotificationManager
jest.mock('../common/notification-manager.js', () => {
  return {
    NotificationManager: {
      show: jest.fn()
    }
  };
});

const { NotificationManager } = require('../common/notification-manager.js');

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
      <button id="analyze-button"></button>
      <div id="loading-indicator" style="display: none;"></div>
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
    expect(textAnalyzerUI.loadingIndicator).toBe(document.getElementById('loading-indicator'));
    
    // Verify count elements
    expect(textAnalyzerUI.elements.charCount).toBe(document.getElementById('charCount'));
    expect(textAnalyzerUI.elements.wordCount).toBe(document.getElementById('wordCount'));
  });

  test('should initialize Web Worker', () => {
    expect(global.Worker).toHaveBeenCalledWith('./text-analyzer.worker.js');
    expect(textAnalyzerUI.worker).toBeDefined();
  });

  describe('NotificationManager integration', () => {
    test('should call NotificationManager.show when clearing text', () => {
      const clearButton = document.getElementById('clear-input');
      clearButton.click();
      
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

    test('should call NotificationManager.show when analyzing text', () => {
      const analyzeButton = document.getElementById('analyze-button');
      analyzeButton.click();
      
      expect(NotificationManager.show).toHaveBeenCalledWith(
        "Analysis triggered", 
        3000, 
        {type: 'success'}
      );
    });
  });

  describe('updateCounts', () => {
    test('should send text to worker for analysis', () => {
      const textInput = document.getElementById('textInput');
      textInput.value = 'Test text';
      
      textAnalyzerUI.updateCounts();
      
      expect(textAnalyzerUI.worker.postMessage).toHaveBeenCalledWith('Test text');
    });

    test('should show loading indicator during analysis', () => {
      const textInput = document.getElementById('textInput');
      const loadingIndicator = document.getElementById('loading-indicator');
      textInput.value = 'Test text';
      
      textAnalyzerUI.updateCounts();
      
      expect(loadingIndicator.style.display).toBe('block');
    });

    test('should update UI elements when worker responds', async () => {
      const textInput = document.getElementById('textInput');
      textInput.value = 'Test text';
      
      textAnalyzerUI.updateCounts();
      
      // Wait for worker response
      await jest.runAllTimersAsync();
      
      // Check that UI elements are updated
      expect(document.getElementById('charCount').textContent).toBe('9');
      expect(document.getElementById('wordCount').textContent).toBe('2');
    });

    test('should use cache for repeated analysis of same text', async () => {
      const textInput = document.getElementById('textInput');
      textInput.value = 'Test text';
      
      // First analysis
      textAnalyzerUI.updateCounts();
      expect(textAnalyzerUI.worker.postMessage).toHaveBeenCalledTimes(1);
      
      // Wait for the worker response to populate cache
      await jest.runAllTimersAsync();
      
      // Reset the mock call count
      textAnalyzerUI.worker.postMessage.mockClear();
      
      // Second analysis with same text should use cache
      textAnalyzerUI.updateCounts();
      expect(textAnalyzerUI.worker.postMessage).toHaveBeenCalledTimes(0); // Should not call worker again
    });

    test('should show error notification when worker is not initialized', () => {
      // Simulate worker not being initialized
      textAnalyzerUI.worker = null;
      
      const textInput = document.getElementById('textInput');
      textInput.value = 'Test text';
      
      textAnalyzerUI.updateCounts();
      
      expect(NotificationManager.show).toHaveBeenCalledWith(
        "Analysis unavailable - Web Worker not initialized. Please use a modern browser.",
        5000,
        {type: 'error'}
      );
    });
  });

  describe('error handling', () => {
    test('should handle worker errors gracefully', () => {
      // Simulate worker error
      textAnalyzerUI.worker.onerror(new Error('Worker error'));
      
      expect(NotificationManager.show).toHaveBeenCalledWith(
        "Worker error occurred - analysis failed",
        5000,
        {type: 'error'}
      );
    });

    test('should handle analysis errors from worker', async () => {
      // Mock worker to return error response
      textAnalyzerUI.worker.postMessage = jest.fn((data) => {
        if (textAnalyzerUI.worker.onmessage) {
          const errorResponse = {
            success: false,
            error: 'Analysis failed'
          };
          setTimeout(() => {
            textAnalyzerUI.worker.onmessage({ data: errorResponse });
          }, 0);
        }
      });

      const textInput = document.getElementById('textInput');
      textInput.value = 'Test text';
      
      textAnalyzerUI.updateCounts();
      await jest.runAllTimersAsync();
      
      expect(NotificationManager.show).toHaveBeenCalledWith(
        "Analysis error: Analysis failed",
        5000,
        {type: 'error'}
      );
    });

    test('should handle worker initialization failure', () => {
      // Mock Worker to throw error during initialization
      global.Worker = jest.fn().mockImplementation(() => {
        throw new Error('Worker initialization failed');
      });

      // Reinitialize to simulate failure
      textAnalyzerUI = new TextAnalyzerUI();

      expect(NotificationManager.show).toHaveBeenCalledWith(
        "Worker initialization failed - this tool requires a modern browser with Web Worker support",
        5000,
        {type: 'error'}
      );
      expect(textAnalyzerUI.worker).toBeNull();
    });

    test('should handle environment where Web Workers are not supported', () => {
      // Mock environment where Web Workers are not supported
      global.Worker = undefined;

      // Spy on console.error to verify error logging
      jest.spyOn(console, 'error').mockImplementation(() => {});

      // Reinitialize to simulate unsupported environment
      textAnalyzerUI = new TextAnalyzerUI();

      expect(console.error).toHaveBeenCalledWith('Web Workers not supported in this environment');
      expect(NotificationManager.show).toHaveBeenCalledWith(
        "Web Workers not supported - this tool requires a modern browser",
        5000,
        {type: 'error'}
      );
      expect(textAnalyzerUI.worker).toBeNull();

      // Restore console.error mock
      console.error.mockRestore();
    });
  });
});
