import { jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/dom';
import { clearToolUsedDedupe } from '../common/analytics-events';

jest.mock('../common/notification-manager', () => ({
  NotificationManager: { show: jest.fn() }
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
  mountToolShell: jest.fn()
}));

jest.mock('../common/scheduler-utils', () => ({
  scheduleTask: jest.fn(() => Promise.resolve())
}));

jest.mock('../common/clear-button/ClearButton', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    updateVisibility: jest.fn(),
    disconnect: jest.fn()
  }))
}));

jest.mock('../common/copy-button/CopyButton', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    updateVisibility: jest.fn(),
    disconnect: jest.fn()
  }))
}));

import { CssMinifierToolUI } from './script';

const SECRET = 'body { color: #user-secret-css-UNIQUE-94; }';

function installGtag() {
  const gtag = jest.fn();
  window.gtag = gtag;
  return gtag;
}

function toolUsedCalls(gtag) {
  return gtag.mock.calls.filter((call) => call[0] === 'event' && call[1] === 'tool_used');
}

describe('CSS Minifier tool_used', () => {
  beforeEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    document.body.innerHTML = '<div id="css-minifier-app"></div>';
    new CssMinifierToolUI();
  });

  afterEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    document.body.innerHTML = '';
  });

  async function typeCss(value) {
    const input = document.getElementById('css-minifier-input');
    input.value = value;
    fireEvent.input(input, { target: { value } });
    await Promise.resolve();
  }

  it('fires exactly one minify event and omits the stylesheet', async () => {
    const gtag = installGtag();
    await typeCss(SECRET);
    fireEvent.click(document.getElementById('minify-btn'));

    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
    expect(toolUsedCalls(gtag)[0][2]).toEqual({
      tool_id: 'css-minifier',
      action: 'minify',
      trigger: 'user',
      outcome: 'success',
      input_size_bucket: '<1KB'
    });
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('user-secret-css-UNIQUE-94');
  });

  it('tags invalid CSS as error and omits the source', async () => {
    const gtag = installGtag();
    const invalid = 'not-css-UNIQUE-94 {{{';
    await typeCss(invalid);
    fireEvent.click(document.getElementById('minify-btn'));

    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
    expect(toolUsedCalls(gtag)[0][2].action).toBe('minify');
    expect(toolUsedCalls(gtag)[0][2].trigger).toBe('user');
    expect(toolUsedCalls(gtag)[0][2].outcome).toBe('error');
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain(invalid);
  });

  it('does not fire when the input is empty', async () => {
    const gtag = installGtag();
    fireEvent.click(document.getElementById('minify-btn'));
    await Promise.resolve();
    expect(toolUsedCalls(gtag)).toHaveLength(0);
  });

  it('tags Load Sample as sample', async () => {
    const gtag = installGtag();
    fireEvent.click(document.getElementById('load-sample'));

    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
    expect(toolUsedCalls(gtag)[0][2].trigger).toBe('sample');
    expect(toolUsedCalls(gtag)[0][2].outcome).toBe('success');
    expect(toolUsedCalls(gtag)[0][2].action).toBe('minify');
    expect(toolUsedCalls(gtag)[0][2].tool_id).toBe('css-minifier');
  });
});
