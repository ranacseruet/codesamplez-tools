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
  scheduleTask: jest.fn(() => Promise.resolve())
}));

jest.mock('../common/clear-button/ClearButton', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    const instance = {
      disconnect: jest.fn()
    };
    clearButtonInstances.push(instance);
    return instance;
  })
}));

import ClearButton from '../common/clear-button/ClearButton';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { NotificationManager } from '../common/notification-manager';
import { DiffCheckerToolUI } from './script';

describe('Diff Checker Preact runtime', () => {
  const flush = () => Promise.resolve();
  const flushEffects = async () => {
    await flush();
    await flush();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearButtonInstances.length = 0;
    document.body.innerHTML = `
      <section id="diff-checker-static-before">About This Tool</section>
      <div id="diff-checker-app"></div>
      <section id="diff-checker-static-after">
        What is a Diff Checker?
        Diff Checker FAQs
        <a href="https://codesamplez.com/tools/">Explore More Dev Tools</a>
        <a href="https://codesamplez.com/contact">message us</a>
      </section>
    `;
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = jest.fn();
    } else {
      jest.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    }
  });

  afterEach(() => {
    if (HTMLElement.prototype.scrollIntoView?.mockRestore) {
      HTMLElement.prototype.scrollIntoView.mockRestore();
    }
  });

  it('renders app markup and initializes controls', async () => {
    const ui = new DiffCheckerToolUI();
    await flushEffects();

    expect(ui.instance).toBeTruthy();
    expect(document.getElementById('text1')).not.toBeNull();
    expect(document.getElementById('text2')).not.toBeNull();
    expect(document.getElementById('compare-button')?.textContent).toBe('Compare');
    expect(document.getElementById('ignore-whitespace')?.checked).toBe(true);
    expect(document.body.textContent).toContain('About This Tool');
    expect(document.body.textContent).toContain('What is a Diff Checker?');
    expect(document.body.textContent).toContain('Diff Checker FAQs');
    expect(document.querySelector('a[href="https://codesamplez.com/tools/"]')).not.toBeNull();
    expect(document.querySelector('a[href="https://codesamplez.com/contact"]')).not.toBeNull();
    expect(window.diffCheckerCleanup).toEqual(expect.any(Function));
  });

  it('computes and renders diff via rendered controls', async () => {
    new DiffCheckerToolUI();
    await flushEffects();

    fireEvent.input(document.getElementById('text1'), { target: { value: 'foo\nbar' } });
    fireEvent.input(document.getElementById('text2'), { target: { value: 'foo\nbaz' } });
    fireEvent.click(document.getElementById('compare-button'));
    await flushEffects();
    await flushEffects();

    expect(document.getElementById('diff-result')?.children.length).toBeGreaterThan(0);
    expect(document.getElementById('compare-button')?.textContent).toBe('Compare');
    expect(document.getElementById('compare-button')?.disabled).toBe(false);
    expect(NotificationManager.show).toHaveBeenCalledWith('Diff computation complete!');
  });

  it('exposes cleanup and disconnects clear buttons', async () => {
    new DiffCheckerToolUI();
    await flushEffects();

    expect(clearButtonInstances).toHaveLength(2);
    window.diffCheckerCleanup();
    expect(clearButtonInstances[0].disconnect).toHaveBeenCalled();
    expect(clearButtonInstances[1].disconnect).toHaveBeenCalled();
  });

  it('uses prerendered root fallback and throws when no root exists', async () => {
    document.body.innerHTML = '<div id="diff-checker-tool"></div>';
    new DiffCheckerToolUI('#missing-root');
    await flushEffects();
    expect(document.getElementById('compare-button')).not.toBeNull();

    document.body.innerHTML = '';
    expect(() => new DiffCheckerToolUI()).toThrow('Diff Checker root element not found');
  });

  it('bootstraps shell and app on DOMContentLoaded', async () => {
    document.body.innerHTML = `
      <div id="app-shell-header"></div>
      <div id="diff-checker-app"></div>
      <div id="app-shell-footer"></div>
    `;

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushEffects();

    expect(mountToolShell).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Diff Checker'
    }));
    expect(document.getElementById('compare-button')).not.toBeNull();
  });

  it('logs and falls back when bootstrap app init fails once', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    ClearButton.mockImplementationOnce(() => {
      throw new Error('clear button failed');
    });

    document.body.innerHTML = `
      <div id="app-shell-header"></div>
      <div id="diff-checker-app"></div>
      <div id="app-shell-footer"></div>
    `;

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushEffects();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Diff checker UI bootstrap failed:', expect.any(Error));
    expect(document.getElementById('compare-button')).not.toBeNull();
    expect(window.diffCheckerCleanup).toEqual(expect.any(Function));

    consoleErrorSpy.mockRestore();
  });
});
