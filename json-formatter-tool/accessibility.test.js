import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

describe('JSON Formatter Accessibility', () => {
  let dom;
  let document;

  beforeAll(() => {
    const html = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf8');
    dom = new JSDOM(html);
    document = dom.window.document;
  });

  test('Input textarea should have an accessible name', () => {
    const input = document.querySelector('.c-input.c-input--textarea');
    expect(input.hasAttribute('aria-label')).toBe(true);
    expect(input.getAttribute('aria-label')).toBe('Input JSON');
  });

  test('Output textarea (plain view) should have an accessible name', () => {
    const output = document.querySelector('#plainView .c-input--textarea');
    expect(output.hasAttribute('aria-label')).toBe(true);
    expect(output.getAttribute('aria-label')).toBe('Formatted JSON Output');
  });
});
