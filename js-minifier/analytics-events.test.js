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

jest.mock('./load-minifier', () => ({
  loadMinifier: jest.fn(async () => class JSMinifier {
    minify(code) {
      const source = String(code);
      if (source.includes('THROW-UNIQUE-94')) {
        throw new Error('Minify failed ' + source);
      }
      return source.replace(/\s+/g, '');
    }
  })
}));

import { JSMinifierToolUI } from './script';

const SECRET = 'function secretUNIQUE94() { return "user-secret-js-UNIQUE-94"; }';

function installGtag() {
  const gtag = jest.fn();
  window.gtag = gtag;
  return gtag;
}

function toolUsedCalls(gtag) {
  return gtag.mock.calls.filter((call) => call[0] === 'event' && call[1] === 'tool_used');
}

describe('JavaScript Minifier tool_used', () => {
  beforeEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    document.body.innerHTML = '<div id="js-minifier-app"></div>';
    new JSMinifierToolUI();
  });

  afterEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    document.body.innerHTML = '';
  });

  async function typeCode(value) {
    const input = document.getElementById('js-minifier-input');
    input.value = value;
    fireEvent.input(input, { target: { value } });
    await Promise.resolve();
  }

  it('fires exactly one minify event and omits the source', async () => {
    const gtag = installGtag();
    await typeCode(SECRET);
    fireEvent.click(document.getElementById('js-minifier-minify-btn'));

    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
    expect(toolUsedCalls(gtag)[0][2]).toEqual({
      tool_id: 'js-minifier',
      action: 'minify',
      trigger: 'user',
      outcome: 'success',
      input_size_bucket: '<1KB'
    });
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('user-secret-js-UNIQUE-94');
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('secretUNIQUE94');
  });

  it('tags a minify failure as error and omits the source', async () => {
    const gtag = installGtag();
    const invalid = 'THROW-UNIQUE-94 user-secret-js-UNIQUE-94';
    await typeCode(invalid);
    fireEvent.click(document.getElementById('js-minifier-minify-btn'));

    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
    expect(toolUsedCalls(gtag)[0][2].outcome).toBe('error');
    expect(toolUsedCalls(gtag)[0][2].action).toBe('minify');
    expect(toolUsedCalls(gtag)[0][2].trigger).toBe('user');
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('user-secret-js-UNIQUE-94');
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('THROW-UNIQUE-94');
  });

  it('does not fire when the input is empty', async () => {
    const gtag = installGtag();
    fireEvent.click(document.getElementById('js-minifier-minify-btn'));
    await Promise.resolve();
    expect(toolUsedCalls(gtag)).toHaveLength(0);
  });

  it('tags Load Sample as sample', async () => {
    const gtag = installGtag();
    fireEvent.click(document.getElementById('js-minifier-load-sample-btn'));

    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
    expect(toolUsedCalls(gtag)[0][2].trigger).toBe('sample');
    expect(toolUsedCalls(gtag)[0][2].outcome).toBe('success');
    expect(toolUsedCalls(gtag)[0][2].action).toBe('minify');
    expect(toolUsedCalls(gtag)[0][2].tool_id).toBe('js-minifier');
  });
});
