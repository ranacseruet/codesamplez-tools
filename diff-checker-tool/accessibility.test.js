const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Diff Checker Accessibility', () => {
  let doc;

  beforeAll(() => {
    const htmlPath = path.resolve(__dirname, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const dom = new JSDOM(htmlContent);
    doc = dom.window.document;
  });

  test('Navigation buttons should have aria-labels', () => {
    const prevButton = doc.getElementById('prev-diff-button');
    const nextButton = doc.getElementById('next-diff-button');

    expect(prevButton.getAttribute('aria-label')).toBe('Go to previous difference');
    expect(nextButton.getAttribute('aria-label')).toBe('Go to next difference');
  });

  test('Diff counter should be a live region', () => {
    const counter = doc.getElementById('diff-counter');

    expect(counter.getAttribute('aria-live')).toBe('polite');
    expect(counter.getAttribute('aria-atomic')).toBe('true');
  });

  test('Text inputs should have aria-labels', () => {
    const text1 = doc.getElementById('text1');
    const text2 = doc.getElementById('text2');

    expect(text1.getAttribute('aria-label')).toBe('Original text input');
    expect(text2.getAttribute('aria-label')).toBe('Modified text input');
  });
});
