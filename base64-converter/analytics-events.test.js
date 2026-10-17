import { clearToolUsedDedupe } from '../common/analytics-events';

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

jest.mock('../common/copy-button/CopyButton', () => {
  return jest.fn().mockImplementation(() => ({
    copyContent: jest.fn(),
    updateVisibility: jest.fn(),
    forceUpdateVisibility: jest.fn(),
    isDisabled: jest.fn().mockReturnValue(false),
    wrapper: { hidden: false },
    disconnect: jest.fn()
  }));
});

import './script';

const SECRET = 'user-secret-base64-plaintext-UNIQUE-93';

const DOM = `
  <input type="file" id="base64converter-file" />
  <textarea id="base64converter-input"></textarea>
  <select id="base64converter-mode">
    <option value="auto" selected>Auto</option>
    <option value="encode">Encode</option>
    <option value="decode">Decode</option>
  </select>
  <select id="base64converter-encoding">
    <option value="utf8" selected>UTF-8</option>
  </select>
  <div id="base64converter-result"></div>
  <img id="base64converter-image-preview" alt="Decoded image preview" hidden />
  <span id="base64converter-status"></span>
  <button id="base64converter-convert"></button>
  <button id="base64converter-load-sample"></button>
  <button id="base64converter-swap" disabled></button>
  <button id="base64converter-download-decoded" disabled></button>
`;

function installGtag() {
  const gtag = jest.fn();
  window.gtag = gtag;
  return gtag;
}

function toolUsedCalls(gtag) {
  return gtag.mock.calls.filter((call) => call[0] === 'event' && call[1] === 'tool_used');
}

describe('Base64 Converter tool_used', () => {
  beforeEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    document.body.innerHTML = DOM;
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  afterEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
  });

  it('fires exactly one encode event and omits the plaintext', () => {
    const gtag = installGtag();
    const converter = window.base64ConverterInstance;

    converter.elements.mode.value = 'encode';
    converter.elements.input.value = SECRET;
    converter.elements.convertButton.click();

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toEqual({
      tool_id: 'base64-converter',
      action: 'encode',
      trigger: 'user',
      outcome: 'success',
      input_size_bucket: '<1KB'
    });
    expect(JSON.stringify(calls)).not.toContain(SECRET);
  });

  it('fires exactly one decode event and omits the payload and plaintext', () => {
    const gtag = installGtag();
    const converter = window.base64ConverterInstance;
    const payload = Buffer.from(SECRET, 'utf8').toString('base64');

    converter.elements.mode.value = 'decode';
    converter.elements.input.value = payload;
    converter.elements.convertButton.click();

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toEqual({
      tool_id: 'base64-converter',
      action: 'decode',
      trigger: 'user',
      outcome: 'success',
      input_size_bucket: '<1KB'
    });
    expect(JSON.stringify(calls)).not.toContain(SECRET);
    expect(JSON.stringify(calls)).not.toContain(payload);
  });

  it('does not throw or log when gtag is absent', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const converter = window.base64ConverterInstance;

    converter.elements.mode.value = 'encode';
    converter.elements.input.value = SECRET;
    expect(() => converter.elements.convertButton.click()).not.toThrow();

    expect(window.gtag).toBeUndefined();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('tags a failed decode as error and still sends the event', () => {
    const gtag = installGtag();
    const converter = window.base64ConverterInstance;
    const invalid = '!!!not-base64-UNIQUE-93!!!';

    converter.elements.mode.value = 'decode';
    converter.elements.input.value = invalid;
    converter.elements.convertButton.click();

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2].action).toBe('decode');
    expect(calls[0][2].trigger).toBe('user');
    expect(calls[0][2].outcome).toBe('error');
    expect(JSON.stringify(calls)).not.toContain(invalid);
  });

  it('tags Load Sample as sample and still sends the encode event', () => {
    const gtag = installGtag();

    document.getElementById('base64converter-load-sample').click();

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2].trigger).toBe('sample');
    expect(calls[0][2].outcome).toBe('success');
    expect(calls[0][2].action).toBe('encode');
    expect(calls[0][2].tool_id).toBe('base64-converter');
  });
});
