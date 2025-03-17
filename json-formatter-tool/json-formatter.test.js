import { JSONFormatter } from './script.js';

describe('JSONFormatter', () => {
  let formatter;

  beforeEach(() => {
    // Create instance without DOM initialization
    formatter = new JSONFormatter(false);
    // Mock DOM elements
    formatter.input = { value: '' };
    formatter.output = { innerHTML: '' };
    formatter.copyBtn = { disabled: false };
    formatter.errorContainer = { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } };
    formatter.originalSizeEl = { textContent: '' };
    formatter.formattedSizeEl = { textContent: '' };
  });

  describe('sortKeysAlphabetically', () => {
    test('should sort object keys alphabetically', () => {
      const input = {
        z: 1,
        a: 2,
        m: 3
      };
      const expected = {
        a: 2,
        m: 3,
        z: 1
      };
      expect(formatter.sortKeysAlphabetically(input)).toEqual(expected);
    });

    test('should handle nested objects', () => {
      const input = {
        z: {
          y: 1,
          x: 2
        },
        a: 3
      };
      const expected = {
        a: 3,
        z: {
          x: 2,
          y: 1
        }
      };
      expect(formatter.sortKeysAlphabetically(input)).toEqual(expected);
    });

    test('should handle arrays', () => {
      const input = {
        items: [
          { b: 1, a: 2 },
          { d: 3, c: 4 }
        ]
      };
      const expected = {
        items: [
          { a: 2, b: 1 },
          { c: 4, d: 3 }
        ]
      };
      expect(formatter.sortKeysAlphabetically(input)).toEqual(expected);
    });

    test('should handle null values', () => {
      const input = {
        b: null,
        a: 1
      };
      const expected = {
        a: 1,
        b: null
      };
      expect(formatter.sortKeysAlphabetically(input)).toEqual(expected);
    });

    test('should preserve non-object values', () => {
      const input = {
        string: "test",
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3]
      };
      const expected = {
        array: [1, 2, 3],
        boolean: true,
        null: null,
        number: 42,
        string: "test"
      };
      expect(formatter.sortKeysAlphabetically(input)).toEqual(expected);
    });
  });

  describe('formatBytes', () => {
    test('should format bytes to appropriate units', () => {
      expect(formatter.formatBytes(0)).toBe('0 bytes');
      expect(formatter.formatBytes(500)).toBe('500.00 bytes');
      expect(formatter.formatBytes(1024)).toBe('1.00 KB');
      expect(formatter.formatBytes(1024 * 1024)).toBe('1.00 MB');
      expect(formatter.formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
    });

    test('should handle decimal values', () => {
      expect(formatter.formatBytes(1536)).toBe('1.50 KB');
      expect(formatter.formatBytes(1.5 * 1024 * 1024)).toBe('1.50 MB');
    });

    test('should handle large numbers', () => {
      const largeNumber = 2.5 * 1024 * 1024 * 1024; // 2.5 GB
      expect(formatter.formatBytes(largeNumber)).toBe('2.50 GB');
    });
  });

  describe('JSON formatting', () => {
    beforeEach(() => {
      formatter.input = { value: '' };
      formatter.output = { innerHTML: '' };
      formatter.copyBtn = { disabled: false };
      formatter.errorContainer = { 
        textContent: '', 
        classList: { add: jest.fn(), remove: jest.fn() } 
      };
      // Mock Prism global object that would be available in browser
      global.Prism = {
        highlight: jest.fn().mockReturnValue('highlighted-json'),
        languages: { json: {} }
      };
    });

    test('should format and sort valid JSON', () => {
      const input = '{"b":2,"a":1}';
      formatter.input.value = input;
      
      formatter.formatJSON();
      
      expect(Prism.highlight).toHaveBeenCalledWith(
        JSON.stringify({ a: 1, b: 2 }, null, 2),
        Prism.languages.json,
        'json'
      );
      expect(formatter.copyBtn.disabled).toBe(false);
      expect(formatter.errorContainer.textContent).toBe('');
    });

    test('should handle invalid JSON', () => {
      const input = '{"invalid": json}';
      formatter.input.value = input;
      
      formatter.formatJSON();
      
      expect(formatter.copyBtn.disabled).toBe(true);
      expect(formatter.errorContainer.textContent).toContain('Invalid JSON');
    });

    test('should properly sort nested objects and arrays', () => {
      const input = '{"b":[{"d":4,"c":3}],"a":{"z":2,"y":1}}';
      formatter.input.value = input;
      
      formatter.formatJSON();
      
      const expectedObj = {
        a: {
          y: 1,
          z: 2
        },
        b: [
          {
            c: 3,
            d: 4
          }
        ]
      };
      
      expect(Prism.highlight).toHaveBeenCalledWith(
        JSON.stringify(expectedObj, null, 2),
        Prism.languages.json,
        'json'
      );
    });
  });
});
