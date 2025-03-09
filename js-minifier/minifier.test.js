import { JSMinifier } from './minifier.js';

describe('JS Minifier', () => {
  const minifier = new JSMinifier();

  test('should remove comments', () => {
    const input = `// comment\nconst x = 1;`;
    const output = `const x=1;`;
    expect(minifier.minify(input)).toBe(output);
  });

  test('should remove whitespace', () => {
    const input = `const x = 1; \n const y = 2;`;
    const output = `const x=1;const y=2;`;
    expect(minifier.minify(input)).toBe(output);
  });
});
