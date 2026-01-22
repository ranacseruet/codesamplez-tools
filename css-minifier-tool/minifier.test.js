import { minifyCSS, isValidCSS, shortenColorsInCss } from './minifier.js';

describe('CSS Minifier', () => {
  test('should remove whitespace and newlines', () => {
    const input = `
      .test {
        color: red;
      }
    `;
    const expected = '.test{color:red;}';
    expect(minifyCSS(input)).toBe(expected);
  });

  test('should remove comments', () => {
    const input = `
      /* Comment */
      .test {
        color: red; /* Inline comment */
      }
    `;
    const expected = '.test{color:red;}';
    expect(minifyCSS(input)).toBe(expected);
  });

  test('should preserve important syntax', () => {
    const input = `
      .test {
        color: red !important;
      }
    `;
    const expected = '.test{color:red!important;}';
    expect(minifyCSS(input)).toBe(expected);
  });

  test('should handle media queries', () => {
    const input = `
      @media (max-width: 600px) {
        .test {
          color: red;
        }
      }
    `;
    const expected = '@media (max-width:600px){.test{color:red;}}';
    expect(minifyCSS(input)).toBe(expected);
  });

  test('should throw error for invalid CSS', () => {
    const input = 'body { color: red';  // missing closing brace
    expect(() => minifyCSS(input)).toThrow('Invalid CSS input');
  });
});

describe('CSS Validator', () => {
  // Mock document.head.appendChild and document.head.removeChild
  // and styleElement.sheet.cssRules for DOM-based validation in JSDOM
  let mockStyleElement;
  let originalAppendChild;
  let originalRemoveChild;
  let originalCreateElement;

  beforeEach(() => {
    // Mock for JSDOM environment
    if (typeof document !== 'undefined') {
      mockStyleElement = {
        sheet: {
          cssRules: []
        },
        textContent: '',
        parentNode: null // Will be set to document.head by appendChild
      };
      originalAppendChild = document.head.appendChild;
      originalRemoveChild = document.head.removeChild;
      originalCreateElement = document.createElement;

      document.head.appendChild = jest.fn(el => {
        if (el === mockStyleElement) {
          mockStyleElement.parentNode = document.head;
        }
        return el; // Return the element itself
      });
      document.head.removeChild = jest.fn(el => {
        if (el === mockStyleElement) {
          mockStyleElement.parentNode = null;
        }
      });
      document.createElement = jest.fn(tagName => {
        if (tagName.toLowerCase() === 'style') {
          return mockStyleElement;
        }
        // Fallback to original for other elements if needed by other tests
        return originalCreateElement.call(document, tagName); 
      });
    }
  });

  afterEach(() => {
    if (typeof document !== 'undefined') {
      document.head.appendChild = originalAppendChild;
      document.head.removeChild = originalRemoveChild;
      document.createElement = originalCreateElement;
    }
  });

  test('should return true for valid CSS', () => {
    if (mockStyleElement) mockStyleElement.sheet.cssRules = [{ cssText: 'body { color: red; }' }];
    expect(isValidCSS('body { color: red; }')).toBe(true);
  });

  test('should return false for invalid CSS (e.g., unclosed brace)', () => {
    if (mockStyleElement) mockStyleElement.sheet.cssRules = [];
    expect(isValidCSS('body { color: red; ')).toBe(false);
  });

  test('should return false for CSS with only a selector but no declaration block', () => {
     if (mockStyleElement) mockStyleElement.sheet.cssRules = [];
    expect(isValidCSS('body ')).toBe(false);
  });
  
  test('should return false for CSS with a property but no value', () => {
    if (mockStyleElement) mockStyleElement.sheet.cssRules = [];
    expect(isValidCSS('body { color: }')).toBe(false);
  });

  test('should return true for empty string', () => {
    expect(isValidCSS('')).toBe(true);
  });

  test('should return true for CSS containing only comments', () => {
    expect(isValidCSS('/* this is a comment */')).toBe(true);
  });
  
  test('should return false for malformed comments', () => {
    if (mockStyleElement) mockStyleElement.sheet.cssRules = [];
    expect(isValidCSS('/* this is a malformed comment body {color: red;}')).toBe(false);
  });

  test('should handle CSS with multiple valid rules', () => {
    if (mockStyleElement) mockStyleElement.sheet.cssRules = [
      { cssText: 'p { font-size: 12px; }' },
      { cssText: 'a { text-decoration: none; }' }
    ];
    expect(isValidCSS('p { font-size: 12px; } a { text-decoration: none; }')).toBe(true);
  });

  test('should correctly identify valid CSS with leading/trailing whitespace', () => {
    if (mockStyleElement) mockStyleElement.sheet.cssRules = [{ cssText: 'div { border: 1px solid black; }'}];
    expect(isValidCSS('  div { border: 1px solid black; }  ')).toBe(true);
  });

  test('should handle @media queries', () => {
    // JSDOM's CSSOM might not fully parse media queries into distinct rules in styleElement.sheet.cssRules
    // but it should still consider it valid if the syntax is correct.
    // The current DOM-based isValidCSS might return true if no error is thrown and content exists.
    if (mockStyleElement) mockStyleElement.sheet.cssRules = [{ cssText: '@media (max-width: 600px) { body { color: red; } }'}];
    expect(isValidCSS('@media (max-width: 600px) { body { color: red; } }')).toBe(true);
  });

  test('should handle CSS variables', () => {
    // Similar to media queries, JSDOM might not populate cssRules for this but should not error on valid syntax.
    if (mockStyleElement) mockStyleElement.sheet.cssRules = [{ cssText: ':root { --primary-color: #fff; }'}];
    expect(isValidCSS(':root { --primary-color: #fff; } body { color: var(--primary-color); }')).toBe(true);
  });

  test('should return false if styleElement.sheet is null', () => {
    if (mockStyleElement) {
      mockStyleElement.sheet = null;
    }
    expect(isValidCSS('body { color: red; }')).toBe(false);
  });

  test('should return false if setting textContent throws an error', () => {
    if (mockStyleElement) {
      Object.defineProperty(mockStyleElement, 'textContent', {
        set: () => {
          throw new Error('Simulated error on setting textContent');
        },
        get: () => '', // Provide a getter to avoid issues if it's read
        configurable: true
      });
    }
    expect(isValidCSS('body { color: red; }')).toBe(false);
    // Restore original textContent behavior for other tests if necessary,
    // though beforeEach should reset mockStyleElement.
    if (mockStyleElement) {
       Object.defineProperty(mockStyleElement, 'textContent', {
        value: '',
        writable: true,
        configurable: true
      });
    }
  });
});

describe('shortenColorsInCss', () => {
  test('should shorten named colors', () => {
    const input = 'color: white; background: black;';
    const expected = 'color: #fff; background: #000;';
    expect(shortenColorsInCss(input)).toBe(expected);
  });

  test('should handle multiple colors', () => {
    const input = 'border: 1px solid red; outline: green;';
    const expected = 'border: 1px solid #f00; outline: #0f0;';
    expect(shortenColorsInCss(input)).toBe(expected);
  });

  test('should be case insensitive', () => {
    const input = 'color: WHITE; background: ReD;';
    const expected = 'color: #fff; background: #f00;';
    expect(shortenColorsInCss(input)).toBe(expected);
  });

  test('should not replace colors inside other words', () => {
    const input = 'color: whitesmoke; class: bred;';
    const expected = 'color: whitesmoke; class: bred;';
    expect(shortenColorsInCss(input)).toBe(expected);
  });

  test('should handle colors at boundaries', () => {
    const input = 'color: blue';
    const expected = 'color: #00f';
    expect(shortenColorsInCss(input)).toBe(expected);
  });

  test('should handle colors with closing brace', () => {
    const input = 'color: yellow}';
    const expected = 'color: #ff0}';
    expect(shortenColorsInCss(input)).toBe(expected);
  });

  test('should hex colors #RRGGBB to #RGB', () => {
    const input = 'color: #aabbcc;';
    const expected = 'color: #abc;';
    expect(shortenColorsInCss(input)).toBe(expected);
  });

  // Regression tests
  test('should handle consecutive colors correctly', () => {
    const input = 'border-color: red green;';
    const expected = 'border-color: #f00 #0f0;';
    expect(shortenColorsInCss(input)).toBe(expected);
  });

  test('should handle three consecutive colors', () => {
    const input = 'border-color: red green blue;';
    const expected = 'border-color: #f00 #0f0 #00f;';
    expect(shortenColorsInCss(input)).toBe(expected);
  });

  test('should handle colors separated by newline', () => {
    const input = 'color: red;\nbackground: green;';
    const expected = 'color: #f00;\nbackground: #0f0;';
    expect(shortenColorsInCss(input)).toBe(expected);
  });
});
