import { jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/dom';
import { clearToolUsedDedupe } from '../common/analytics-events';
import { buildShareHash } from './share-url';

jest.mock('../common/notification-manager', () => ({
  NotificationManager: { show: jest.fn() }
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

import { DataFormatConverterUI } from './script';

const SECRET = '{"note":"user-secret-convert-UNIQUE-94"}';

function installGtag() {
  const gtag = jest.fn();
  window.gtag = gtag;
  return gtag;
}

function toolUsedCalls(gtag) {
  return gtag.mock.calls.filter((call) => call[0] === 'event' && call[1] === 'tool_used');
}

function mount() {
  document.body.innerHTML = '<div id="data-format-converter-app"></div>';
  new DataFormatConverterUI();
}

describe('Data Format Converter tool_used', () => {
  beforeEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    window.location.hash = '';
  });

  afterEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    window.location.hash = '';
    document.body.innerHTML = '';
  });

  it('fires one convert event with from and to and omits the document', async () => {
    const gtag = installGtag();
    mount();
    const yaml = document.querySelector('.output-section [data-format="yaml"]');
    fireEvent.click(yaml);
    await waitFor(() => expect(yaml.getAttribute('aria-pressed')).toBe('true'));
    fireEvent.change(document.getElementById('autoConvert'), { target: { checked: false } });
    const input = document.getElementById('inputText');
    fireEvent.input(input, { target: { value: SECRET } });
    await waitFor(() => expect(input.value).toBe(SECRET));
    fireEvent.click(document.getElementById('convertBtn'));

    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
    expect(toolUsedCalls(gtag)[0][2]).toEqual({
      tool_id: 'data-format-converter',
      action: 'convert',
      trigger: 'user',
      outcome: 'success',
      from: 'json',
      to: 'yaml',
      input_size_bucket: '<1KB'
    });
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('user-secret-convert-UNIQUE-94');
  });

  it('tags a failed conversion as error and omits the input', async () => {
    const gtag = installGtag();
    mount();
    fireEvent.change(document.getElementById('autoConvert'), { target: { checked: false } });
    const invalid = '{not-json-UNIQUE-94';
    const input = document.getElementById('inputText');
    fireEvent.input(input, { target: { value: invalid } });
    await waitFor(() => expect(input.value).toBe(invalid));
    fireEvent.click(document.getElementById('convertBtn'));

    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
    expect(toolUsedCalls(gtag)[0][2].action).toBe('convert');
    expect(toolUsedCalls(gtag)[0][2].outcome).toBe('error');
    expect(toolUsedCalls(gtag)[0][2].from).toBe('json');
    expect(toolUsedCalls(gtag)[0][2].to).toBe('xml');
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('not-json-UNIQUE-94');
  });

  it('tags Load Sample as sample', async () => {
    const gtag = installGtag();
    mount();
    fireEvent.click(document.getElementById('loadSampleBtn'));

    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
    expect(toolUsedCalls(gtag)[0][2].trigger).toBe('sample');
    expect(toolUsedCalls(gtag)[0][2].action).toBe('convert');
    expect(toolUsedCalls(gtag)[0][2].outcome).toBe('success');
    expect(toolUsedCalls(gtag)[0][2].from).toBe('json');
    expect(toolUsedCalls(gtag)[0][2].to).toBe('xml');
  });

  it('tags a shared link as share and omits the payload', async () => {
    const gtag = installGtag();
    window.location.hash = `#${buildShareHash({
      input: SECRET,
      inputFormat: 'json',
      outputFormat: 'properties'
    })}`;
    mount();

    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
    expect(toolUsedCalls(gtag)[0][2].trigger).toBe('share');
    expect(toolUsedCalls(gtag)[0][2].action).toBe('convert');
    expect(toolUsedCalls(gtag)[0][2].outcome).toBe('success');
    expect(toolUsedCalls(gtag)[0][2].from).toBe('json');
    expect(toolUsedCalls(gtag)[0][2].to).toBe('properties');
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('user-secret-convert-UNIQUE-94');
  });

  it('collapses auto-convert keystrokes inside the shared dedupe window', async () => {
    jest.useFakeTimers();
    const gtag = installGtag();
    mount();
    const input = document.getElementById('inputText');

    input.value = '{"a":1}';
    fireEvent.input(input, { target: { value: input.value } });
    jest.advanceTimersByTime(500);
    input.value = '{"a":1,"secret":"user-secret-convert-UNIQUE-94"}';
    fireEvent.input(input, { target: { value: input.value } });
    jest.advanceTimersByTime(500);

    expect(toolUsedCalls(gtag)).toHaveLength(1);
    expect(toolUsedCalls(gtag)[0][2].action).toBe('convert');
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('user-secret-convert-UNIQUE-94');
    jest.useRealTimers();
  });
});
