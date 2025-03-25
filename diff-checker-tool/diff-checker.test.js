import { computeDiff } from './script.js';

describe('Base Functionality', () => {
  test('empty inputs should return empty array', () => {
    const result = computeDiff([], []);
    expect(result).toEqual([]);
  });

  test('one empty input should mark all lines as added/removed', () => {
      const result1 = computeDiff([], ['line1', 'line2']);
      expect(result1).toEqual([
          ['added', 'line1'],
          ['added', 'line2']
      ]);

      const result2 = computeDiff(['line1', 'line2'], []);
      expect(result2).toEqual([
          ['removed', 'line1'],
          ['removed', 'line2']
      ]);
  });

  test('identical inputs should mark all lines as unchanged', () => {
    const lines = ['line1', 'line2', 'line3'];
    const result = computeDiff(lines, lines);
    expect(result).toEqual([
        ['unchanged', 'line1'],
        ['unchanged', 'line2'],
        ['unchanged', 'line3']
    ]);
  });

  test('should detect single line difference', () => {
    const text1 = 'Hello world';
    const text2 = 'Hello there';
    expect(computeDiff(text1.split('\n'), text2.split('\n'))).toEqual([
      ['removed', 'Hello world'],
      ['added', 'Hello there']
    ]);
  });

  test('should handle multi-line differences', () => {
    const text1 = `Line 1
Line 2
Line 3`;
    const text2 = `Line 1
Line 2 modified
Line 3`;
    expect(computeDiff(text1.split('\n'), text2.split('\n'))).toEqual([
      ['unchanged', 'Line 1'],
      ['removed', 'Line 2'],
      ['added', 'Line 2 modified'],
      ['unchanged', 'Line 3']
    ]);
  });

  test('completely different inputs should mark all lines as added/removed', () => {
      const result = computeDiff(
          ['old1', 'old2'],
          ['new1', 'new2']
      );
      expect(result).toEqual([
          ['removed', 'old1'],
          ['removed', 'old2'],
          ['added', 'new1'],
          ['added', 'new2'],
      ]);
  });
});

describe('Whitespace Handling', () => {
  test('should respect whitespace sensitivity setting', () => {
      // With whitespace ignored (default)
      const resultIgnored = computeDiff(
          ['  spaced  ', '\ttabbed\t', 'no-space'],
          ['spaced', 'tabbed', 'no-space'],
          true
      );
      expect(resultIgnored).toEqual([
          ['unchanged', '  spaced  '],
          ['unchanged', '\ttabbed\t'],
          ['unchanged', 'no-space']
      ]);

      // With whitespace sensitive
      const resultSensitive = computeDiff(
          ['  spaced  ', '\ttabbed\t', 'no-space'],
          ['spaced', 'tabbed', 'no-space'],
          false
      );
      expect(resultSensitive).toEqual([
          ['removed', '  spaced  '],
          ['removed', '\ttabbed\t'],
          ['added', 'spaced'],
          ['added', 'tabbed'],
          ['unchanged', 'no-space']
      ]);
  });

  test('should handle mixed whitespace with sensitivity', () => {
      const result = computeDiff(
          ['function() {', '  return true;', '}'],
          ['function(){', 'return true;', '}'],
          false
      );
      expect(result).toEqual([
          ['removed', 'function() {'],
          ['removed', '  return true;'],
          ['added', 'function(){'],
          ['added', 'return true;'],
          ['unchanged', '}'],
      ]);
  });

  test('should handle whitespace differences when ignoreWhitespace is true', () => {
    const text1 = 'Hello   world';
    const text2 = 'Hello world';
    expect(computeDiff(text1.split('\n'), text2.split('\n'), true)).toEqual([
      ['unchanged', 'Hello   world']
    ]);
  });
});

describe('Edge Cases', () => {
  test('should handle very long lines', () => {
      const longLine = 'a'.repeat(10000);
      const result = computeDiff([longLine], [longLine + 'b']);
      expect(result).toEqual([
          ['removed', longLine],
          ['added', longLine + 'b']
      ]);
  });

  test('should handle Unicode characters and emojis', () => {
      const result = computeDiff(
          ['Hello 👋', '🌍 Earth', 'Goodbye 👋'],
          ['Hello 👋', '🌎 World', 'Goodbye 👋']
      );
      expect(result).toEqual([
          ['unchanged', 'Hello 👋'],
          ['removed', '🌍 Earth'],
          ['added', '🌎 World'],
          ['unchanged', 'Goodbye 👋']
      ]);
  });

  test('should handle repeated lines', () => {
      const result = computeDiff(
          ['A', 'B', 'A', 'C'],
          ['A', 'D', 'A', 'C']
      );
      expect(result).toEqual([
          ['unchanged', 'A'],
          ['removed', 'B'],
          ['added', 'D'],
          ['unchanged', 'A'],
          ['unchanged', 'C']
      ]);
  });

  test('should handle HTML/XML content', () => {
      const result = computeDiff(
          ['<div>', '<p>Old text</p>', '</div>'],
          ['<div>', '<p>New text</p>', '</div>']
      );
      expect(result).toEqual([
          ['unchanged', '<div>'],
          ['removed', '<p>Old text</p>'],
          ['added', '<p>New text</p>'],
          ['unchanged', '</div>']
      ]);
  });

  test('should handle large inputs', () => {
      const oldLines = Array.from({ length: 1000 }, (_, i) => `line${i}`);
      const newLines = Array.from({ length: 1000 }, (_, i) => i % 2 === 0 ? `line${i}` : `modified${i}`);
      
      const result = computeDiff(oldLines, newLines);
      
      expect(result.length).toBe(1500); // 500 unchanged + 500 removed + 500 added
      expect(result.filter(([type]) => type === 'unchanged').length).toBe(500);
      expect(result.filter(([type]) => type === 'removed').length).toBe(500);
      expect(result.filter(([type]) => type === 'added').length).toBe(500);
  });

  test('should handle moved lines correctly', () => {
      const result = computeDiff(
          ['A', 'B', 'C'],
          ['C', 'B', 'A']
      );
      
      expect(result).toEqual([
          ['removed', 'A'],
          ['removed', 'B'],
          ['unchanged', 'C'],
          ['added', 'B'],
          ['added', 'A'],
      ]);
  });
});
