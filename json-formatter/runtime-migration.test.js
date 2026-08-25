import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/dom';

const clearButtonInstances = [];

jest.mock('../common/notification-manager', () => ({
  NotificationManager: {
    show: jest.fn()
  }
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
  mountToolShell: jest.fn()
}));

jest.mock('../common/scheduler-utils', () => ({
  scheduleTask: jest.fn(() => Promise.resolve()),
  nextFrame: jest.fn(() => Promise.resolve())
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
    clearButtonInstances.push(instance);
    return instance;
  })
}));

import { NotificationManager } from '../common/notification-manager';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { JSONFormatterToolUI } from './script';
import { SITE_BASE_URL } from '../common/siteBaseUrl';

describe('JSON Formatter Preact runtime', () => {
  const flush = () => Promise.resolve();
  const flushEffects = async () => {
    await flush();
    await flush();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearButtonInstances.length = 0;
    document.body.innerHTML = '<div id="json-formatter-app"></div>';
  });

  it('renders app markup and initial disabled output actions', async () => {
    new JSONFormatterToolUI();
    await flushEffects();

    expect(document.getElementById('formatJsonBtn')).not.toBeNull();
    expect(document.getElementById('copyOutputBtn')?.disabled).toBe(true);
    expect(document.getElementById('downloadOutputBtn')?.disabled).toBe(true);
    expect(document.querySelector('#treeView .c-code-output code')).not.toBeNull();
  });

  it('formats valid JSON and populates tree/plain views', async () => {
    new JSONFormatterToolUI();
    await flushEffects();

    const input = document.querySelector('.c-input.c-input--textarea');
    fireEvent.input(input, { target: { value: '{"b":2,"a":1}' } });
    await flushEffects();

    fireEvent.click(document.getElementById('formatJsonBtn'));
    await flushEffects();
    await flushEffects();

    const keys = document.querySelectorAll('#treeView .json-key');
    expect(keys.length).toBeGreaterThan(0);
    expect(document.querySelector('#plainView .c-input--textarea')?.value).toContain('"a"');
    expect(document.getElementById('copyOutputBtn')?.disabled).toBe(false);
    expect(document.getElementById('downloadOutputBtn')?.disabled).toBe(false);
    expect(NotificationManager.show).toHaveBeenCalledWith('JSON formatted successfully!', 2000, { type: 'success' });
  });

  it('shows error for invalid JSON and keeps output actions disabled', async () => {
    new JSONFormatterToolUI();
    await flushEffects();

    const input = document.querySelector('.c-input.c-input--textarea');
    fireEvent.input(input, { target: { value: '{"bad": }' } });
    await flushEffects();

    fireEvent.click(document.getElementById('formatJsonBtn'));
    await flushEffects();
    await flushEffects();

    expect(document.getElementById('jsonErrorStatus')?.textContent).toContain('Invalid JSON');
    expect(document.getElementById('copyOutputBtn')?.disabled).toBe(true);
    expect(document.getElementById('downloadOutputBtn')?.disabled).toBe(true);
  });

  it('switches between tree and plain views', async () => {
    new JSONFormatterToolUI();
    await flushEffects();

    const tabs = document.querySelectorAll('.jsonf-tab');
    const plainTab = Array.from(tabs).find((tab) => tab.dataset.view === 'plain');
    fireEvent.click(plainTab);
    await flushEffects();

    expect(document.getElementById('plainView')?.classList.contains('active')).toBe(true);
    expect(plainTab.getAttribute('aria-pressed')).toBe('true');
  });

  it('loads sample data and formats output', async () => {
    new JSONFormatterToolUI();
    await flushEffects();

    fireEvent.click(document.getElementById('loadSampleBtn'));
    for (let i = 0; i < 10 && !document.querySelector('#plainView .c-input--textarea')?.value; i += 1) {
      await flushEffects();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const input = document.querySelector('.c-input.c-input--textarea');
    expect(input.value).toContain('userProfile');
    expect(document.querySelector('#plainView .c-input--textarea')?.value).toContain('userProfile');
    expect(NotificationManager.show).toHaveBeenCalledWith('Sample data loaded successfully!', 2000, { type: 'success' });
  });

  it('uses prerendered root fallback', async () => {
    document.body.innerHTML = '<div id="json-formatter-tool"></div>';

    new JSONFormatterToolUI('#missing-root');
    for (let i = 0; i < 5 && clearButtonInstances.length === 0; i += 1) {
      await flushEffects();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(document.getElementById('formatJsonBtn')).not.toBeNull();
  });

  it('throws when no mount root exists', () => {
    document.body.innerHTML = '';
    expect(() => new JSONFormatterToolUI()).toThrow('JSON Formatter root element not found');
  });

  it('bootstraps shell and tool on DOMContentLoaded', async () => {
    document.body.innerHTML = `
      <div id="app-shell-header"></div>
      <div id="json-formatter-app"></div>
      <div id="app-shell-footer"></div>
    `;

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushEffects();

    expect(mountToolShell).toHaveBeenCalledWith(expect.objectContaining({
      title: 'JSON Formatter'
    }));
    expect(document.getElementById('formatJsonBtn')).not.toBeNull();
  });
});
