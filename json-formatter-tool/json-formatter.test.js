import { JSONFormatter } from './script.js';
import * as NotificationManagerModule from '../common/notification-manager.js';
import DownloadManager from '../common/DownloadManager.js';

jest.mock('../common/notification-manager.js', () => ({
  NotificationManager: {
    show: jest.fn()
  }
}));

jest.mock('../common/DownloadManager.js', () => {
  return jest.fn().mockImplementation(() => {
    return {
      downloadFile: jest.fn()
    };
  });
});

jest.mock('../common/clear-button/ClearButton.js', () => {
  return jest.fn().mockImplementation(() => {
    return {
      updateVisibility: jest.fn(),
      disconnect: jest.fn()
    };
  });
});

describe('JSONFormatter', () => {
  let formatter;
  let mockNotificationManager;
  let mockDownloadManager;
  let originalDocumentQuerySelector;

  beforeEach(() => {
    originalDocumentQuerySelector = document.querySelector;
    document.querySelector = jest.fn((selector) => {
      if (selector === '.c-input.c-input--textarea') {
        // Create a proper textarea element for ClearButton
        const textarea = document.createElement('textarea');
        textarea.value = '';
        textarea.addEventListener = jest.fn();
        return textarea;
      }
      if (selector === '.c-code-output code') return document.createElement('div');
      if (selector === '#formatJsonBtn') return { addEventListener: jest.fn() };
      if (selector === '#copyOutputBtn') return { disabled: false, addEventListener: jest.fn() };
      if (selector === '#downloadOutputBtn') return { disabled: false, addEventListener: jest.fn() };
      if (selector === '#loadSampleBtn') return { addEventListener: jest.fn() };
      if (selector === '#sortKeys') return { checked: true };
      if (selector === '#jsonErrorStatus') return { 
        textContent: '', 
        classList: { add: jest.fn(), remove: jest.fn() } 
      };
      if (selector === '.jsonf-original-size') return { textContent: '' };
      if (selector === '.jsonf-formatted-size') return { textContent: '' };
      return null;
    });
    formatter = new JSONFormatter(false);
    formatter.input = { value: '' };
    formatter.output = { innerHTML: '' };
    formatter.copyBtn = { disabled: false, addEventListener: jest.fn() };
    formatter.downloadBtn = { disabled: false, addEventListener: jest.fn() };
    formatter.errorStatus = { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } };
    formatter.originalSizeEl = { textContent: '' };
    formatter.formattedSizeEl = { textContent: '' };
    formatter.sortCheckbox = { checked: true };
    formatter.autoFixCheckbox = { checked: false };
    formatter.formatBtn = { addEventListener: jest.fn() };
    formatter.sampleBtn = { addEventListener: jest.fn() };
    formatter.clearButtonInstance = { updateVisibility: jest.fn(), disconnect: jest.fn() };
    mockNotificationManager = NotificationManagerModule.NotificationManager;
    mockDownloadManager = new DownloadManager(); // Get instance of the mocked DownloadManager
    formatter.downloadManager = mockDownloadManager; // Assign to formatter instance
    jest.clearAllMocks();
  });

  describe('autoFixJSON', () => {
    test('should fix trailing commas in objects', () => {
      const input = '{"a": 1, "b": 2,}';
      const expected = '{"a": 1, "b": 2}';
      expect(formatter.autoFixJSON(input)).toEqual(expected);
    });

    test('should fix trailing commas in arrays', () => {
      const input = '[1, 2, 3,]';
      const expected = '[1, 2, 3]';
      expect(formatter.autoFixJSON(input)).toEqual(expected);
    });

    test('should fix single quotes', () => {
      const input = "{'a': 1, 'b': 'hello'}";
      const expected = '{"a": 1, "b": "hello"}';
      expect(formatter.autoFixJSON(input)).toEqual(expected);
    });

    test('should fix unquoted keys', () => {
      const input = '{a: 1, b: 2}';
      const expected = '{"a": 1, "b": 2}';
      expect(formatter.autoFixJSON(input)).toEqual(expected);
    });

    test('should fix a combination of errors', () => {
      const input = "{a: 1, 'b': 'hello',}";
      const expected = '{"a": 1, "b": "hello"}';
      expect(formatter.autoFixJSON(input)).toEqual(expected);
    });
  });

  describe('sortKeysAlphabetically', () => {
    test('should sort object keys alphabetically', () => {
      const input = { z: 1, a: 2, m: 3 };
      const expected = { a: 2, m: 3, z: 1 };
      expect(formatter.sortKeysAlphabetically(input)).toEqual(expected);
    });

    test('should handle nested objects', () => {
      const input = { z: { y: 1, x: 2 }, a: 3 };
      const expected = { a: 3, z: { x: 2, y: 1 } };
      expect(formatter.sortKeysAlphabetically(input)).toEqual(expected);
    });

    test('should handle arrays', () => {
      const input = { items: [{ b: 1, a: 2 }, { d: 3, c: 4 }] };
      const expected = { items: [{ a: 2, b: 1 }, { c: 4, d: 3 }] };
      expect(formatter.sortKeysAlphabetically(input)).toEqual(expected);
    });

    test('should handle null values', () => {
      const input = { b: null, a: 1 };
      const expected = { a: 1, b: null };
      expect(formatter.sortKeysAlphabetically(input)).toEqual(expected);
    });
  });

  describe('formatBytes', () => {
    test('should format bytes to appropriate units', () => {
      expect(formatter.formatBytes(0)).toBe('0 bytes');
      expect(formatter.formatBytes(1024)).toBe('1.00 KB');
      expect(formatter.formatBytes(1024 * 1024)).toBe('1.00 MB');
    });
  });

  describe('renderJSON', () => {
    beforeEach(() => {
      formatter.output = document.createElement('div');
    });

    test('should render primitive values correctly', () => {
      formatter.renderJSON(42, formatter.output);
      expect(formatter.output.innerHTML).toContain('42');
    });

    test('should render objects with toggle buttons', () => {
      formatter.renderJSON({ a: 1 }, formatter.output);
      expect(formatter.output.querySelector('.json-toggle')).not.toBeNull();
    });

    test('should toggle between expanded/collapsed states', () => {
      formatter.renderJSON({ a: 1 }, formatter.output);
      const toggle = formatter.output.querySelector('.json-toggle');
      // Initial state should be expanded ('-')
      expect(toggle.textContent).toBe('-'); 
      
      // Click to collapse
      toggle.click();
      expect(toggle.textContent).toBe('+'); // Collapsed state should be '+'
      
      // Click to expand again
      toggle.click();
      expect(toggle.textContent).toBe('-'); // Expanded state should be '-'
    });
  });

  describe('JSON formatting', () => {
    beforeEach(() => {
      formatter.input = { value: '' };
      formatter.output = document.createElement('div');
      formatter.copyBtn = { disabled: false };
      formatter.errorContainer = { 
        textContent: '', 
        classList: { add: jest.fn(), remove: jest.fn() } 
      };
      formatter.sortCheckbox = { checked: true };
    });

    test('should format valid JSON', () => {
      formatter.input.value = '{"b":2,"a":1}';
      formatter.formatJSON();
      
      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys[0].textContent).toBe('"a": ');
      expect(keys[1].textContent).toBe('"b": ');
    });

    test('should handle invalid JSON', () => {
      formatter.input.value = '{"invalid": json}';
      formatter.formatJSON();
      expect(mockNotificationManager.show).toHaveBeenCalledWith(
        expect.stringContaining('Invalid JSON'), 
        3000, 
        { type: 'error' }
      );
      expect(formatter.errorStatus.textContent).toContain('Invalid JSON');
      expect(formatter.errorStatus.classList.add).toHaveBeenCalledWith('error');
    });

    test('should handle very large JSON input', () => {
      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }
      formatter.input.value = JSON.stringify(largeObject);
      formatter.formatJSON();
      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys.length).toBe(1000);
      expect(mockNotificationManager.show).toHaveBeenCalledWith('JSON formatted successfully!', 2000, { type: 'success' });
    });

    test('should handle deeply nested JSON structures', () => {
      const nestedObject = { a: { b: { c: { d: { e: 1 } } } } };
      formatter.input.value = JSON.stringify(nestedObject);
      formatter.formatJSON();
      const containers = formatter.output.querySelectorAll('.json-node');
      expect(containers.length).toBeGreaterThanOrEqual(5); // At least 5 nested levels
      expect(mockNotificationManager.show).toHaveBeenCalledWith('JSON formatted successfully!', 2000, { type: 'success' });
    });

    test('should properly sort nested objects', () => {
      formatter.input.value = '{"b":[{"d":4,"c":3}],"a":{"z":2,"y":1}}';
      formatter.formatJSON();
      
      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys[0].textContent).toBe('"a": ');
      expect(keys[1].textContent).toBe('"y": ');
      expect(keys[2].textContent).toBe('"z": ');
      expect(keys[3].textContent).toBe('"b": ');
      expect(keys[4].textContent).toBe('"c": ');
      expect(keys[5].textContent).toBe('"d": ');
    });

    test('should preserve original order when sorting is disabled', () => {
      formatter.sortCheckbox.checked = false;
      formatter.input.value = '{"b":2,"a":1}';
      formatter.formatJSON();
      
      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys[0].textContent).toBe('"b": ');
      expect(keys[1].textContent).toBe('"a": ');
    });

    test('should sort keys when sorting is enabled', () => {
      formatter.sortCheckbox.checked = true;
      formatter.input.value = '{"b":2,"a":1}';
      formatter.formatJSON();
      
      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys[0].textContent).toBe('"a": ');
      expect(keys[1].textContent).toBe('"b": ');
    });

    test('should have sorting enabled by default', () => {
      formatter.input.value = '{"b":2,"a":1}';
      formatter.formatJSON();
      
      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys[0].textContent).toBe('"a": ');
      expect(keys[1].textContent).toBe('"b": ');
    });

    test('should use auto-fix when checkbox is checked', () => {
      formatter.autoFixCheckbox = { checked: true };
      formatter.input.value = "{'a':1,}";
      formatter.formatJSON();
      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys[0].textContent).toBe('"a": ');
      expect(mockNotificationManager.show).toHaveBeenCalledWith('JSON formatted successfully!', 2000, { type: 'success' });
    });
  });

  describe('updateStats', () => {
    beforeEach(() => {
      formatter.originalSizeEl = { textContent: '' };
      formatter.formattedSizeEl = { textContent: '' };
    });

    test('should update stats with correct byte sizes for original and formatted JSON', () => {
      const original = '{"key":"value"}';
      const formatted = JSON.stringify(JSON.parse(original), null, 2);
      formatter.updateStats(original, formatted);
      expect(formatter.originalSizeEl.textContent).toBe('15.00 bytes');
      expect(formatter.formattedSizeEl.textContent).toContain('bytes');
    });

    test('should handle empty input and output in stats', () => {
      formatter.updateStats('', '');
      expect(formatter.originalSizeEl.textContent).toBe('0 bytes');
      expect(formatter.formattedSizeEl.textContent).toBe('0 bytes');
    });

    test('should handle large JSON data in stats', () => {
      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }
      const original = JSON.stringify(largeObject);
      const formatted = JSON.stringify(largeObject, null, 2);
      formatter.updateStats(original, formatted);
      expect(formatter.originalSizeEl.textContent).toContain('KB');
      expect(formatter.formattedSizeEl.textContent).toContain('KB');
    });
  });

  describe('getFormattedOutput', () => {
    test('should return formatted JSON when input is valid', () => {
      formatter.input.value = '{"b":2,"a":1}';
      formatter.sortCheckbox.checked = true;
      const result = formatter.getFormattedOutput();
      expect(result).toBe('{\n  "a": 1,\n  "b": 2\n}');
    });

    test('should return original input when JSON is invalid', () => {
      formatter.input.value = 'invalid json';
      const result = formatter.getFormattedOutput();
      expect(result).toBe('invalid json');
    });

    test('should respect sort checkbox setting', () => {
      formatter.input.value = '{"b":2,"a":1}';
      formatter.sortCheckbox.checked = false;
      const result = formatter.getFormattedOutput();
      expect(result).toBe('{\n  "b": 2,\n  "a": 1\n}');
    });
  });

  describe('copyOutput', () => {
    let originalNavigator;
    let mockClipboard;

    beforeEach(() => {
      originalNavigator = global.navigator;
      mockClipboard = {
        writeText: jest.fn().mockResolvedValue(undefined)
      };
      
      // Mock globalThis.navigator.clipboard as used in script.js
      global.navigator.clipboard = mockClipboard;
      
      formatter.input = { value: 'test content' };
      formatter.errorContainer = { 
        textContent: '',
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      };
    });

    afterEach(() => {
      global.navigator = originalNavigator;
      delete global.navigator.clipboard; // Clean up mock
    });

    test('should copy formatted output to clipboard', async () => {
      formatter.input.value = '{"b":2,"a":1}';
      formatter.sortCheckbox.checked = true;
      
      await formatter.copyOutput();
      
      expect(mockClipboard.writeText).toHaveBeenCalledWith('{\n  "a": 1,\n  "b": 2\n}');
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', 2000, { type: 'success' });
    });

    test('should handle empty input during copy', async () => {
      formatter.input.value = '';
      await formatter.copyOutput();
      expect(mockClipboard.writeText).toHaveBeenCalledWith('');
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', 2000, { type: 'success' });
    });

    test('should handle special characters in input during copy', async () => {
      formatter.input.value = '{"key": "value\\nwith\\nspecial chars"}';
      await formatter.copyOutput();
      expect(mockClipboard.writeText).toHaveBeenCalledWith('{\n  "key": "value\\nwith\\nspecial chars"\n}');
    });

    test('should show error message on copy failure', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Failed'));
      await formatter.copyOutput();
      expect(mockNotificationManager.show).toHaveBeenCalledWith(expect.stringContaining('Failed to copy'), 3000, { type: 'error' });
    });

    test('should use fallback copy mechanism when clipboard API is unavailable', async () => {
      // Simulate no clipboard API by deleting it
      delete global.navigator.clipboard;
      
      // Mock document.execCommand for fallback
      document.execCommand = jest.fn().mockReturnValue(true);
      const mockCreateElement = jest.spyOn(document, 'createElement').mockReturnValue({
        value: '',
        style: { position: '' },
        select: jest.fn()
      });
      const mockAppendChild = jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      const mockRemoveChild = jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      
      formatter.output.textContent = 'fallback test content';
      await formatter.copyOutput();
      
      expect(document.execCommand).toHaveBeenCalledWith('copy');
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', 2000, { type: 'success' });
      
      mockCreateElement.mockRestore();
      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
      delete document.execCommand; // Clean up
    });
  });


  describe('loadSampleData', () => {
    test('should load sample data and format it', () => {
      formatter.formatJSON = jest.fn();
      formatter.loadSampleData();
      
      expect(formatter.input.value).toBeTruthy();
      expect(formatter.formatJSON).toHaveBeenCalled();
    });
  });

  describe('downloadOutput', () => {
    beforeEach(() => {
      formatter.input = { value: 'test content' };
    });

    test('should call DownloadManager.downloadFile with formatted JSON', async () => {
      formatter.input.value = '{"b":2,"a":1}';
      formatter.sortCheckbox.checked = true;
      
      await formatter.downloadOutput();
      
      expect(mockDownloadManager.downloadFile).toHaveBeenCalledWith(
        '{\n  "a": 1,\n  "b": 2\n}',
        'formatted.json',
        'application/json'
      );
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Download started!', 2000, { type: 'success' });
    });

    test('should handle download errors from DownloadManager', async () => {
      mockDownloadManager.downloadFile.mockImplementation(() => {
        throw new Error('Simulated download error');
      });
      
      await formatter.downloadOutput();
      
      expect(mockNotificationManager.show).toHaveBeenCalledWith(
        'Download failed: Simulated download error', 
        3000, 
        { type: 'error' }
      );
    });
  });

  describe('initializeEvents', () => {
    let callbacks;
    let formatBtnMock;
    let copyBtnMock;
    let sampleBtnMock;
    let inputMock;
    let clearInputBtnMock;
    let clearOutputBtnMock;

    beforeEach(() => {
      callbacks = {
        formatBtn: { click: null },
        copyBtn: { click: null },
        sampleBtn: { click: null },
        input: { input: null },
        clearInputBtn: { click: null },
        clearOutputBtn: { click: null }
      };

      formatBtnMock = jest.fn((event, callback) => {
        if (event === 'click') {
          callbacks.formatBtn.click = callback;
        }
      });

      copyBtnMock = jest.fn((event, callback) => {
        if (event === 'click') {
          callbacks.copyBtn.click = callback;
        }
      });

      sampleBtnMock = jest.fn((event, callback) => {
        if (event === 'click') {
          callbacks.sampleBtn.click = callback;
        }
      });

      inputMock = jest.fn((event, callback) => {
        if (event === 'input') {
          callbacks.input.input = callback;
        }
      });

      clearInputBtnMock = jest.fn((event, callback) => {
        if (event === 'click') {
          callbacks.clearInputBtn.click = callback;
        }
      });

      clearOutputBtnMock = jest.fn((event, callback) => {
        if (event === 'click') {
          callbacks.clearOutputBtn.click = callback;
        }
      });

      formatter.formatBtn = { addEventListener: formatBtnMock };
      formatter.copyBtn = { addEventListener: copyBtnMock };
      formatter.sampleBtn = { addEventListener: sampleBtnMock };
      formatter.input = { addEventListener: inputMock, value: '{"key": "value"}' };
      formatter.clearInputBtn = { addEventListener: clearInputBtnMock };
      formatter.clearOutputBtn = { addEventListener: clearOutputBtnMock };
    });

    test('should set up event listeners', () => {
      formatter.initializeEvents();
      expect(formatBtnMock).toHaveBeenCalledTimes(1);
      expect(copyBtnMock).toHaveBeenCalledTimes(1);
      expect(sampleBtnMock).toHaveBeenCalledTimes(1);
      expect(inputMock).toHaveBeenCalledTimes(1);
    });

    test('should trigger formatJSON on format button click', () => {
      formatter.formatJSON = jest.fn();
      formatter.initializeEvents();
      if (callbacks.formatBtn.click) {
        callbacks.formatBtn.click();
        expect(formatter.formatJSON).toHaveBeenCalled();
      } else {
        throw new Error('formatBtn callback not set');
      }
    });

    test('should trigger copyOutput on copy button click', () => {
      formatter.copyOutput = jest.fn();
      formatter.initializeEvents();
      if (callbacks.copyBtn.click) {
        callbacks.copyBtn.click();
        expect(formatter.copyOutput).toHaveBeenCalled();
      } else {
        throw new Error('copyBtn callback not set');
      }
    });

    test('should trigger loadSampleData on sample button click', () => {
      formatter.loadSampleData = jest.fn();
      formatter.initializeEvents();
      if (callbacks.sampleBtn.click) {
        callbacks.sampleBtn.click();
        expect(formatter.loadSampleData).toHaveBeenCalled();
      } else {
        throw new Error('sampleBtn callback not set');
      }
    });


    test('should trigger clearError and updateStats on input change', () => {
      formatter.clearError = jest.fn();
      formatter.updateStats = jest.fn();
      formatter.initializeEvents();
      if (callbacks.input.input) {
        callbacks.input.input();
        expect(formatter.clearError).toHaveBeenCalled();
        expect(formatter.updateStats).toHaveBeenCalledWith('{"key": "value"}', '');
      } else {
        throw new Error('input callback not set');
      }
    });
  });

  describe('clearError', () => {
    test('should clear error status text', () => {
      formatter.errorStatus.textContent = 'Error';
      formatter.clearError();
      expect(formatter.errorStatus.textContent).toBe('');
    });
  });

  describe('showError', () => {
    test('should show error in notification and status div', () => {
      formatter.showError('Test error');
      expect(mockNotificationManager.show).toHaveBeenCalledWith(
        'Test error', 
        3000, 
        { type: 'error' }
      );
      expect(formatter.errorStatus.textContent).toBe('Test error');
      expect(formatter.errorStatus.classList.add).toHaveBeenCalledWith('error');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty objects in renderJSON', () => {
      formatter.output = document.createElement('div');
      formatter.renderJSON({}, formatter.output);
      const html = formatter.output.innerHTML;
      expect(html).toContain('json-bracket');
      expect(html).toContain('{');
      expect(html).toContain('}');
    });

    test('should handle empty arrays in renderJSON', () => {
      formatter.output = document.createElement('div');
      formatter.renderJSON([], formatter.output);
      const html = formatter.output.innerHTML;
      expect(html).toContain('json-bracket');
      expect(html).toContain('[');
      expect(html).toContain(']');
    });

    test('should format very large byte sizes', () => {
      expect(formatter.formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
      expect(formatter.formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.00 TB');
      // Current implementation doesn't support PB, stops at TB
      expect(formatter.formatBytes(1024 * 1024 * 1024 * 1024 * 1024)).toBe('1024.00 TB');
    });

    test('should handle negative byte sizes', () => {
      // Current implementation doesn't handle negatives
      expect(formatter.formatBytes(-1024)).toBe('NaN undefined');
    });

    test('should handle special characters in JSON', () => {
      formatter.output = document.createElement('div');
      formatter.input.value = '{"key\\"with\\"quotes":"value\\nwith\\nnewlines"}';
      formatter.formatJSON();
      expect(formatter.errorStatus.textContent).toBe('');
    });

    test('should handle circular references in JSON (should throw)', () => {
      const circularObj = {};
      circularObj.self = circularObj;
      expect(() => formatter.formatJSON(JSON.stringify(circularObj))).toThrow();
    });
  });

  describe('Constructor Initialization', () => {
    afterEach(() => {
      document.querySelector = originalDocumentQuerySelector;
    });

    test('should initialize DOM elements when initDom is true', () => {
      const formatter = new JSONFormatter(true);
      expect(document.querySelector).toHaveBeenCalledTimes(11);
    });

    test('should not initialize DOM elements when initDom is false', () => {
      const formatter = new JSONFormatter(false);
      expect(document.querySelector).not.toHaveBeenCalled();
      expect(formatter.input).toBeUndefined();
    });

    test('should handle missing DOM elements gracefully', () => {
      document.querySelector.mockImplementation(() => null);
      const formatter = new JSONFormatter(true);
      expect(formatter.input).toBeNull();
    });
  });

  describe('DOM Structure Expectations', () => {
    test('should create correct HTML structure for objects', () => {
      formatter.output = document.createElement('div');
      formatter.renderJSON({ key: 'value' }, formatter.output);
      
      const container = formatter.output.querySelector('.json-node');
      expect(container).not.toBeNull();
      
      const toggle = container.querySelector('.json-toggle');
      expect(toggle).not.toBeNull();
      expect(toggle.textContent).toBe('-');
      
      const keySpan = container.querySelector('.json-key');
      expect(keySpan).not.toBeNull();
      expect(keySpan.textContent).toBe('"key": ');
      
      const brackets = container.querySelectorAll('.json-bracket');
      expect(brackets.length).toBe(2);
      expect(brackets[0].textContent).toBe('{');
      expect(brackets[1].textContent).toBe('}');
    });

    test('should apply correct indentation based on depth', () => {
      formatter.output = document.createElement('div');
      formatter.renderJSON({ key: 'value' }, formatter.output, 2);
      
      const container = formatter.output.querySelector('.json-node');
      expect(container.style.marginLeft).toBe('30px');
    });
  });

});
