import { fireEvent, screen } from '@testing-library/dom';
import { render } from 'preact';
import { clearToolUsedDedupe } from '../common/analytics-events';

jest.mock('../common/app-shell/mountToolShell', () => ({
  mountToolShell: jest.fn()
}));

jest.mock('../common/drop-zone', () => ({
  registerDropZone: jest.fn(() => jest.fn()),
  registerFileInput: jest.fn(() => jest.fn())
}));

jest.mock('../common/shortcut-utils', () => ({
  isEditableTarget: jest.fn(() => false),
  registerPrimaryActionShortcut: jest.fn(() => jest.fn())
}));

jest.mock('../common/notification-manager', () => ({
  NotificationManager: { show: jest.fn() }
}));

jest.mock('../common/clipboard', () => ({
  copyTextToClipboard: jest.fn(() => Promise.resolve())
}));

jest.mock('../common/DownloadManager', () => jest.fn().mockImplementation(() => ({
  downloadFile: jest.fn()
})));

import { JsonEditorApp } from './script';

const SECRET = '{"note":"user-secret-json-UNIQUE-94"}';

function installGtag() {
  const gtag = jest.fn();
  (window as unknown as { gtag?: jest.Mock }).gtag = gtag;
  return gtag;
}

function toolUsedCalls(gtag: jest.Mock) {
  return gtag.mock.calls.filter((call) => call[0] === 'event' && call[1] === 'tool_used');
}

function mountEditor() {
  document.body.innerHTML = '<div id="root"></div>';
  render(<JsonEditorApp />, document.getElementById('root')!);
}

function flushRender(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function importJson(input: string) {
  const textarea = document.getElementById('json-editor-import-input') as HTMLTextAreaElement;
  textarea.value = input;
  fireEvent.input(textarea, { target: { value: input } });
  textarea.value = input;
  (screen.getByRole('button', { name: /Import JSON/ }) as HTMLButtonElement).click();
  await flushRender();
}

describe('JSON Editor tool_used', () => {
  beforeEach(() => {
    clearToolUsedDedupe();
    delete (window as unknown as { gtag?: jest.Mock }).gtag;
    mountEditor();
  });

  afterEach(() => {
    clearToolUsedDedupe();
    delete (window as unknown as { gtag?: jest.Mock }).gtag;
    const root = document.getElementById('root');
    if (root) render(null, root);
    document.body.innerHTML = '';
  });

  it('fires one import event and omits the document', async () => {
    const gtag = installGtag();
    await importJson(SECRET);

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toEqual({
      tool_id: 'json-editor',
      action: 'import',
      trigger: 'user',
      outcome: 'success',
      input_size_bucket: '<1KB'
    });
    expect(JSON.stringify(calls)).not.toContain('user-secret-json-UNIQUE-94');
  });

  it('tags a failed import as error and omits the text', async () => {
    const gtag = installGtag();
    const invalid = '{not-json-UNIQUE-94';
    await importJson(invalid);

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2].action).toBe('import');
    expect(calls[0][2].outcome).toBe('error');
    expect(JSON.stringify(calls)).not.toContain('not-json-UNIQUE-94');
  });

  it('tags Load Sample as sample', async () => {
    const gtag = installGtag();
    (screen.getByRole('button', { name: 'Load Sample' }) as HTMLButtonElement).click();
    await flushRender();

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(1);
    expect(calls[0][2].action).toBe('import');
    expect(calls[0][2].trigger).toBe('sample');
    expect(calls[0][2].outcome).toBe('success');
    expect(JSON.stringify(calls)).not.toContain('CodeSamplez');
  });

  it('does not fire edit on each keystroke, and omits the committed value', async () => {
    const gtag = installGtag();
    await importJson('{"name":"Ada"}');
    expect(toolUsedCalls(gtag)).toHaveLength(1);

    const value = document.querySelector('.jsone-value-input') as HTMLInputElement;
    value.value = 'user-secret-edit-UNIQUE-94';
    fireEvent.input(value, { target: { value: value.value } });
    await flushRender();
    expect(toolUsedCalls(gtag)).toHaveLength(1);

    fireEvent.blur(value);
    await flushRender();

    const calls = toolUsedCalls(gtag);
    expect(calls).toHaveLength(2);
    expect(calls[1][2].action).toBe('edit');
    expect(calls[1][2].trigger).toBe('user');
    expect(calls[1][2].outcome).toBe('success');
    expect(JSON.stringify(calls)).not.toContain('user-secret-edit-UNIQUE-94');
    expect(JSON.stringify(calls)).not.toContain('Ada');
  });

  it('collapses committed edits inside the shared 2s dedupe window', async () => {
    const gtag = installGtag();
    await importJson('{"name":"Ada"}');
    fireEvent.click(screen.getByRole('button', { name: 'Add property' }));
    await flushRender();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add property' })[0]);
    await flushRender();

    const edits = toolUsedCalls(gtag).filter((call) => call[2].action === 'edit');
    expect(edits).toHaveLength(1);
  });

  it('fires one export on download and omits the document', async () => {
    const gtag = installGtag();
    await importJson(SECRET);
    clearToolUsedDedupe();
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await flushRender();

    const calls = toolUsedCalls(gtag);
    const exports = calls.filter((call) => call[2].action === 'export');
    expect(exports).toHaveLength(1);
    expect(exports[0][2].trigger).toBe('user');
    expect(exports[0][2].outcome).toBe('success');
    expect(exports[0][2].tool_id).toBe('json-editor');
    expect(JSON.stringify(calls)).not.toContain('user-secret-json-UNIQUE-94');
    expect(JSON.stringify(calls)).not.toContain('edited.json');
  });

  it('does not fire tool_used for copy', async () => {
    const gtag = installGtag();
    await importJson('{"name":"Ada"}');
    const before = toolUsedCalls(gtag).length;
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await flushRender();
    expect(toolUsedCalls(gtag)).toHaveLength(before);
  });
});
