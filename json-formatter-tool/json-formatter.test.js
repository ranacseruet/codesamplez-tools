import { JSONFormatter } from './script.js';

describe('JSONFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new JSONFormatter(false);
    formatter.input = { value: '' };
    formatter.output = { innerHTML: '' };
    formatter.copyBtn = { disabled: false };
    formatter.errorContainer = { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } };
    formatter.originalSizeEl = { textContent: '' };
    formatter.formattedSizeEl = { textContent: '' };
    formatter.sortCheckbox = { checked: true };
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
      expect(formatter.errorContainer.textContent).toContain('Invalid JSON');
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

  describe('copyOutput', () => {
    let originalNavigator;
    let mockClipboard;

    beforeEach(() => {
      originalNavigator = global.navigator;
      mockClipboard = {
        writeText: jest.fn().mockResolvedValue(undefined)
      };
      
      // Directly mock the clipboard on the formatter instance
      formatter.navigator = { clipboard: mockClipboard };
      
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
    });

    /*
    test('should copy output text to clipboard', async () => {
      // Ensure output has content
      formatter.output.textContent = 'test content';
      
      await formatter.copyOutput();
      
      // Verify clipboard was called with correct content
      expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('test content');
      expect(formatter.errorContainer.classList.add).not.toHaveBeenCalled();
    });
    */

    test('should show error message on copy failure', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Failed'));
      await formatter.copyOutput();
      expect(formatter.errorContainer.textContent).toContain('Failed to copy');
      expect(formatter.errorContainer.classList.add).toHaveBeenCalledWith('active');
    });
  });

  describe('showTemporaryMessage', () => {
    let originalBody;
    let mockTimers;

    beforeEach(() => {
      originalBody = document.body.innerHTML;
      document.body.innerHTML = ''; // Clear completely
      mockTimers = jest.useFakeTimers();
    });

    afterEach(() => {
      document.body.innerHTML = originalBody;
      mockTimers.clearAllTimers();
      mockTimers.useRealTimers();
    });

    test('should create and remove temporary message', () => {
      formatter.showTemporaryMessage('Test message');
      
      // Verify message was created with correct content
      const msg = document.querySelector('.jsonf-temp-message');
      expect(msg).not.toBeNull();
      expect(msg.textContent).toBe('Test message');
      
      // Verify message is removed after timeout
      mockTimers.advanceTimersByTime(2000);
      expect(document.querySelector('.jsonf-temp-message')).toBeNull();
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
    test('should set up event listeners', () => {
      const mockAddEventListener = jest.fn();
      formatter.formatBtn = { addEventListener: mockAddEventListener };
      formatter.copyBtn = { addEventListener: mockAddEventListener };
      formatter.sampleBtn = { addEventListener: mockAddEventListener };
      formatter.input = { addEventListener: mockAddEventListener };
      
      formatter.initializeEvents();
      expect(mockAddEventListener).toHaveBeenCalledTimes(4);
    });
  });

  describe('clearError', () => {
    test('should clear error state', () => {
      formatter.errorContainer.textContent = 'Error';
      formatter.errorContainer.classList.add('active');
      
      formatter.clearError();
      expect(formatter.errorContainer.textContent).toBe('');
      expect(formatter.errorContainer.classList.remove).toHaveBeenCalledWith('active');
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
