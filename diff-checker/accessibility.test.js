import { render } from 'preact';

jest.mock('../common/app-shell/mountToolShell', () => ({
  mountToolShell: jest.fn()
}));

import { DiffCheckerApp } from './script';

describe('Diff Checker Accessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    render(<DiffCheckerApp />, document.getElementById('root'));
  });

  test('Navigation buttons should have aria-labels', () => {
    const prevButton = document.getElementById('prev-diff-button');
    const nextButton = document.getElementById('next-diff-button');

    expect(prevButton.getAttribute('aria-label')).toBe('Go to previous difference');
    expect(nextButton.getAttribute('aria-label')).toBe('Go to next difference');
  });

  test('Diff counter should be a live region', () => {
    const counter = document.getElementById('diff-counter');

    expect(counter.getAttribute('aria-live')).toBe('polite');
    expect(counter.getAttribute('aria-atomic')).toBe('true');
  });

  test('Result view toggle is a labelled radio group and Unified is the default', () => {
    const group = document.querySelector('[role="radiogroup"]');
    const label = document.getElementById('diff-view-label');
    const unified = document.getElementById('diff-view-unified');
    const split = document.getElementById('diff-view-split');

    expect(group.getAttribute('aria-labelledby')).toBe('diff-view-label');
    expect(label.textContent).toBe('Result view');
    expect(unified.type).toBe('radio');
    expect(unified.name).toBe('diff-view');
    expect(unified.checked).toBe(true);
    expect(unified.disabled).toBe(false);
    expect(split.type).toBe('radio');
    expect(split.value).toBe('split');
    expect(split.checked).toBe(false);
    expect(unified.closest('label').textContent).toContain('Unified');
    expect(split.closest('label').textContent).toContain('Side by side');
  });

  test('Text inputs should have aria-labels', () => {
    const text1 = document.getElementById('text1');
    const text2 = document.getElementById('text2');

    expect(text1.getAttribute('aria-label')).toBe('Original text input');
    expect(text2.getAttribute('aria-label')).toBe('Modified text input');
  });
});
