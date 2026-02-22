import { render } from 'preact';

jest.mock('../common/app-shell/mountToolShell.js', () => ({
  mountToolShell: jest.fn()
}));

import { JsonFormatterApp } from './script.js';

describe('JSON Formatter Accessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    render(<JsonFormatterApp />, document.getElementById('root'));
  });

  test('Input textarea should have an accessible name', () => {
    const input = document.querySelector('.c-input.c-input--textarea');
    expect(input).not.toBeNull();
    expect(input.hasAttribute('aria-label')).toBe(true);
    expect(input.getAttribute('aria-label')).toBe('Input JSON');
  });

  test('Output textarea (plain view) should have an accessible name', () => {
    const output = document.querySelector('#plainView .c-input--textarea');
    expect(output).not.toBeNull();
    expect(output.hasAttribute('aria-label')).toBe(true);
    expect(output.getAttribute('aria-label')).toBe('Formatted JSON Output');
  });

  test('View switcher should have proper ARIA attributes', () => {
    const tabList = document.querySelector('.jsonf-tabs');
    expect(tabList.getAttribute('role')).toBe('group');
    expect(tabList.hasAttribute('aria-label')).toBe(true);

    const tabs = document.querySelectorAll('.jsonf-tab');
    expect(tabs.length).toBe(2);

    tabs.forEach(tab => {
      expect(tab.hasAttribute('aria-pressed')).toBe(true);
    });

    const activeTab = document.querySelector('.jsonf-tab.active');
    expect(activeTab.getAttribute('aria-pressed')).toBe('true');
  });
});

