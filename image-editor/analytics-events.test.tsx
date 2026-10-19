import { fireEvent, waitFor } from '@testing-library/dom';
import { render as preactRender } from 'preact';
import { clearToolUsedDedupe } from '../common/analytics-events';

jest.mock('../common/DownloadManager', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    downloadFile: jest.fn()
  }))
}));

jest.mock('../common/notification-manager', () => ({
  NotificationManager: { show: jest.fn() }
}));

jest.mock('../common/drop-zone', () => ({
  describeLoadedFile: jest.requireActual('../common/drop-zone').describeLoadedFile,
  registerDropZone: jest.fn(() => jest.fn()),
  registerFileInput: jest.fn(() => jest.fn())
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
  mountToolShell: jest.fn()
}));

import { ImageEditorToolUI } from './script';

function installGtag() {
  const gtag = jest.fn();
  (window as unknown as { gtag?: jest.Mock }).gtag = gtag;
  return gtag;
}

function toolUsedCalls(gtag: jest.Mock) {
  return gtag.mock.calls.filter((call) => call[0] === 'event' && call[1] === 'tool_used');
}

function makeContext() {
  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'createLinearGradient') {
        return () => ({ addColorStop() { /* sample paint */ } });
      }
      if (!(prop in target)) {
        (target as Record<string | symbol, unknown>)[prop] = jest.fn();
      }
      return (target as Record<string | symbol, unknown>)[prop];
    },
    set(target, prop, value) {
      (target as Record<string | symbol, unknown>)[prop] = value;
      return true;
    }
  });
}

describe('Image Editor tool_used', () => {
  beforeEach(() => {
    clearToolUsedDedupe();
    delete (window as unknown as { gtag?: jest.Mock }).gtag;
    document.body.innerHTML = '<div id="image-editor-app"></div>';

    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: jest.fn(() => makeContext())
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: jest.fn((callback: (blob: Blob | null) => void) => {
        callback(new Blob([new Uint8Array(1000)], { type: 'image/png' }));
      })
    });
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = jest.fn(async () => ({
      width: 1200,
      height: 800,
      close: jest.fn()
    }));
  });

  afterEach(() => {
    clearToolUsedDedupe();
    delete (window as unknown as { gtag?: jest.Mock }).gtag;
    const root = document.getElementById('image-editor-app');
    if (root) preactRender(null, root);
    document.body.innerHTML = '';
  });

  async function loadSample() {
    new ImageEditorToolUI();
    fireEvent.click(document.getElementById('image-editor-load-sample')!);
    await waitFor(() => expect(document.getElementById('image-editor-info')).not.toBeNull());
  }

  it('does not fire when export is clicked with no image', () => {
    const gtag = installGtag();
    new ImageEditorToolUI();
    fireEvent.click(document.getElementById('image-editor-export')!);
    expect(toolUsedCalls(gtag)).toHaveLength(0);
  });

  it('fires one export event with the format and omits the image name', async () => {
    const gtag = installGtag();
    await loadSample();
    fireEvent.click(document.getElementById('image-editor-export')!);

    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
    expect(toolUsedCalls(gtag)[0][2]).toEqual({
      tool_id: 'image-editor',
      action: 'export',
      trigger: 'user',
      outcome: 'success',
      format: 'png',
      input_size_bucket: '<1KB'
    });
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('sample-image.png');
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('Sample image');
  });

  it('sends jpeg when that format is selected', async () => {
    const gtag = installGtag();
    await loadSample();
    fireEvent.click(document.getElementById('image-editor-format-jpeg')!);
    await waitFor(() => expect(document.getElementById('image-editor-format-jpeg')?.getAttribute('aria-pressed')).toBe('true'));
    clearToolUsedDedupe();
    fireEvent.click(document.getElementById('image-editor-export')!);

    await waitFor(() => expect(toolUsedCalls(gtag).some((call) => call[2].format === 'jpeg')).toBe(true));
    const exported = toolUsedCalls(gtag).filter((call) => call[2].action === 'export');
    expect(exported[exported.length - 1][2].format).toBe('jpeg');
    expect(exported[exported.length - 1][2].outcome).toBe('success');
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('sample-image');
  });

  it('tags a failed export as error and still sends the format', async () => {
    const gtag = installGtag();
    await loadSample();
    (HTMLCanvasElement.prototype.toBlob as jest.Mock).mockImplementation((callback: (blob: Blob | null) => void) => {
      callback(null);
    });
    fireEvent.click(document.getElementById('image-editor-export')!);

    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
    expect(toolUsedCalls(gtag)[0][2].action).toBe('export');
    expect(toolUsedCalls(gtag)[0][2].outcome).toBe('error');
    expect(toolUsedCalls(gtag)[0][2].format).toBe('png');
    expect(toolUsedCalls(gtag)[0][2].input_size_bucket).toBe('<1KB');
  });

  it('buckets the loaded image size, not the encoded export', async () => {
    const gtag = installGtag();
    await loadSample();
    (HTMLCanvasElement.prototype.toBlob as jest.Mock).mockImplementation((callback: (blob: Blob | null) => void) => {
      callback(new Blob([new Uint8Array(200 * 1024)], { type: 'image/png' }));
    });
    fireEvent.click(document.getElementById('image-editor-export')!);

    await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
    expect(toolUsedCalls(gtag)[0][2].input_size_bucket).toBe('<1KB');
    expect(toolUsedCalls(gtag)[0][2].action).toBe('export');
    expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('sample-image');
  });
});
