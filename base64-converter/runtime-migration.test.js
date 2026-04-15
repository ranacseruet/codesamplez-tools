import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/dom';

const mockClearButtonInstances = [];
const mockCopyButtonInstances = [];

jest.mock('../common/notification-manager', () => ({
  NotificationManager: {
    show: jest.fn()
  }
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
  mountToolShell: jest.fn()
}));

jest.mock('../common/DownloadManager', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    downloadFile: jest.fn()
  }))
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
      forceUpdateVisibility: jest.fn(),
      disconnect: jest.fn()
    };
    mockCopyButtonInstances.push(instance);
    return instance;
  })
}));

import { mountToolShell } from '../common/app-shell/mountToolShell';
import { NotificationManager } from '../common/notification-manager';
import CopyButton from '../common/copy-button/CopyButton';
import { Base64ConverterToolUI } from './script';

describe('Base64 Converter Preact runtime', () => {
  const flush = () => Promise.resolve();
  const flushEffects = async () => {
    await flush();
    await flush();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClearButtonInstances.length = 0;
    mockCopyButtonInstances.length = 0;
    document.body.innerHTML = '<div id="base64converter-app"></div>';
  });

  it('renders app markup and initializes default controls', async () => {
    const ui = new Base64ConverterToolUI();
    await flushEffects();

    expect(ui.converter).toBeTruthy();
    expect(document.getElementById('base64converter-input')).not.toBeNull();
    expect(document.getElementById('base64converter-result')).not.toBeNull();
    expect(document.getElementById('base64converter-mode')?.value).toBe('auto');
    expect(document.getElementById('base64converter-encoding')?.value).toBe('utf8');
    expect(document.getElementById('base64converter-download-decoded')?.disabled).toBe(true);
    expect(document.querySelectorAll('#base64converter-tool h1')).toHaveLength(0);
    expect(document.body.textContent).toContain('About This Tool');
    expect(document.body.textContent).toContain('What is Base64 encoding and why use it?');
    expect(document.body.textContent).toContain('Base64 Converter FAQs (Frequently Asked Questions)');
    expect(document.querySelector('#base64converter-tool a[href="https://codesamplez.com/tools"]')).not.toBeNull();
    expect(document.querySelector('#base64converter-tool a[href="https://codesamplez.com/contact"]')).not.toBeNull();
    expect(window.base64ConverterInstance).toBe(ui.converter);
  });

  it('encodes and decodes text through rendered controls', async () => {
    new Base64ConverterToolUI();
    await flushEffects();

    const input = document.getElementById('base64converter-input');
    const result = document.getElementById('base64converter-result');
    const mode = document.getElementById('base64converter-mode');
    const convert = document.getElementById('base64converter-convert');

    fireEvent.input(input, { target: { value: 'Hello World' } });
    mode.value = 'encode';
    fireEvent.click(convert);
    await flushEffects();

    expect(result.textContent).toBe('SGVsbG8gV29ybGQ=');
    expect(NotificationManager.show).toHaveBeenCalledWith('Encoded using utf8', 2000, { type: 'success' });

    fireEvent.input(input, { target: { value: 'SGVsbG8gV29ybGQ=' } });
    mode.value = 'decode';
    fireEvent.click(convert);
    await flushEffects();

    expect(result.textContent).toBe('Hello World');
    expect(document.getElementById('base64converter-download-decoded')?.disabled).toBe(false);
  });

  it('supports rendered ucs2 encoding option values', async () => {
    new Base64ConverterToolUI();
    await flushEffects();

    const input = document.getElementById('base64converter-input');
    const mode = document.getElementById('base64converter-mode');
    const encoding = document.getElementById('base64converter-encoding');
    const convert = document.getElementById('base64converter-convert');
    const result = document.getElementById('base64converter-result');

    fireEvent.input(input, { target: { value: 'Hello' } });
    mode.value = 'encode';
    encoding.value = 'ucs2';
    fireEvent.click(convert);
    await flushEffects();

    expect(result.textContent).toBe('SABlAGwAbABvAA==');
  });

  it('uses prerendered root fallback and throws if no root exists', async () => {
    document.body.innerHTML = '<div id="base64converter-tool"></div>';
    new Base64ConverterToolUI('#missing-root');
    await flushEffects();

    expect(document.getElementById('base64converter-convert')).not.toBeNull();

    document.body.innerHTML = '';
    expect(() => new Base64ConverterToolUI()).toThrow('Base64 Converter root element not found');
  });

  it('bootstraps shell and app on DOMContentLoaded', async () => {
    document.body.innerHTML = `
      <div id="app-shell-header"></div>
      <div id="base64converter-app"></div>
      <div id="app-shell-footer"></div>
    `;

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushEffects();

    expect(mountToolShell).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Base64 Converter'
    }));
    expect(document.getElementById('base64converter-convert')).not.toBeNull();
    expect(window.base64ConverterInstance).toBeTruthy();
  });

  it('logs and falls back when app bootstrap throws once', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    CopyButton.mockImplementationOnce(() => {
      throw new Error('copy button init failed');
    });

    document.body.innerHTML = `
      <div id="app-shell-header"></div>
      <div id="base64converter-app"></div>
      <div id="app-shell-footer"></div>
    `;

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushEffects();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Base64 converter UI bootstrap failed:', expect.any(Error));
    expect(document.getElementById('base64converter-convert')).not.toBeNull();
    expect(window.base64ConverterInstance).toBeTruthy();

    consoleErrorSpy.mockRestore();
  });
});
