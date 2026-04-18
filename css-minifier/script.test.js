import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/dom';
import { render as preactRender } from 'preact';

const clearButtonInstances = [];
const copyButtonInstances = [];

jest.mock('../common/notification-manager', () => ({
  NotificationManager: {
    show: jest.fn()
  }
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
  mountToolShell: jest.fn()
}));

jest.mock('../common/scheduler-utils', () => ({
  scheduleTask: jest.fn(() => Promise.resolve())
}));

jest.mock('../common/clear-button/ClearButton', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    const instance = {
      updateVisibility: jest.fn(),
      disconnect: jest.fn()
    };
    clearButtonInstances.push(instance);
    return instance;
  })
}));

jest.mock('../common/copy-button/CopyButton', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    const instance = {
      updateVisibility: jest.fn(),
      disconnect: jest.fn()
    };
    copyButtonInstances.push(instance);
    return instance;
  })
}));

jest.mock('./minifier', () => ({
  removeCommentsFromCss: jest.fn((css) => css.replace(/\/\*[\s\S]*?\*\//g, '')),
  removeWhitespaceFromCss: jest.fn((css) => css.replace(/\s+/g, ' ').replace(/\s*([{}:;,])\s*/g, '$1').trim()),
  shortenColorsInCss: jest.fn((css) => css.replace(/red/g, '#f00')),
  removeUnnecessaryUnits: jest.fn((css) => css.replace(/0px/g, '0')),
  removeLastSemicolonsFromCss: jest.fn((css) => css.replace(/;}/g, '}')),
  combineSelectorsInCss: jest.fn((css) => css),
  isValidCSS: jest.fn(() => true)
}));

import { NotificationManager } from '../common/notification-manager';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { scheduleTask } from '../common/scheduler-utils';
import ClearButton from '../common/clear-button/ClearButton';
import CopyButton from '../common/copy-button/CopyButton';
import { isValidCSS } from './minifier';
import { CssMinifierToolUI } from './script';

describe('CSS Minifier Preact runtime', () => {
  const flush = () => Promise.resolve();
  const flushEffects = async () => {
    await flush();
    await flush();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearButtonInstances.length = 0;
    copyButtonInstances.length = 0;
    document.body.innerHTML = '<div id="css-minifier-app"></div>';
  });

  it('renders defaults with zero stats and checked options', async () => {
    new CssMinifierToolUI();
    await flushEffects();

    expect(document.getElementById('css-minifier-input')).not.toBeNull();
    expect(document.getElementById('css-minifier-output')).not.toBeNull();
    expect(document.getElementById('original-size')?.textContent?.toLowerCase()).toContain('0');
    expect(document.getElementById('minified-size')?.textContent?.toLowerCase()).toContain('0');
    expect(document.getElementById('saving')?.textContent).toBe('0.0%');

    expect(document.getElementById('remove-comments')?.checked).toBe(true);
    expect(document.getElementById('remove-whitespace')?.checked).toBe(true);
    expect(document.getElementById('combine-selectors')?.checked).toBe(true);
    expect(document.getElementById('shorten-colors')?.checked).toBe(true);
    expect(document.getElementById('remove-units')?.checked).toBe(true);
    expect(document.getElementById('remove-last-semicolons')?.checked).toBe(true);
    expect(document.body.textContent).toContain('About This Tool');
    expect(document.body.textContent).toContain('What is a CSS Minifier?');
    expect(document.body.textContent).toContain('CSS Minifier FAQs');
    expect(document.querySelector('#css-minifier-tool a[href="https://codesamplez.com/tools/"]')).not.toBeNull();
    expect(document.querySelector('#css-minifier-tool a[href="https://codesamplez.com/tools/javascript-minifier"]')).not.toBeNull();
  });

  it('minifies valid CSS and updates output/stats', async () => {
    new CssMinifierToolUI();
    await flushEffects();

    const input = document.getElementById('css-minifier-input');
    fireEvent.input(input, { target: { value: 'body { color: red; margin: 0px; }' } });
    await flushEffects();

    fireEvent.click(document.getElementById('minify-btn'));
    await flushEffects();
    await flushEffects();

    const output = document.getElementById('css-minifier-output');
    expect(output.value.length).toBeGreaterThan(0);
    expect(output.value).toContain('{');
    expect(scheduleTask).toHaveBeenCalled();
    expect(NotificationManager.show).toHaveBeenCalledWith(
      expect.stringContaining('CSS minified successfully!'),
      expect.any(Number),
      expect.any(Object)
    );
    expect(document.getElementById('minified-size')?.textContent?.toLowerCase()).not.toBe('');
  });

  it('shows error for empty input minify attempt', async () => {
    new CssMinifierToolUI();
    await flushEffects();

    fireEvent.click(document.getElementById('minify-btn'));
    await flushEffects();

    expect(document.getElementById('css-minifier-output')?.value).toBe('');
    expect(NotificationManager.show).toHaveBeenCalledWith(
      'Error: Please enter CSS to minify',
      expect.any(Number),
      expect.any(Object)
    );
  });

  it('shows validation error for invalid CSS input', async () => {
    new CssMinifierToolUI();
    await flushEffects();
    isValidCSS.mockReturnValueOnce(false);

    const input = document.getElementById('css-minifier-input');
    fireEvent.input(input, { target: { value: 'body { color: red' } });
    await flushEffects();

    fireEvent.click(document.getElementById('minify-btn'));
    await flushEffects();
    await flushEffects();

    expect(document.getElementById('css-minifier-output')?.value).toBe('');
    expect(NotificationManager.show).toHaveBeenCalledWith(
      'Error: Invalid CSS input. Please check your CSS syntax.',
      expect.any(Number),
      expect.any(Object)
    );
  });

  it('loads sample CSS and minifies it', async () => {
    new CssMinifierToolUI();
    await flushEffects();

    fireEvent.click(document.getElementById('load-sample'));
    await flushEffects();
    await flushEffects();

    expect(document.getElementById('css-minifier-input')?.value).toContain('Basic styles for a simple page');
    expect(document.getElementById('css-minifier-output')?.value.length).toBeGreaterThan(0);
    expect(NotificationManager.show).toHaveBeenCalledWith(
      'Sample CSS loaded and minified',
      expect.any(Number),
      expect.any(Object)
    );
  });

  it('resets options back to defaults', async () => {
    new CssMinifierToolUI();
    await flushEffects();

    fireEvent.click(document.getElementById('remove-comments'));
    fireEvent.click(document.getElementById('shorten-colors'));
    expect(document.getElementById('remove-comments')?.checked).toBe(false);
    expect(document.getElementById('shorten-colors')?.checked).toBe(false);

    fireEvent.click(document.getElementById('reset-options'));
    await flushEffects();

    expect(document.getElementById('remove-comments')?.checked).toBe(true);
    expect(document.getElementById('shorten-colors')?.checked).toBe(true);
  });

  it('clears output and resets stats when input becomes empty', async () => {
    new CssMinifierToolUI();
    await flushEffects();

    const input = document.getElementById('css-minifier-input');
    fireEvent.input(input, { target: { value: 'body { color: red; }' } });
    await flushEffects();
    fireEvent.click(document.getElementById('minify-btn'));
    for (let i = 0; i < 5 && document.getElementById('css-minifier-output')?.value.length === 0; i += 1) {
      await flushEffects();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(document.getElementById('css-minifier-output')?.value.length).toBeGreaterThan(0);

    fireEvent.input(input, { target: { value: '' } });
    await flushEffects();

    expect(document.getElementById('css-minifier-output')?.value).toBe('');
    expect(document.getElementById('saving')?.textContent).toBe('0.0%');
  });

  it('handles clear and copy custom events through attached listeners', async () => {
    new CssMinifierToolUI();
    await flushEffects();

    const input = document.getElementById('css-minifier-input');
    fireEvent.input(input, { target: { value: 'body { color: red; }' } });
    await flushEffects();

    input.value = '';
    input.dispatchEvent(new CustomEvent('textCleared', { bubbles: true }));
    await flushEffects();

    expect(NotificationManager.show).toHaveBeenCalledWith('Input cleared', expect.any(Number), expect.any(Object));

    const output = document.getElementById('css-minifier-output');
    output.dispatchEvent(new CustomEvent('contentCopied', { bubbles: true }));
    await flushEffects();

    expect(NotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', expect.any(Number), expect.any(Object));
  });

  it('disconnects ClearButton and CopyButton on unmount', async () => {
    new CssMinifierToolUI();

    for (let i = 0; i < 20 && (clearButtonInstances.length === 0 || copyButtonInstances.length === 0); i += 1) {
      await flushEffects();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(document.getElementById('css-minifier-input')).not.toBeNull();
    expect(document.getElementById('css-minifier-output')).not.toBeNull();
    expect(() => preactRender(null, document.getElementById('css-minifier-app'))).not.toThrow();
    await flushEffects();

    expect(ClearButton).toHaveBeenCalled();
    expect(CopyButton).toHaveBeenCalled();
    expect(clearButtonInstances.at(-1)?.disconnect).toHaveBeenCalled();
    expect(copyButtonInstances.at(-1)?.disconnect).toHaveBeenCalled();
  });

  it('uses prerendered root fallback and throws if no root exists', async () => {
    document.body.innerHTML = '<div id="css-minifier-tool"></div>';
    new CssMinifierToolUI('#missing-root');
    await flushEffects();
    expect(document.getElementById('css-minifier-input')).not.toBeNull();

    document.body.innerHTML = '';
    expect(() => new CssMinifierToolUI()).toThrow('CSS Minifier root element not found');
  });

  it('bootstraps shell and app on DOMContentLoaded', async () => {
    document.body.innerHTML = `
      <div id="app-shell-header"></div>
      <div id="css-minifier-app"></div>
      <div id="app-shell-footer"></div>
    `;

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushEffects();

    expect(mountToolShell).toHaveBeenCalledWith(expect.objectContaining({
      title: 'CSS Minifier'
    }));
    expect(document.getElementById('css-minifier-input')).not.toBeNull();
  });
});
