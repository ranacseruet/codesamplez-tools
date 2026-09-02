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
import { registerPrimaryActionShortcut } from '../common/shortcut-utils';
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

    expect(registerDropZone).toHaveBeenCalledTimes(1);
    expect(registerDropZone.mock.calls[0][0]).toBe(document.querySelector('.jsone-import-disclosure'));
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

  test('download button includes standard icon class', () => {
    const downloadBtn = screen.getByRole('button', { name: 'Download' });
    expect(downloadBtn.classList.contains('c-button--icon-download')).toBe(true);
  });

  test('auto-expands collapsed container when adding property or item', async () => {
    await importJson('{"user":{"name":"Ada"},"list":[1]}');
    // Collapse user object
    const collapseUserBtn = screen.getByRole('button', { name: 'Collapse user' });
    fireEvent.click(collapseUserBtn);
    await flushRender();
    expect(collapseUserBtn.getAttribute('aria-expanded')).toBe('false');

    // Add property to user (second Add property button, since root also has one)
    const addPropertyButtons = screen.getAllByRole('button', { name: 'Add property' });
    fireEvent.click(addPropertyButtons[1]);
    await flushRender();

    // Container should now be expanded
    const userToggle = screen.getByRole('button', { name: 'Collapse user' });
    expect(userToggle.getAttribute('aria-expanded')).toBe('true');

    // Collapse list array
    const collapseListBtn = screen.getByRole('button', { name: 'Collapse list' });
    fireEvent.click(collapseListBtn);
    await flushRender();
    expect(collapseListBtn.getAttribute('aria-expanded')).toBe('false');

    // Add item to list
    const addItemBtn = screen.getByRole('button', { name: 'Add item' });
    fireEvent.click(addItemBtn);
    await flushRender();

    // Array should now be expanded
    const listToggle = screen.getByRole('button', { name: 'Collapse list' });
    expect(listToggle.getAttribute('aria-expanded')).toBe('true');
  });

  test('pressing Escape in an invalid field clears the field error and reverts value', async () => {
    await importJson('{"count":10}');
    const countInput = document.querySelector('.jsone-number-input');
    countInput.value = 'not-a-number';
    fireEvent.input(countInput, { target: { value: 'not-a-number' } });
    await flushRender();
    fireEvent.keyDown(countInput, { key: 'Enter' });
    await flushRender();

    // Error message and error class should be present
    expect(document.querySelector('.jsone-field-error')).not.toBeNull();
    expect(countInput.classList.contains('c-input--error')).toBe(true);

    // Press Escape
    fireEvent.keyDown(countInput, { key: 'Escape' });
    await flushRender();

    // Error should be cleared and input reverted
    expect(document.querySelector('.jsone-field-error')).toBeNull();
    expect(countInput.value).toBe('10');
    expect(countInput.classList.contains('c-input--error')).toBe(false);
  });

  test('primary shortcut copies JSON when import disclosure is closed and does not clobber edits', async () => {
    await importJson('{"name":"Original"}');
    copyTextToClipboard.mockResolvedValueOnce(undefined);

    // Edit the tree
    const nameInput = document.querySelector('.jsone-value-input');
    nameInput.value = 'Modified';
    fireEvent.input(nameInput, { target: { value: 'Modified' } });
    await flushRender();
    fireEvent.blur(nameInput);
    await flushRender();
    expect(preview()).toContain('"name": "Modified"');

    // Get the registered primary action shortcut callback
    const registeredCallbacks = registerPrimaryActionShortcut.mock.calls;
    const latestCallback = registeredCallbacks[registeredCallbacks.length - 1][0];
    expect(typeof latestCallback).toBe('function');

    // Invoke shortcut callback with closed import disclosure
    NotificationManager.show.mockClear();
    latestCallback();
    await flushRender();
    await Promise.resolve();

    // Edits must be preserved and copy should have been triggered
    expect(preview()).toContain('"name": "Modified"');
    expect(copyTextToClipboard).toHaveBeenCalledWith(preview());
  });

  test('pluralizes tree status correctly', async () => {
    await importJson('"just-a-string"');
    const status = document.querySelector('.jsone-tree-status');
    expect(status.textContent).toContain('1 node');
    expect(status.textContent).not.toContain('1 nodes');

    await importJson('{"a":1,"b":2}');
    expect(status.textContent).toContain('3 nodes');
  });

  test('pressing Escape in an invalid key field clears the field error and reverts value', async () => {
    await importJson('{"first":1,"second":2}');
    const keyInput = document.querySelectorAll('.jsone-key-input')[1];
    keyInput.value = 'first'; // Duplicate key
    fireEvent.input(keyInput, { target: { value: 'first' } });
    await flushRender();
    fireEvent.keyDown(keyInput, { key: 'Enter' });
    await flushRender();

    // Error should be present
    expect(document.querySelector('.jsone-field-error')).not.toBeNull();
    expect(keyInput.classList.contains('c-input--error')).toBe(true);

    // Press Escape
    fireEvent.keyDown(keyInput, { key: 'Escape' });
    await flushRender();

    // Error should be cleared and key reverted
    expect(document.querySelector('.jsone-field-error')).toBeNull();
    expect(keyInput.value).toBe('second');
  });

  test('renders empty container hint and inline add button for empty containers', async () => {
    await importJson('{}');
    const emptyHintObj = document.querySelector('.jsone-empty-container');
    expect(emptyHintObj).not.toBeNull();
    expect(emptyHintObj.textContent).toContain('Empty object');
    const inlineAddObj = emptyHintObj.querySelector('.jsone-inline-add-btn');
    expect(inlineAddObj).not.toBeNull();
    fireEvent.click(inlineAddObj);
    await flushRender();
    expect(preview()).toContain('"newProperty": null');

    await importJson('[]');
    const emptyHintArr = document.querySelector('.jsone-empty-container');
    expect(emptyHintArr).not.toBeNull();
    expect(emptyHintArr.textContent).toContain('Empty array');
    const inlineAddArr = emptyHintArr.querySelector('.jsone-inline-add-btn');
    expect(inlineAddArr).not.toBeNull();
    fireEvent.click(inlineAddArr);
    await flushRender();
    expect(preview()).toContain('null');
  });

  test('primary shortcut imports JSON when import disclosure is open', async () => {
    await importJson('{"initial":true}');
    // Open import disclosure
    const summary = document.querySelector('.jsone-import-disclosure summary');
    fireEvent.click(summary);
    await flushRender();

    // Change import textarea text
    const textarea = document.querySelector('#json-editor-import-input');
    textarea.value = '{"importedViaShortcut":true}';
    fireEvent.input(textarea, { target: { value: '{"importedViaShortcut":true}' } });
    await flushRender();

    // Get latest shortcut callback
    const registeredCallbacks = registerPrimaryActionShortcut.mock.calls;
    const latestCallback = registeredCallbacks[registeredCallbacks.length - 1][0];

    // Invoke shortcut callback
    latestCallback();
    await flushRender();

    expect(preview()).toContain('"importedViaShortcut": true');
  });
});
