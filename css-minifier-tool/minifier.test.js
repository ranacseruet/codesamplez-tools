import { minifyCSS, isValidCSS } from './minifier.js';

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
});

describe('CSS Validator', () => {
  // Mock document.head.appendChild and document.head.removeChild
  // and styleElement.sheet.cssRules
  let mockStyleElement;
  let originalAppendChild;
  let originalRemoveChild;
  let originalCreateElement;

  beforeEach(() => {
    mockStyleElement = {
      sheet: {
        cssRules: []
      },
      textContent: '',
      parentNode: document.head
    };
    originalAppendChild = document.head.appendChild;
    originalRemoveChild = document.head.removeChild;
    originalCreateElement = document.createElement;

    document.head.appendChild = jest.fn(() => mockStyleElement);
    document.head.removeChild = jest.fn();
    
    document.createElement = jest.fn(tagName => {
      if (tagName.toLowerCase() === 'style') {
        return mockStyleElement;
      }
      return originalCreateElement.call(document, tagName);
    });
  });

  afterEach(() => {
    document.head.appendChild = originalAppendChild;
    document.head.removeChild = originalRemoveChild;
    document.createElement = originalCreateElement;
  });
  
  test('should return true for valid CSS', () => {
    mockStyleElement.sheet.cssRules = [{ cssText: 'body { color: red; }' }];
    expect(isValidCSS('body { color: red; }')).toBe(true);
  });

  test('should return false for invalid CSS (e.g., unclosed brace)', () => {
    mockStyleElement.sheet.cssRules = []; 
    expect(isValidCSS('body { color: red; ')).toBe(false);
  });

  test('should return false for CSS with only a selector but no declaration block', () => {
    mockStyleElement.sheet.cssRules = [];
    expect(isValidCSS('body ')).toBe(false);
  });
  
  test('should return false for CSS with a property but no value', () => {
    mockStyleElement.sheet.cssRules = [];
    expect(isValidCSS('body { color: }')).toBe(false);
  });

  test('should return true for empty string', () => {
    expect(isValidCSS('')).toBe(true);
  });

  test('should return true for CSS containing only comments', () => {
    expect(isValidCSS('/* this is a comment */')).toBe(true);
  });
  
  test('should return false for malformed comments', () => {
    mockStyleElement.sheet.cssRules = []; // Malformed comment might lead to no rules
    expect(isValidCSS('/* this is a malformed comment body {color: red;}')).toBe(false);
  });

  test('should handle CSS with multiple valid rules', () => {
    mockStyleElement.sheet.cssRules = [
      { cssText: 'p { font-size: 12px; }' },
      { cssText: 'a { text-decoration: none; }' }
    ];
    expect(isValidCSS('p { font-size: 12px; } a { text-decoration: none; }')).toBe(true);
  });

  test('should return false when styleElement.sheet is null', () => {
    mockStyleElement.sheet = null;
    expect(isValidCSS('body { color: blue; }')).toBe(false);
  });
  
  test('should return false when styleElement.sheet.cssRules is null', () => {
    mockStyleElement.sheet = { cssRules: null };
    expect(isValidCSS('body { color: green; }')).toBe(false);
  });

  test('should correctly identify valid CSS with leading/trailing whitespace', () => {
    mockStyleElement.sheet.cssRules = [{ cssText: 'div { border: 1px solid black; }'}];
    expect(isValidCSS('  div { border: 1px solid black; }  ')).toBe(true);
  });
});
