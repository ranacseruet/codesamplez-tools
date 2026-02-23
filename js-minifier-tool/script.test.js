import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/dom';
import { render as preactRender } from 'preact';

const mockClearButtonInstances = [];
const mockCopyButtonInstances = [];
const mockMinifierInstances = [];
const mockMinifyImpl = jest.fn((code) => String(code).replace(/\s+/g, ' ').trim());

jest.mock('../common/notification-manager.js', () => ({
  NotificationManager: {
    show: jest.fn()
  }
}));

jest.mock('../common/app-shell/mountToolShell.js', () => ({
  mountToolShell: jest.fn()
}));

jest.mock('../common/scheduler-utils.js', () => ({
  scheduleTask: jest.fn(() => Promise.resolve())
}));

jest.mock('../common/clear-button/ClearButton.js', () => ({
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

jest.mock('../common/copy-button/CopyButton.js', () => ({
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

jest.mock('./minifier.js', () => ({
  JSMinifier: jest.fn().mockImplementation((options = {}) => {
    const instance = {
      options,
      minify: jest.fn((code) => mockMinifyImpl(code, options))
    };
    mockMinifierInstances.push(instance);
    return instance;
  })
}));

import { NotificationManager } from '../common/notification-manager.js';
import { mountToolShell } from '../common/app-shell/mountToolShell.js';
import { scheduleTask } from '../common/scheduler-utils.js';
import ClearButton from '../common/clear-button/ClearButton.js';
import CopyButton from '../common/copy-button/CopyButton.js';
import { JSMinifier } from './minifier.js';
import { JSMinifierToolUI } from './script.js';

describe('JavaScript Minifier Preact runtime', () => {
  const flush = () => Promise.resolve();
  const flushEffects = async () => {
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
    expect(NotificationManager.show).toHaveBeenCalledWith('Please enter JavaScript to minify', 2000, { type: 'error' });
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
    expect(NotificationManager.show).toHaveBeenCalledWith('Minification error: Bad JS', 3000, { type: 'error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Minification error:', expect.any(Error));

    consoleErrorSpy.mockRestore();
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
