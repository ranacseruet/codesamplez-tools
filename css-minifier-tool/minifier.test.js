import { minifyCSS } from './minifier.js';

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
