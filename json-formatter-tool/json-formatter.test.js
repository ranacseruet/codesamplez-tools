import { JSONFormatter } from './script.js';
import * as NotificationManagerModule from '../common/notification-manager.js';

jest.mock('../common/notification-manager.js', () => ({
  NotificationManager: {
    show: jest.fn()
  }
}));

describe('JSONFormatter', () => {
  let formatter;
  let mockNotificationManager;

  beforeEach(() => {
    formatter = new JSONFormatter(false);
    formatter.input = { value: '' };
    formatter.output = { innerHTML: '' };
    formatter.copyBtn = { disabled: false };
    formatter.errorContainer = { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } };
    formatter.originalSizeEl = { textContent: '' };
    formatter.formattedSizeEl = { textContent: '' };
    formatter.sortCheckbox = { checked: true };
    mockNotificationManager = NotificationManagerModule.NotificationManager;
    jest.clearAllMocks();
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
      expect(mockNotificationManager.show).toHaveBeenCalledWith(expect.stringContaining('Invalid JSON'), 3000, { type: 'error' });
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
      
      formatter.output = document.createElement('div');
      formatter.output.textContent = 'test content';
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

    test('should copy output text to clipboard', async () => {
      // Set input value instead of output content
      formatter.input.value = 'test content';
      
      await formatter.copyOutput();
      
      // Verify clipboard was called with correct content
      expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('test content');
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', 2000, { type: 'success' });
    });

    test('should handle empty output during copy', async () => {
      formatter.input.value = '';
      await formatter.copyOutput();
      expect(mockClipboard.writeText).toHaveBeenCalledWith('');
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', 2000, { type: 'success' });
    });

    test('should handle special characters in output during copy', async () => {
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

  describe('NotificationManager.show', () => {
    test('should call NotificationManager.show with correct parameters for success messages', () => {
      formatter.clearInput();
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Input cleared!', 2000, { type: 'success' });
    });
  });

  describe('clearInput', () => {
    test('should clear input field and update stats', () => {
      formatter.input.value = '{"key": "value"}';
      formatter.clearInput();
      
      expect(formatter.input.value).toBe('');
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Input cleared!', 2000, { type: 'success' });
    });
  });

  describe('clearOutput', () => {
    test('should clear output field and disable copy button', () => {
      formatter.output.innerHTML = '<div>Formatted JSON</div>';
      formatter.copyBtn.disabled = false;
      formatter.clearOutput();
      
      expect(formatter.output.innerHTML).toBe('');
      expect(formatter.copyBtn.disabled).toBe(true);
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Output cleared!', 2000, { type: 'success' });
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
      expect(clearInputBtnMock).toHaveBeenCalledTimes(1);
      expect(clearOutputBtnMock).toHaveBeenCalledTimes(1);
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

    test('should trigger clearInput on clear input button click', () => {
      formatter.clearInput = jest.fn();
      formatter.initializeEvents();
      if (callbacks.clearInputBtn.click) {
        callbacks.clearInputBtn.click();
        expect(formatter.clearInput).toHaveBeenCalled();
      } else {
        throw new Error('clearInputBtn callback not set');
      }
    });

    test('should trigger clearOutput on clear output button click', () => {
      formatter.clearOutput = jest.fn();
      formatter.initializeEvents();
      if (callbacks.clearOutputBtn.click) {
        callbacks.clearOutputBtn.click();
        expect(formatter.clearOutput).toHaveBeenCalled();
      } else {
        throw new Error('clearOutputBtn callback not set');
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
    test('should do nothing as NotificationManager handles auto-dismissal', () => {
      formatter.errorContainer.textContent = 'Error';
      formatter.errorContainer.classList.add('active');
      
      formatter.clearError();
      // No expectations as the method is now a no-op
      expect(formatter.errorContainer.textContent).toBe('Error');
      expect(formatter.errorContainer.classList.remove).not.toHaveBeenCalled();
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
    });

    test('should handle special characters in JSON', () => {
      formatter.output = document.createElement('div');
      formatter.input.value = '{"key\\"with\\"quotes":"value\\nwith\\nnewlines"}';
      formatter.formatJSON();
      expect(formatter.errorContainer.textContent).toBe('');
    });
  });
});
