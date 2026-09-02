import { fireEvent, screen, waitFor } from '@testing-library/dom';
import { render } from 'preact';

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

const mockDownloadFile = jest.fn();
jest.mock('../common/DownloadManager', () => jest.fn().mockImplementation(() => ({ downloadFile: mockDownloadFile })));

import { JsonEditorApp, JSONEditorToolUI } from './script';
import * as jsonEditorCore from './json-editor-core';
import { copyTextToClipboard } from '../common/clipboard';
import { registerDropZone, registerFileInput } from '../common/drop-zone';
import { NotificationManager } from '../common/notification-manager';

function mountEditor() {
  document.body.innerHTML = '<div id="root"></div>';
  render(<JsonEditorApp />, document.getElementById('root'));
}

function importJson(input) {
  const textarea = document.getElementById('json-editor-import-input');
  textarea.value = input;
  fireEvent.input(textarea, { target: { value: input } });
  // Keep the DOM value explicit for Preact's controlled textarea under JSDOM;
  // the production button also reads the current ref value before importing.
  textarea.value = input;
  screen.getByRole('button', { name: /Import JSON/ }).click();
  return flushRender();
}

function preview() {
  return document.getElementById('json-editor-preview').value;
}

function flushRender() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('JSON Editor runtime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDownloadFile.mockClear();
    mountEditor();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('starts with an empty object and a generated preview', () => {
    expect(preview()).toBe('{}');
    expect(document.querySelector('.jsone-node--object')).not.toBeNull();
    expect(document.getElementById('json-editor-import-input')).not.toBeNull();
    expect(document.querySelector('.jsone-import-disclosure').open).toBe(false);
  });

  test('imports valid JSON and preserves the imported source in the panel', async () => {
    await importJson('{"name":"Ada","active":true}');

    expect(preview()).toContain('"name": "Ada"');
    expect(preview()).toContain('"active": true');
    expect(document.getElementById('json-editor-import-input').value).toBe('{"name":"Ada","active":true}');
    expect(document.querySelector('.jsone-import-error')).toBeNull();
  });

  test('keeps the current document when an import is invalid and reports location', async () => {
    await importJson('{"name":"Ada"}');
    await importJson('{"name" "Grace"}');

    expect(preview()).toContain('"name": "Ada"');
    expect(document.querySelector('.jsone-import-error').textContent).toContain('line 1');
    expect(document.querySelector('.jsone-import-error').textContent).toContain('column');
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
    expect(document.getElementById('json-editor-import-input').getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById('json-editor-import-input').getAttribute('aria-describedby')).toContain('json-editor-import-error');
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('.jsone-import-error')));
  });

  test('shows array indices instead of the root label for array children', async () => {
    await importJson('{"items":["first","second"]}');

    expect([...document.querySelectorAll('.jsone-array-index-label')].map((label) => label.textContent)).toEqual(['[0]', '[1]']);
    expect([...document.querySelectorAll('.jsone-array-index-label')].some((label) => label.textContent === 'root')).toBe(false);
  });

  test('commits inline key and value edits on blur', async () => {
    await importJson('{"name":"Ada","age":36}');

    const key = document.querySelector('.jsone-key-input');
    key.value = 'fullName';
    fireEvent.input(key, { target: { value: 'fullName' } });
    await flushRender();
    fireEvent.blur(key);
    await flushRender();

    const value = document.querySelector('.jsone-value-input');
    value.value = 'Grace';
    fireEvent.input(value, { target: { value: 'Grace' } });
    await flushRender();
    fireEvent.blur(value);
    await flushRender();

    expect(preview()).toContain('"fullName": "Grace"');
    expect(preview()).toContain('"age": 36');
  });

  test('restores Escape edits and commits boolean select changes', async () => {
    await importJson('{"name":"Ada","active":true}');

    const name = document.querySelector('.jsone-value-input');
    fireEvent.blur(name);
    name.value = 'Grace';
    fireEvent.input(name, { target: { value: 'Grace' } });
    await flushRender();
    fireEvent.keyDown(name, { key: 'Escape', code: 'Escape' });
    await flushRender();
    expect(document.querySelector('.jsone-value-input').value).toBe('Ada');
    expect(preview()).toContain('"name": "Ada"');

    const active = screen.getByRole('combobox', { name: 'Value for active' });
    fireEvent.change(active, { target: { value: 'false' } });
    await flushRender();
    expect(preview()).toContain('"active": false');
  });

  test('records an Enter edit once even when blur follows it', async () => {
    await importJson('{"name":"Ada"}');

    const value = document.querySelector('.jsone-value-input');
    value.value = 'Grace';
    fireEvent.input(value, { target: { value: 'Grace' } });
    await flushRender();
    fireEvent.keyDown(value, { key: 'Enter', code: 'Enter' });
    fireEvent.blur(value);
    await flushRender();

    expect(preview()).toContain('"name": "Grace"');
    fireEvent.click(screen.getByRole('button', { name: 'Undo last change' }));
    await flushRender();
    expect(preview()).toContain('"name": "Ada"');
  });

  test('rejects invalid numbers and duplicate keys without corrupting output', async () => {
    await importJson('{"name":"Ada","age":36}');

    const number = document.querySelector('.jsone-number-input');
    number.value = '01';
    fireEvent.input(number, { target: { value: '01' } });
    await flushRender();
    fireEvent.blur(number);
    await flushRender();
    expect(preview()).toContain('"age": 36');
    expect(document.querySelector('.jsone-field-error').textContent).toContain('valid JSON number');

    fireEvent.click(screen.getByRole('button', { name: 'Add property' }));
    await flushRender();
    expect(document.querySelector('.jsone-number-input').value).toBe('36');
    expect(document.querySelector('.jsone-field-error')).toBeNull();

    const keys = document.querySelectorAll('.jsone-key-input');
    keys[1].value = 'name';
    fireEvent.input(keys[1], { target: { value: 'name' } });
    await flushRender();
    fireEvent.blur(keys[1]);
    await flushRender();
    expect(preview()).toContain('"name": "Ada"');
    expect(document.querySelectorAll('.jsone-field-error').length).toBeGreaterThanOrEqual(1);
    expect(document.querySelectorAll('.jsone-value-input[aria-invalid="true"]').length).toBe(0);
  });

  test('adds, duplicates, reorders, and deletes nodes', async () => {
    await importJson('{"a":1,"b":2}');

    fireEvent.click(screen.getByRole('button', { name: 'Add property' }));
    await flushRender();
    expect(preview()).toContain('"newProperty": null');

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate a' }));
    await flushRender();
    expect(preview()).toContain('"aCopy": 1');

    fireEvent.click(screen.getByRole('button', { name: 'Move aCopy up' }));
    await flushRender();
    expect(preview().indexOf('"aCopy"')).toBeLessThan(preview().indexOf('"a"'));

    fireEvent.click(screen.getByRole('button', { name: 'Move aCopy down' }));
    await flushRender();
    expect(preview().indexOf('"aCopy"')).toBeGreaterThan(preview().indexOf('"a"'));

    fireEvent.click(screen.getByRole('button', { name: 'Delete aCopy' }));
    await flushRender();
    expect(preview()).not.toContain('"aCopy"');
  });

  test('changes types and confirms destructive container changes', async () => {
    await importJson('{"config":{"enabled":true}}');
    const typeSelect = screen.getByRole('combobox', { name: 'Type for config' });
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);

    fireEvent.change(typeSelect, { target: { value: 'array' } });
    await flushRender();
    expect(preview()).toContain('"enabled": true');
    expect(typeSelect.value).toBe('object');
    expect(confirm).toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.change(typeSelect, { target: { value: 'array' } });
    await flushRender();
    expect(preview()).toContain('"config": []');
    confirm.mockRestore();
  });

  test('handles registered drop-zone and file-input imports', async () => {
    await flushRender();

    expect(registerDropZone.mock.calls[0][0]).toBe(document.querySelector('.jsone-import-panel'));
    const dropOptions = registerDropZone.mock.calls[0][1];
    dropOptions.onText('{"source":"drop"}', new File(['{"source":"drop"}'], 'drop.json', { type: 'application/json' }));
    await flushRender();
    expect(preview()).toContain('"source": "drop"');

    const fileOptions = registerFileInput.mock.calls[0][1];
    fileOptions.onText('{"source":"file"}', new File(['{"source":"file"}'], 'file.json', { type: 'application/json' }));
    await flushRender();
    expect(preview()).toContain('"source": "file"');
    expect(document.getElementById('json-editor-import-input').value).toBe('{"source":"file"}');
    dropOptions.onError('Drop failed.');
    expect(NotificationManager.show).toHaveBeenCalledWith('Drop failed.', 3500, { type: 'error' });
  });

  test('focuses a newly added array item and clears the focus target', async () => {
    await importJson('{"items":[]}');

    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    await flushRender();

    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Type for [0]' }));
  });

  test('supports undo, redo, expand/collapse, sample loading, and clear', async () => {
    await importJson('{"a":{"b":1}}');
    expect(document.querySelectorAll('.jsone-node')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse root' }));
    await flushRender();
    expect(document.querySelector('[aria-label="Expand root"]')).not.toBeNull();
    expect(document.querySelectorAll('.jsone-node')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Expand root' }));
    await flushRender();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    await flushRender();
    expect(document.querySelectorAll('.jsone-node')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    await flushRender();

    const value = document.querySelector('.jsone-value-input');
    value.value = '2';
    fireEvent.input(value, { target: { value: '2' } });
    await flushRender();
    fireEvent.blur(value);
    await flushRender();
    expect(preview()).toContain(': 2');
    fireEvent.click(screen.getByRole('button', { name: 'Undo last change' }));
    await flushRender();
    expect(preview()).toContain(': 1');
    fireEvent.click(screen.getByRole('button', { name: 'Redo last undone change' }));
    await flushRender();
    expect(preview()).toContain(': 2');

    fireEvent.click(screen.getByRole('button', { name: 'Load Sample' }));
    await flushRender();
    expect(preview()).toContain('CodeSamplez');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await flushRender();
    expect(preview()).toBe('{}');
  });

  test('collapses nested array descendants without leaving their rows mounted', async () => {
    await importJson('{"items":[{"value":1}]}');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    await flushRender();

    expect(document.querySelectorAll('.jsone-node')).toHaveLength(1);
  });

  test('mounts from the DOMContentLoaded entry point and cleans up listeners', async () => {
    document.body.innerHTML = '<div id="json-editor-app"></div>';
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushRender();

    const root = document.getElementById('json-editor-app');
    expect(root.querySelector('#json-editor-tool')).not.toBeNull();
    render(null, root);
  });

  test('reports parser and serializer failures without replacing the document', async () => {
    const parser = jest.spyOn(jsonEditorCore, 'parseJsonEditorInput').mockImplementation(() => {
      throw 'Parser failed.';
    });
    try {
      await importJson('{"name":"Ada"}');
      expect(document.querySelector('.jsone-import-error').textContent).toContain('Parser failed.');
      expect(preview()).toBe('{}');
    } finally {
      parser.mockRestore();
    }

    const serializer = jest.spyOn(jsonEditorCore, 'serializeJsonEditorNode').mockImplementation(() => {
      throw new Error('Serializer failed.');
    });
    try {
      fireEvent.change(screen.getByLabelText('Output indentation'), { target: { value: '4' } });
      await flushRender();
      expect(preview()).toContain('Unable to serialize JSON: Serializer failed.');
    } finally {
      serializer.mockRestore();
    }
  });

  test('reports defensive mutation failures without changing the document', async () => {
    await importJson('{"a":1}');
    const rename = jest.spyOn(jsonEditorCore, 'renameJsonObjectProperty').mockImplementation(() => {
      throw 'Rename failed.';
    });
    try {
      const key = screen.getByRole('textbox', { name: 'Key for a' });
      key.value = 'b';
      fireEvent.input(key, { target: { value: 'b' } });
      await flushRender();
      fireEvent.blur(key);
      await flushRender();
      expect(document.querySelector('.jsone-field-error').textContent).toContain('That key cannot be used.');
      expect(preview()).toContain('"a": 1');
    } finally {
      rename.mockRestore();
    }

    const changeType = jest.spyOn(jsonEditorCore, 'changeJsonEditorNodeType').mockImplementation(() => {
      throw new Error('Type change failed.');
    });
    try {
      NotificationManager.show.mockClear();
      fireEvent.change(screen.getByRole('combobox', { name: 'Type for a' }), { target: { value: 'boolean' } });
      expect(NotificationManager.show).toHaveBeenCalledWith('Type change failed.', 3500, { type: 'error' });
    } finally {
      changeType.mockRestore();
    }

    const addProperty = jest.spyOn(jsonEditorCore, 'addJsonObjectProperty').mockImplementation(() => {
      throw new Error('Property limit reached.');
    });
    try {
      NotificationManager.show.mockClear();
      fireEvent.click(screen.getByRole('button', { name: 'Add property' }));
      expect(NotificationManager.show).toHaveBeenCalledWith('Property limit reached.', 3500, { type: 'error' });
    } finally {
      addProperty.mockRestore();
    }

    await importJson('[]');
    const addItem = jest.spyOn(jsonEditorCore, 'addJsonArrayItem').mockImplementation(() => {
      throw new Error('Item limit reached.');
    });
    try {
      NotificationManager.show.mockClear();
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
      expect(NotificationManager.show).toHaveBeenCalledWith('Item limit reached.', 3500, { type: 'error' });
    } finally {
      addItem.mockRestore();
    }

    await importJson('{"a":1}');
    const duplicate = jest.spyOn(jsonEditorCore, 'duplicateJsonEditorNode').mockImplementation(() => {
      throw new Error('Duplicate limit reached.');
    });
    try {
      NotificationManager.show.mockClear();
      fireEvent.click(screen.getByRole('button', { name: 'Duplicate a' }));
      expect(NotificationManager.show).toHaveBeenCalledWith('Duplicate limit reached.', 3500, { type: 'error' });
    } finally {
      duplicate.mockRestore();
    }
  });

  test('updates preview formatting and exposes copy/download actions', async () => {
    await importJson('{"name":"Ada"}');
    fireEvent.change(screen.getByLabelText('Output indentation'), { target: { value: '4' } });
    await flushRender();
    expect(preview()).toContain('    "name"');

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(copyTextToClipboard).toHaveBeenCalledWith(preview());
    await Promise.resolve();

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(mockDownloadFile).toHaveBeenCalledWith(preview(), 'edited.json', 'application/json');
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(mockDownloadFile).toHaveBeenCalledTimes(2);
  });

  test('supports keyboard history shortcuts and reports copy failures', async () => {
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'y', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true, altKey: true });
    await importJson('{"name":"Ada"}');

    const value = document.querySelector('.jsone-value-input');
    value.value = 'Grace';
    fireEvent.input(value, { target: { value: 'Grace' } });
    await flushRender();
    fireEvent.blur(value);
    await flushRender();
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    await flushRender();
    expect(preview()).toContain('"name": "Ada"');
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true, shiftKey: true });
    await flushRender();
    expect(preview()).toContain('"name": "Grace"');
    fireEvent.keyDown(document, { key: 'y', ctrlKey: true });
    await flushRender();
    expect(preview()).toContain('"name": "Grace"');

    copyTextToClipboard.mockRejectedValueOnce(new Error('Clipboard blocked.'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await Promise.resolve();
    expect(NotificationManager.show).toHaveBeenCalledWith('Could not copy JSON. Clipboard blocked.', 3500, { type: 'error' });
  });
});
