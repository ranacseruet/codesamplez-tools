import { jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/dom';
import { clearToolUsedDedupe } from '../common/analytics-events';

jest.mock('qrcode', () => ({
  __esModule: true,
  default: {
    toCanvas: jest.fn((canvas, text, options, callback) => callback(null))
  }
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

jest.mock('../common/app-shell/mountToolShell', () => ({
  mountToolShell: jest.fn()
}));

jest.mock('../common/notification-manager', () => ({
  NotificationManager: { show: jest.fn() }
}));

import QRCode from 'qrcode';
import { QRCodeGeneratorToolUI } from './script';

const SECRET = 'https://user-secret-qr-UNIQUE-94.example';

function installGtag() {
  const gtag = jest.fn();
  window.gtag = gtag;
  return gtag;
}

function toolUsedCalls(gtag) {
  return gtag.mock.calls.filter((call) => call[0] === 'event' && call[1] === 'tool_used');
}

describe('QR Code Generator tool_used', () => {
  let gtag;

  beforeEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    gtag = installGtag();
    QRCode.toCanvas.mockImplementation((canvas, text, options, callback) => callback(null));
    document.body.innerHTML = '<div id="qr-code-generator-app"></div>';
    new QRCodeGeneratorToolUI();
  });

  afterEach(() => {
    clearToolUsedDedupe();
    delete window.gtag;
    document.body.innerHTML = '';
  });

  it('does not count the initial automatic render', async () => {
    await waitFor(() => expect(QRCode.toCanvas).toHaveBeenCalled());
    expect(toolUsedCalls(gtag)).toHaveLength(0);
  });

  it('fires one generate event after the user types and omits the text', async () => {
    await waitFor(() => expect(QRCode.toCanvas).toHaveBeenCalled());
    QRCode.toCanvas.mockClear();
    const input = document.getElementById('qr-text');
    fireEvent.input(input, { target: { value: SECRET } });
    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));

    const calls = toolUsedCalls(gtag);
    expect(calls[0][2]).toEqual({
      tool_id: 'qr-code-generator',
      action: 'generate',
      trigger: 'user',
      outcome: 'success',
      input_size_bucket: '<1KB'
    });
    expect(JSON.stringify(calls)).not.toContain('user-secret-qr-UNIQUE-94');
  });

  it('collapses further keystrokes inside the shared dedupe window', async () => {
    const input = document.getElementById('qr-text');
    fireEvent.input(input, { target: { value: 'https://example.com/a' } });
    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
    fireEvent.input(input, { target: { value: SECRET } });
    await waitFor(() => expect(QRCode.toCanvas.mock.calls.some((call) => call[1] === SECRET)).toBe(true));

    expect(toolUsedCalls(gtag)).toHaveLength(1);
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('user-secret-qr-UNIQUE-94');
  });

  it('tags a generation failure as error and omits the text', async () => {
    await waitFor(() => expect(QRCode.toCanvas).toHaveBeenCalled());
    QRCode.toCanvas.mockImplementation((canvas, text, options, callback) => {
      callback(new Error('too long ' + text));
    });
    const input = document.getElementById('qr-text');
    fireEvent.input(input, { target: { value: SECRET } });
    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));

    const calls = toolUsedCalls(gtag);
    expect(calls[0][2].outcome).toBe('error');
    expect(calls[0][2].action).toBe('generate');
    expect(JSON.stringify(calls)).not.toContain('user-secret-qr-UNIQUE-94');
  });

  it('tags Load Sample on the default URL as sample', () => {
    fireEvent.click(document.getElementById('qr-load-sample'));

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2].trigger).toBe('sample');
    expect(calls[0][2].action).toBe('generate');
    expect(calls[0][2].outcome).toBe('success');
    expect(JSON.stringify(calls)).not.toContain('codesamplez.com');
  });
});
