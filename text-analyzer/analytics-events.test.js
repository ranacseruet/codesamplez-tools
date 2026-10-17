import { jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/dom';
import { render as preactRender } from 'preact';
import { clearToolUsedDedupe } from '../common/analytics-events';

jest.mock('../common/notification-manager', () => ({
  NotificationManager: { show: jest.fn() }
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
  mountToolShell: jest.fn()
}));

jest.mock('../common/clear-button/ClearButton', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    updateVisibility: jest.fn(),
    disconnect: jest.fn()
  }))
}));

jest.mock('../common/clipboard', () => ({
  copyTextToClipboard: jest.fn(() => Promise.resolve())
}));

import { TextAnalyzerToolUI } from './script';

const SECRET = 'user-secret-prose-UNIQUE-94 appears once.';

function installGtag() {
  const gtag = jest.fn();
  window.gtag = gtag;
  return gtag;
}

function toolUsedCalls(gtag) {
  return gtag.mock.calls.filter((call) => call[0] === 'event' && call[1] === 'tool_used');
}

describe('Text Analyzer tool_used', () => {
  let gtag;

  beforeEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    gtag = installGtag();
    document.body.innerHTML = '<div id="text-analyzer-app"></div>';
    new TextAnalyzerToolUI();
  });

  afterEach(() => {
    const root = document.getElementById('text-analyzer-app');
    if (root) preactRender(null, root);
    clearToolUsedDedupe();
    delete window.gtag;
    document.body.innerHTML = '';
  });

  function typeText(value) {
    const input = document.getElementById('textInput');
    fireEvent.input(input, { target: { value } });
  }

  it('does not fire for the empty initial document', async () => {
    await Promise.resolve();
    await Promise.resolve();
    expect(toolUsedCalls(gtag)).toHaveLength(0);
  });

  it('fires one analyze event and omits the prose', async () => {
    typeText(SECRET);
    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toEqual({
      tool_id: 'text-analyzer',
      action: 'analyze',
      trigger: 'user',
      outcome: 'success',
      input_size_bucket: '<1KB'
    });
    expect(JSON.stringify(calls)).not.toContain('user-secret-prose-UNIQUE-94');
  });

  it('collapses keystrokes inside the shared dedupe window', async () => {
    typeText('Hello');
    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
    typeText(SECRET);
    await Promise.resolve();
    await Promise.resolve();

    expect(toolUsedCalls(gtag)).toHaveLength(1);
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('user-secret-prose-UNIQUE-94');
  });

  it('tags Load Sample as sample and omits the sample text', async () => {
    fireEvent.click(document.getElementById('load-sample'));
    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2].trigger).toBe('sample');
    expect(calls[0][2].action).toBe('analyze');
    expect(calls[0][2].outcome).toBe('success');
    expect(JSON.stringify(calls)).not.toContain('sample text for analysis');
  });
});
