// Import functions
const { diff, visualizeSpaces, escapeHtml } = require('./script.js');

// Simple test runner
function describe(name, testSuite) {
  console.group(name);
  testSuite();
  console.groupEnd();
}

function test(name, testFn) {
  try {
    testFn();
    console.log('✅', name);
  } catch (error) {
    console.error('❌', name);
    console.error(error);
  }
}

function expect(actual) {
  return {
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    not: {
      toContain: (expected) => {
        if (actual.includes(expected)) {
          throw new Error(`Expected "${actual}" to not contain "${expected}"`);
        }
      }
    },
    toMatch: (regex) => {
      if (!regex.test(actual)) {
        throw new Error(`Expected "${actual}" to match ${regex}`);
      }
    },
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected "${actual}" to be "${expected}"`);
      }
    }
  };
}

// Tests
describe('Diff Checker Tests', () => {
  test('identical texts should return same content without highlights', () => {
    const text1 = 'Hello World';
    const text2 = 'Hello World';
    const { original, modified } = diff(text1, text2, { showAllSpaces: false });
    
    const expectedPattern = /Hello World<span class="line-ending">¬<\/span>/;
    expect(original).toMatch(expectedPattern);
    expect(modified).toMatch(expectedPattern);
    expect(original).not.toContain('<ins>');
    expect(original).not.toContain('<del>');
    expect(modified).not.toContain('<ins>');
    expect(modified).not.toContain('<del>');
  });

  test('should highlight word-level differences', () => {
    const text1 = 'The quick brown fox';
    const text2 = 'The quick blue fox';
    const { original, modified } = diff(text1, text2, { showAllSpaces: false });
    
    const lines1 = original.split('\n');
    const lines2 = modified.split('\n');
    
    expect(lines1[0]).toMatch(/The·quick·<del>brown<\/del>·fox<span class="line-ending">¬<\/span>/);
    expect(lines2[0]).toMatch(/The·quick·<ins>blue<\/ins>·fox<span class="line-ending">¬<\/span>/);
  });

  test('should handle multi-line text', () => {
    const text1 = 'Line 1\nLine 2\nLine 3';
    const text2 = 'Line 1\nNew Line\nLine 3';
    const { original, modified } = diff(text1, text2, { showAllSpaces: false });
    
    const lines1 = original.split('\n');
    const lines2 = modified.split('\n');
    
    expect(lines1[0]).toContain('Line 1<span class="line-ending">¬</span>');
    expect(lines1[1]).toMatch(/(<del>Line 2<\/del>)<span class="line-ending">¬<\/span>/);
    expect(lines1[2]).toContain('Line 3<span class="line-ending">¬</span>');
    
    expect(lines2[0]).toContain('Line 1<span class="line-ending">¬</span>');
    expect(lines2[1]).toMatch(/(<ins>New Line<\/ins>)<span class="line-ending">¬<\/span>/);
    expect(lines2[2]).toContain('Line 3<span class="line-ending">¬</span>');
  });

  test('should handle empty lines', () => {
    const text1 = 'Line 1\n\nLine 3';
    const text2 = 'Line 1\nLine 2\nLine 3';
    const { original, modified } = diff(text1, text2, { showAllSpaces: false });
    
    const lines1 = original.split('\n');
    const lines2 = modified.split('\n');
    
    expect(lines1[1]).toContain('<span class="empty-line">&nbsp;</span>');
    expect(lines2[1]).toMatch(/<span class="line-num">2<\/span><ins>Line 2<span class="line-ending">¬<\/span><\/ins>/);
  });

  test('should escape HTML characters', () => {
    const text1 = '<div>Hello & World</div>';
    const text2 = '<span>Hello & Earth</span>';
    const { original, modified } = diff(text1, text2, { showAllSpaces: false });
    
    const lines1 = original.split('\n');
    expect(lines1[0]).toContain('&lt;');
    expect(lines1[0]).toContain('&gt;');
    expect(lines1[0]).toContain('&amp;');
  });

  test('should handle trailing spaces', () => {
    const text1 = 'Hello  ';
    const text2 = 'Hello';
    const { original, modified } = diff(text1, text2, { showAllSpaces: false });
    
    const lines1 = original.split('\n');
    const lines2 = modified.split('\n');
    
    expect(lines1[0]).toMatch(/<span class="line-num">1<\/span>Hello··<span class="line-ending">¬<\/span>/);
    expect(lines2[0]).toMatch(/<span class="line-num">1<\/span>Hello<span class="line-ending">¬<\/span>/);
  });

  test('should show line numbers', () => {
    const text1 = 'Line 1\nLine 2';
    const text2 = 'Line 1\nLine 2';
    const { original, modified } = diff(text1, text2, { showAllSpaces: false });
    
    expect(original).toMatch(/<span class="line-num">1<\/span>/);
    expect(original).toMatch(/<span class="line-num">2<\/span>/);
    expect(modified).toMatch(/<span class="line-num">1<\/span>/);
    expect(modified).toMatch(/<span class="line-num">2<\/span>/);
  });

  test('should handle similar but not identical phrases', () => {
    const text1 = 'Testing functionality';
    const text2 = 'Testing functionalities';
    const { original, modified } = diff(text1, text2, { showAllSpaces: false });
    
    const lines1 = original.split('\n');
    const lines2 = modified.split('\n');
    
    expect(lines1[0]).toMatch(/Testing·<span class="mod">functionality<\/span><span class="line-ending">¬<\/span>/);
    expect(lines2[0]).toMatch(/Testing·<span class="mod">functionalities<\/span><span class="line-ending">¬<\/span>/);
  });

  test('should visualize different types of whitespace', () => {
    const text = 'Hello\tWorld  !';
    const result = escapeHtml(text, { showAllSpaces: true, showTabs: true });
    
    expect(result).toContain('→');  // tab visualization
    expect(result).toContain('·');  // space visualization
  });

  test('should respect space visualization config', () => {
    const text = 'Hello  World';
    const resultWithSpaces = escapeHtml(text, { showAllSpaces: true });
    const resultWithoutSpaces = escapeHtml(text, { showAllSpaces: false });
    
    expect(resultWithSpaces).toContain('··');
    expect(resultWithoutSpaces).not.toContain('·');
  });

  test('should handle mixed whitespace comparison', () => {
    const text1 = 'Hello\tWorld';
    const text2 = 'Hello    World';
    const { original, modified } = diff(text1, text2, { showAllSpaces: true, showTabs: true });
    
    const lines1 = original.split('\n');
    const lines2 = modified.split('\n');
    
    expect(lines1[0]).toContain('Hello<del>→</del>World');
    expect(lines2[0]).toContain('Hello<ins>····</ins>World');
  });

  test('should handle consecutive spaces differently', () => {
    const text1 = 'Hello   World';  // 3 spaces
    const text2 = 'Hello  World';   // 2 spaces
    const { original, modified } = diff(text1, text2, { showAllSpaces: true });
    
    const lines1 = original.split('\n');
    const lines2 = modified.split('\n');
    
    expect(lines1[0]).toContain('Hello<del>···</del>World');
    expect(lines2[0]).toContain('Hello<ins>··</ins>World');
  });

  test('should preserve trailing spaces with visualization', () => {
    const text = 'Hello  ';  // Two trailing spaces
    const result = escapeHtml(text, { showAllSpaces: false });
    expect(result).toBe('Hello··');  // Both trailing spaces should be dots
  });

  test('should handle spaces based on configuration', () => {
    const text = 'Hello  World  ';  // Two spaces between words, two trailing
    const withSpaces = escapeHtml(text, { showAllSpaces: true });
    const withoutSpaces = escapeHtml(text, { showAllSpaces: false });
    
    expect(withSpaces).toBe('Hello··World··');  // All spaces as dots
    expect(withoutSpaces).toBe('Hello  World··');  // Only trailing as dots
  });
});
