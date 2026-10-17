import { fireEvent } from '@testing-library/dom';
import { clearToolUsedDedupe } from '../common/analytics-events';

jest.mock('../common/notification-manager', () => ({
  NotificationManager: {
    show: jest.fn()
  }
}));

jest.mock('../common/scheduler-utils', () => ({
  scheduleTask: jest.fn(() => Promise.resolve()),
  nextFrame: jest.fn(() => Promise.resolve())
}));

import { JSONFormatterToolUI } from './script';

const SECRET = 'user-secret-json-text-UNIQUE-93';
const SCHEMA_SECRET = 'user-secret-schema-text-UNIQUE-93';

function installGtag() {
  const gtag = jest.fn();
  window.gtag = gtag;
  return gtag;
}

function toolUsedCalls(gtag) {
  return gtag.mock.calls.filter((call) => call[0] === 'event' && call[1] === 'tool_used');
}

describe('JSON Formatter tool_used', () => {
  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    document.body.innerHTML = '<div id="json-formatter-app"></div>';
  });

  afterEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
  });

  function mount() {
    const ui = new JSONFormatterToolUI();
    ui.formatter.lazySchemaRunner = {
      run: jest.fn().mockResolvedValue({ outcome: 'valid', draft: 'draft-07' }),
      terminate: jest.fn()
    };
    return ui;
  }

  it('fires one format event and omits the JSON text', async () => {
    const gtag = installGtag();
    mount();

    document.querySelector('.jsonf-input-textarea').value = `{"note":"${SECRET}"}`;
    fireEvent.click(document.getElementById('formatJsonBtn'));
    await flush();

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toEqual({
      tool_id: 'json-formatter',
      action: 'format',
      input_size_bucket: '<1KB'
    });
    expect(JSON.stringify(calls)).not.toContain(SECRET);
  });

  it('fires one minify event when indentation is Minified', async () => {
    const gtag = installGtag();
    mount();

    document.getElementById('indentSelect').value = 'minify';
    document.querySelector('.jsonf-input-textarea').value = `{"note":"${SECRET}"}`;
    fireEvent.click(document.getElementById('formatJsonBtn'));
    await flush();

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2].action).toBe('minify');
    expect(calls[0][2].tool_id).toBe('json-formatter');
    expect(JSON.stringify(calls)).not.toContain(SECRET);
  });

  it('fires one validate event when a schema is present', async () => {
    const gtag = installGtag();
    mount();

    document.querySelector('.jsonf-input-textarea').value = `{"note":"${SECRET}"}`;
    document.getElementById('jsonSchemaInput').value = `{"type":"object","title":"${SCHEMA_SECRET}"}`;
    fireEvent.click(document.getElementById('formatJsonBtn'));
    await flush();

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2].action).toBe('validate');
    expect(calls[0][2].tool_id).toBe('json-formatter');
    expect(JSON.stringify(calls)).not.toContain(SECRET);
    expect(JSON.stringify(calls)).not.toContain(SCHEMA_SECRET);
  });

  it('does not throw or log when gtag is absent', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    mount();

    document.querySelector('.jsonf-input-textarea').value = `{"note":"${SECRET}"}`;
    expect(() => fireEvent.click(document.getElementById('formatJsonBtn'))).not.toThrow();
    await flush();

    expect(window.gtag).toBeUndefined();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
