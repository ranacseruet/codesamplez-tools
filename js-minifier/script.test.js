import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/dom';
import { render as preactRender } from 'preact';
import { fireFileDragEvent, fireFileDrop, flushFileDrop } from '../common/drop-zone-test-utils';

const mockClearButtonInstances = [];
const mockCopyButtonInstances = [];
const mockMinifierInstances = [];
const mockMinifyImpl = jest.fn((code) => String(code).replace(/\s+/g, ' ').trim());
const mockJSMinifier = jest.fn().mockImplementation((options = {}) => {
  const instance = {
    options,
    minify: jest.fn((code) => mockMinifyImpl(code, options))
  };
  mockMinifierInstances.push(instance);
  return instance;
});

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
    mockClearButtonInstances.push(instance);
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
    mockCopyButtonInstances.push(instance);
    return instance;
  })
}));

// script.tsx code-splits the Babel engine behind the `./load-minifier` seam
// (issue #396). Mocking that seam keeps the real engine — and its dynamic
// `import()`, which jest's ESM loader can't intercept — out of these tests.
jest.mock('./load-minifier', () => ({
  loadMinifier: jest.fn(async () => mockJSMinifier)
}));

import { NotificationManager } from '../common/notification-manager';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { scheduleTask } from '../common/scheduler-utils';
import ClearButton from '../common/clear-button/ClearButton';
import CopyButton from '../common/copy-button/CopyButton';
import { JSMinifierToolUI } from './script';
import { loadMinifier } from './load-minifier';
import { SITE_BASE_URL } from '../common/siteBaseUrl';

// Alias for the assertions that check the engine constructor.
const JSMinifier = mockJSMinifier;

describe('JavaScript Minifier Preact runtime', () => {
  const flush = () => Promise.resolve();
  const flushEffects = async () => {
    await flush();
    await flush();
    await flush();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClearButtonInstances.length = 0;
    mockCopyButtonInstances.length = 0;
    mockMinifierInstances.length = 0;
    mockMinifyImpl.mockReset();
    mockMinifyImpl.mockImplementation((code) => String(code).replace(/\s+/g, ' ').trim());
    document.body.innerHTML = '<div id="js-minifier-app"></div>';
  });

  it('renders initial UI with default option state and zero stats', async () => {
    new JSMinifierToolUI();
    await flushEffects();

    expect(document.getElementById('js-minifier-input')).not.toBeNull();
    expect(document.getElementById('js-minifier-output')).not.toBeNull();
    expect(document.getElementById('js-minifier-minify-btn')?.textContent).toContain('Minify JavaScript');
    expect(document.getElementById('js-minifier-remove-comments')?.checked).toBe(true);
    expect(document.getElementById('js-minifier-remove-whitespace')?.checked).toBe(true);
    expect(document.getElementById('js-minifier-shorten-variables')?.checked).toBe(false);
    expect(document.getElementById('js-minifier-mangle-properties')?.checked).toBe(false);
    expect(document.getElementById('js-minifier-compression-ratio')?.textContent).toBe('0.00%');
    expect(document.querySelectorAll('#js-minifier-tool h1')).toHaveLength(0);
    expect(document.body.textContent).toContain('About This Tool');
    expect(document.body.textContent).toContain('Why Minify JavaScript?');
    expect(document.body.textContent).toContain('JavaScript Minifier FAQs');
    expect(document.querySelector(`#js-minifier-tool a[href="${SITE_BASE_URL}"]`)).not.toBeNull();
    expect(document.querySelector('#js-minifier-tool a[href="https://codesamplez.com/contact"]')).not.toBeNull();
  });

  it('minifies valid input and updates output/stats', async () => {
    new JSMinifierToolUI();
    await flushEffects();

    const input = document.getElementById('js-minifier-input');
    fireEvent.input(input, { target: { value: 'const x = 1;  // hi' } });
    await flushEffects();

    fireEvent.click(document.getElementById('js-minifier-minify-btn'));
    await flushEffects();
    await flushEffects();

    expect(scheduleTask).toHaveBeenCalledWith(20);
    expect(JSMinifier).toHaveBeenCalledWith(expect.objectContaining({
      removeComments: true,
      removeWhitespace: true,
      shortenVariables: false,
      mangleProperties: false
    }));
    expect(document.getElementById('js-minifier-output')?.value.length).toBeGreaterThan(0);
    expect(document.getElementById('js-minifier-original-size')?.textContent?.trim()).not.toBe('0 bytes');
    expect(NotificationManager.show).toHaveBeenCalledWith(
      expect.stringContaining('JavaScript minified successfully!'),
      2000,
      { type: 'success' }
    );
  });

  it('shows an error for empty input', async () => {
    new JSMinifierToolUI();
    await flushEffects();

    fireEvent.click(document.getElementById('js-minifier-minify-btn'));
    await flushEffects();

    expect(document.getElementById('js-minifier-output')?.value).toBe('');
    // v4 contract: errors surface inline, not as toasts.
    expect(NotificationManager.show).not.toHaveBeenCalled();
    const errorStatus = document.getElementById('js-minifier-error-status');
    expect(errorStatus?.textContent).toBe('Please enter JavaScript to minify');
    expect(errorStatus?.classList.contains('error')).toBe(true);
    expect(JSMinifier).not.toHaveBeenCalled();
  });

  it('shows minification errors and clears output', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockMinifyImpl.mockImplementationOnce(() => {
      throw new Error('Bad JS');
    });

    new JSMinifierToolUI();
    await flushEffects();

    const input = document.getElementById('js-minifier-input');
    fireEvent.input(input, { target: { value: 'const x = 1;' } });
    await flushEffects();

    fireEvent.click(document.getElementById('js-minifier-minify-btn'));
    await flushEffects();
    await flushEffects();

    expect(document.getElementById('js-minifier-output')?.value).toBe('');
    // v4 contract: errors surface inline, not as toasts.
    expect(NotificationManager.show).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Minification error:', expect.any(Error));

    const errorStatus = document.getElementById('js-minifier-error-status');
    expect(errorStatus?.textContent).toBe('Bad JS');
    expect(errorStatus?.classList.contains('error')).toBe(true);
    expect(errorStatus?.getAttribute('role')).toBe('alert');

    consoleErrorSpy.mockRestore();
  });

  it('clears the inline validation error after a successful minify', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockMinifyImpl.mockImplementationOnce(() => {
      throw new Error('Invalid JavaScript syntax: Unexpected token (1:6)');
    });

    new JSMinifierToolUI();
    await flushEffects();

    const input = document.getElementById('js-minifier-input');
    fireEvent.input(input, { target: { value: 'const =;' } });
    await flushEffects();
    fireEvent.click(document.getElementById('js-minifier-minify-btn'));
    await flushEffects();
    await flushEffects();

    const errorStatus = document.getElementById('js-minifier-error-status');
    expect(errorStatus?.textContent).toContain('Unexpected token');
    expect(errorStatus?.classList.contains('error')).toBe(true);

    // A subsequent valid minify must clear the inline error.
    fireEvent.input(input, { target: { value: 'const x = 1;' } });
    await flushEffects();
    fireEvent.click(document.getElementById('js-minifier-minify-btn'));
    await flushEffects();
    await flushEffects();

    expect(errorStatus?.textContent).toBe('');
    expect(errorStatus?.classList.contains('error')).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  it('drops a stale minify when the input changes while the engine is loading', async () => {
    // Make the engine load hang until we resolve it, simulating a slow first
    // fetch during which the user keeps editing.
    let resolveEngine;
    loadMinifier.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveEngine = () => resolve(mockJSMinifier);
      })
    );

    new JSMinifierToolUI();
    await flushEffects();

    const input = document.getElementById('js-minifier-input');
    fireEvent.input(input, { target: { value: 'const a = 1;' } });
    await flushEffects();

    fireEvent.click(document.getElementById('js-minifier-minify-btn'));
    await flushEffects(); // runMinify is now parked on the hanging engine load

    // User keeps typing while the engine loads.
    fireEvent.input(input, { target: { value: 'const b = 2;' } });
    await flushEffects();

    // Engine finishes loading; the run for the old 'const a = 1;' must be dropped.
    resolveEngine();
    await flushEffects();
    await flushEffects();

    expect(document.getElementById('js-minifier-output')?.value).toBe('');
    expect(NotificationManager.show).not.toHaveBeenCalledWith(
      expect.stringContaining('minified successfully'),
      expect.anything(),
      expect.anything()
    );
  });

  it('auto-minifies when options change using updated options', async () => {
    new JSMinifierToolUI();
    await flushEffects();

    const input = document.getElementById('js-minifier-input');
    fireEvent.input(input, { target: { value: 'const value = 1;' } });
    await flushEffects();

    mockMinifyImpl.mockClear();
    JSMinifier.mockClear();

    fireEvent.click(document.getElementById('js-minifier-shorten-variables'));
    await flushEffects();
    await flushEffects();

    expect(JSMinifier).toHaveBeenCalledWith(expect.objectContaining({ shortenVariables: true }));
    expect(mockMinifyImpl).toHaveBeenCalled();
    expect(document.getElementById('js-minifier-output')?.value.length).toBeGreaterThan(0);
  });

  it('loads sample code and minifies it', async () => {
    new JSMinifierToolUI();
    await flushEffects();

    fireEvent.click(document.getElementById('js-minifier-load-sample-btn'));
    await flushEffects();
    await flushEffects();

    expect(document.getElementById('js-minifier-input')?.value).toContain('function calculateSum(numbers)');
    expect(document.getElementById('js-minifier-output')?.value.length).toBeGreaterThan(0);
    expect(NotificationManager.show).toHaveBeenCalledWith('Sample code loaded and minified', 1500, { type: 'success' });
  });

  it('loads a dropped file into the input and minifies it', async () => {
    new JSMinifierToolUI();
    await flushEffects();

    fireFileDrop(document.getElementById('js-minifier-input'), 'const  a  =  1;', 'app.js');
    await flushFileDrop();
    await flushEffects();
    await flushEffects();

    expect(document.getElementById('js-minifier-input')?.value).toBe('const  a  =  1;');
    expect(document.getElementById('js-minifier-output')?.value.length).toBeGreaterThan(0);
    expect(NotificationManager.show).toHaveBeenCalledWith(
      'Loaded app.js',
      expect.any(Number),
      expect.objectContaining({ type: 'success' })
    );
  });

  it('surfaces a rejected drop as an error toast', async () => {
    new JSMinifierToolUI();
    await flushEffects();

    fireFileDragEvent(document.getElementById('js-minifier-input'), 'drop', []);
    await flushFileDrop();

    expect(document.getElementById('js-minifier-input')?.value).toBe('');
    expect(NotificationManager.show).toHaveBeenCalledWith(
      expect.stringContaining('No file'),
      expect.any(Number),
      expect.objectContaining({ type: 'error' })
    );
  });

  it('clears output and resets stats when input becomes empty', async () => {
    new JSMinifierToolUI();
    await flushEffects();

    const input = document.getElementById('js-minifier-input');
    fireEvent.input(input, { target: { value: 'const a = 1;' } });
    await flushEffects();
    fireEvent.click(document.getElementById('js-minifier-minify-btn'));
    await flushEffects();
    await flushEffects();
    expect(document.getElementById('js-minifier-output')?.value.length).toBeGreaterThan(0);

    fireEvent.input(input, { target: { value: '' } });
    await flushEffects();

    expect(document.getElementById('js-minifier-output')?.value).toBe('');
    expect(document.getElementById('js-minifier-compression-ratio')?.textContent).toBe('0.00%');
  });

  it('handles custom clear/copy events and disconnects helper buttons on unmount', async () => {
    new JSMinifierToolUI();
    for (let i = 0; i < 20 && (mockClearButtonInstances.length === 0 || mockCopyButtonInstances.length === 0); i += 1) {
      await flushEffects();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const input = document.getElementById('js-minifier-input');
    fireEvent.input(input, { target: { value: 'const a = 1;' } });
    await flushEffects();

    input.value = '';
    input.dispatchEvent(new CustomEvent('textCleared', { bubbles: true }));
    await flushEffects();
    expect(NotificationManager.show).toHaveBeenCalledWith('Input cleared', 2000, { type: 'success' });

    const output = document.getElementById('js-minifier-output');
    output.dispatchEvent(new CustomEvent('contentCopied', { bubbles: true }));
    await flushEffects();
    expect(NotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', 2000, { type: 'success' });

    expect(() => preactRender(null, document.getElementById('js-minifier-app'))).not.toThrow();
    await flushEffects();

    expect(ClearButton).toHaveBeenCalled();
    expect(CopyButton).toHaveBeenCalled();
    expect(mockClearButtonInstances.at(-1)?.disconnect).toHaveBeenCalled();
    expect(mockCopyButtonInstances.at(-1)?.disconnect).toHaveBeenCalled();
  });

  it('uses prerendered root fallback and throws if no root exists', async () => {
    document.body.innerHTML = '<div id="js-minifier-tool"></div>';

    new JSMinifierToolUI('#missing-root');
    await flushEffects();
    expect(document.getElementById('js-minifier-input')).not.toBeNull();

    document.body.innerHTML = '';
    expect(() => new JSMinifierToolUI()).toThrow('JavaScript Minifier root element not found');
  });

  it('skips helper setup when textarea refs fail the runtime type guard', async () => {
    const OriginalHTMLTextAreaElement = global.HTMLTextAreaElement;
    const OriginalWindowHTMLTextAreaElement = window.HTMLTextAreaElement;
    const FakeHtmlTextAreaElement = class {};
    global.HTMLTextAreaElement = FakeHtmlTextAreaElement;
    window.HTMLTextAreaElement = FakeHtmlTextAreaElement;

    try {
      new JSMinifierToolUI();
      await flushEffects();

      expect(ClearButton).not.toHaveBeenCalled();
      expect(CopyButton).not.toHaveBeenCalled();
    } finally {
      global.HTMLTextAreaElement = OriginalHTMLTextAreaElement;
      window.HTMLTextAreaElement = OriginalWindowHTMLTextAreaElement;
    }
  });

  it('bootstraps shell and app on DOMContentLoaded', async () => {
    document.body.innerHTML = `
      <div id="app-shell-header"></div>
      <div id="js-minifier-app"></div>
      <div id="app-shell-footer"></div>
    `;

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushEffects();

    expect(mountToolShell).toHaveBeenCalledWith(expect.objectContaining({
      title: 'JavaScript Minifier'
    }));
    expect(document.getElementById('js-minifier-minify-btn')).not.toBeNull();
  });
});
