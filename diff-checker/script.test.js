// Import diff function
const { diff } = require('./script.js');

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
    }
  };
}

// Tests
describe('Diff Checker Tests', () => {
  test('identical texts should return same content without highlights', () => {
    const text1 = 'Hello World';
    const text2 = 'Hello World';
    const { original, modified } = diff(text1, text2);
    
    expect(original).toContain('Hello World');
    expect(modified).toContain('Hello World');
    expect(original).not.toContain('<ins>');
    expect(original).not.toContain('<del>');
    expect(modified).not.toContain('<ins>');
    expect(modified).not.toContain('<del>');
  });

  test('should highlight word-level differences', () => {
    const text1 = 'The quick brown fox';
    const text2 = 'The quick blue fox';
    const { original, modified } = diff(text1, text2);
    
    expect(original).toContain('<del>brown</del>');
    expect(modified).toContain('<ins>blue</ins>');
  });

  test('should handle multi-line text', () => {
    const text1 = 'Line 1\nLine 2\nLine 3';
    const text2 = 'Line 1\nNew Line\nLine 3';
    const { original, modified } = diff(text1, text2);
    
    expect(original).toContain('Line 1');
    expect(original).toContain('<del>Line 2</del>');
    expect(original).toContain('Line 3');
    expect(modified).toContain('Line 1');
    expect(modified).toContain('<ins>New Line</ins>');
    expect(modified).toContain('Line 3');
  });

  test('should handle empty lines', () => {
    const text1 = 'Line 1\n\nLine 3';
    const text2 = 'Line 1\nLine 2\nLine 3';
    const { original, modified } = diff(text1, text2);
    
    expect(original).toContain('<span class="empty-line">&nbsp;</span>');
    expect(modified).toContain('<ins>Line 2</ins>');
  });

  test('should escape HTML characters', () => {
    const text1 = '<div>Hello & World</div>';
    const text2 = '<span>Hello & Earth</span>';
    const { original, modified } = diff(text1, text2);
    
    expect(original).toContain('&lt;div&gt;');
    expect(original).toContain('&amp;');
    expect(modified).toContain('&lt;span&gt;');
  });

  test('should handle trailing spaces', () => {
    const text1 = 'Hello  ';
    const text2 = 'Hello';
    const { original, modified } = diff(text1, text2);
    
    expect(original).toContain('·');
    expect(modified).not.toContain('·');
  });

  test('should show line numbers', () => {
    const text1 = 'Line 1\nLine 2';
    const text2 = 'Line 1\nLine 2';
    const { original, modified } = diff(text1, text2);
    
    expect(original).toMatch(/<span class="line-num">1<\/span>/);
    expect(original).toMatch(/<span class="line-num">2<\/span>/);
    expect(modified).toMatch(/<span class="line-num">1<\/span>/);
    expect(modified).toMatch(/<span class="line-num">2<\/span>/);
  });

  test('should handle similar but not identical phrases', () => {
    const text1 = 'Testing functionality';
    const text2 = 'Testing functionalities';
    const { original, modified } = diff(text1, text2);
    
    expect(original).toContain('<span class="mod">functionality</span>');
    expect(modified).toContain('<span class="mod">functionalities</span>');
  });
});
