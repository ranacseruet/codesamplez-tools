import { computeDiff } from './script.js';

describe('Diff Checker', () => {
  test('should return empty array for identical texts', () => {
    const text1 = 'Hello world';
    const text2 = 'Hello world';
    expect(computeDiff(text1.split('\n'), text2.split('\n'))).toEqual([
      ['unchanged', 'Hello world']
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

  test('should handle whitespace differences when ignoreWhitespace is true', () => {
    const text1 = 'Hello   world';
    const text2 = 'Hello world';
    expect(computeDiff(text1.split('\n'), text2.split('\n'), true)).toEqual([
      ['unchanged', 'Hello   world']
    ]);
  });
});
