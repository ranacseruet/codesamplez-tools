import { fireEvent } from '@testing-library/dom';
import { clearToolUsedDedupe } from '../common/analytics-events';

jest.mock('../common/notification-manager', () => ({
  NotificationManager: {
    show: jest.fn()
  }
}));

jest.mock('../common/scheduler-utils', () => ({
  scheduleTask: jest.fn(() => Promise.resolve())
}));

import { DiffCheckerToolUI } from './script';

const SECRET = 'user-secret-diff-text-UNIQUE-93';

function installGtag() {
  const gtag = jest.fn();
  window.gtag = gtag;
  return gtag;
}

function toolUsedCalls(gtag) {
  return gtag.mock.calls.filter((call) => call[0] === 'event' && call[1] === 'tool_used');
}

describe('Diff Checker tool_used', () => {
  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    document.body.innerHTML = '<div id="diff-checker-app"></div>';
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = jest.fn();
    }
  });

  afterEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
  });

  it('fires exactly one compare event and omits the compared text', async () => {
    const gtag = installGtag();
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    new DiffCheckerToolUI();

    document.getElementById('text1').value = SECRET;
    document.getElementById('text2').value = `${SECRET}\nchanged`;
    fireEvent.click(document.getElementById('compare-button'));
    await flush();

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toEqual({
      tool_id: 'diff-checker',
      action: 'compare',
      input_size_bucket: '<1KB'
    });
    expect(JSON.stringify(calls)).not.toContain(SECRET);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('does not fire when both panes are empty', () => {
    const gtag = installGtag();
    new DiffCheckerToolUI();

    fireEvent.click(document.getElementById('compare-button'));

    expect(toolUsedCalls(gtag)).toHaveLength(0);
  });

  it('does not throw or log when gtag is absent', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    new DiffCheckerToolUI();

    document.getElementById('text1').value = SECRET;
    document.getElementById('text2').value = 'other';
    expect(() => fireEvent.click(document.getElementById('compare-button'))).not.toThrow();
    await flush();

    expect(window.gtag).toBeUndefined();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
