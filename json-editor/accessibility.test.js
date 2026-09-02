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

import { JsonEditorApp } from './script';

describe('JSON Editor accessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    render(<JsonEditorApp />, document.getElementById('root'));
  });

  test('labels import, file, preview, and formatting controls', () => {
    expect(document.querySelector('label[for="json-editor-import-input"]')).not.toBeNull();
    expect(document.getElementById('json-editor-import-input').getAttribute('aria-describedby')).toBe('json-editor-import-helper');
    expect(document.getElementById('json-editor-file').getAttribute('aria-label')).toBe('Upload JSON file');
    expect(document.getElementById('json-editor-preview').getAttribute('aria-label')).toBe('Generated JSON preview');
    expect(document.getElementById('json-editor-indent').getAttribute('aria-label')).toBe('Output indentation');
  });

  test('exposes keyboard-reachable named actions and expanded state', () => {
    const disclosure = document.querySelector('.jsone-import-disclosure');
    expect(disclosure.hasAttribute('open')).toBe(false);

    expect(document.querySelector('[role="group"][aria-label="Document and history actions"]')).not.toBeNull();

    const rootToggle = document.querySelector('.jsone-toggle');
    expect(rootToggle.getAttribute('aria-expanded')).toBe('true');
    expect(rootToggle.getAttribute('aria-controls')).toBeTruthy();

    const buttonNames = [...document.querySelectorAll('button')]
      .map((button) => button.getAttribute('aria-label') || button.textContent.trim());
    ['Load Sample', 'Clear', 'Undo last change', 'Redo last undone change', 'Expand all', 'Collapse all', 'Copy', 'Download']
      .forEach((name) => expect(buttonNames).toContain(name));
    expect(buttonNames.some((name) => name.startsWith('Import JSON'))).toBe(true);
  });

  test('keeps the generated preview read-only and exposes live status regions', () => {
    expect(document.getElementById('json-editor-preview').hasAttribute('readonly')).toBe(true);
    expect(document.querySelector('.jsone-tree-status').getAttribute('aria-live')).toBe('polite');
    expect(document.getElementById('notification').getAttribute('aria-live')).toBe('polite');
  });
});
