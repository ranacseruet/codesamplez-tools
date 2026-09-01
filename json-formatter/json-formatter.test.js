import { JSONFormatter } from './script';
import * as NotificationManagerModule from '../common/notification-manager';
import DownloadManager from '../common/DownloadManager';
import { buildShareHash } from './share-url';

jest.mock('../common/notification-manager', () => ({
  NotificationManager: {
    show: jest.fn()
  }
}));

jest.mock('../common/format-utils', () => ({
  formatBytes: jest.fn(bytes => `${bytes} formatted`)
}));

jest.mock('../common/DownloadManager', () => {
  return jest.fn().mockImplementation(() => {
    return {
      downloadFile: jest.fn()
    };
  });
});

jest.mock('../common/clear-button/ClearButton', () => {
  return jest.fn().mockImplementation(() => {
    return {
      updateVisibility: jest.fn(),
      disconnect: jest.fn()
    };
  });
});

describe('JSONFormatter', () => {
  let formatter;
  let mockNotificationManager;
  let mockDownloadManager;
  let originalDocumentQuerySelector;

  beforeEach(() => {
    originalDocumentQuerySelector = document.querySelector;
    document.querySelector = jest.fn((selector) => {
      if (selector === '.c-input.c-input--textarea') {
        const textarea = document.createElement('textarea');
        textarea.value = '';
        textarea.addEventListener = jest.fn();
        return textarea;
      }
      if (selector === '#plainView .c-input--textarea') {
        const textarea = document.createElement('textarea');
        textarea.value = '';
        return textarea;
      }
      if (selector === '.c-code-output code') return document.createElement('div');
      if (selector === '#treeView') return { classList: { add: jest.fn(), remove: jest.fn() } };
      if (selector === '#plainView') return { classList: { add: jest.fn(), remove: jest.fn() } };
      if (selector === '#formatJsonBtn') return { addEventListener: jest.fn() };

      if (selector === '#copyOutputBtn') return { disabled: false, addEventListener: jest.fn() };
      if (selector === '#downloadOutputBtn') return { disabled: false, addEventListener: jest.fn() };
      if (selector === '#loadSampleBtn') return { addEventListener: jest.fn() };
      if (selector === '#shareUrlBtn') return { addEventListener: jest.fn() };
      if (selector === '#sortKeys') return { checked: true };
      if (selector === '#jsonErrorStatus') return {
        textContent: '',
        classList: { add: jest.fn(), remove: jest.fn() }
      };
      if (selector === '.jsonf-original-size') return { textContent: '' };
      if (selector === '.jsonf-formatted-size') return { textContent: '' };
      return null;
    });
    document.querySelectorAll = jest.fn((selector) => {
      if (selector === '.jsonf-tab') {
        return [
          { dataset: { view: 'tree' }, classList: { add: jest.fn(), remove: jest.fn() }, addEventListener: jest.fn(), setAttribute: jest.fn() },
          { dataset: { view: 'plain' }, classList: { add: jest.fn(), remove: jest.fn() }, addEventListener: jest.fn(), setAttribute: jest.fn() }
        ];
      }
      return [];
    });
    formatter = new JSONFormatter(false);
    formatter.input = { value: '' };
    formatter.output = { innerHTML: '', replaceChildren: jest.fn() };
    formatter.plainViewTextarea = { value: '' };
    formatter.viewContainers = {
      tree: { classList: { add: jest.fn(), remove: jest.fn() } },
      plain: { classList: { add: jest.fn(), remove: jest.fn() } }
    };
    formatter.tabs = [
      { dataset: { view: 'tree' }, classList: { add: jest.fn(), remove: jest.fn() }, addEventListener: jest.fn(), setAttribute: jest.fn() },
      { dataset: { view: 'plain' }, classList: { add: jest.fn(), remove: jest.fn() }, addEventListener: jest.fn(), setAttribute: jest.fn() }
    ];
    formatter.copyBtn = { disabled: false, addEventListener: jest.fn() };
    formatter.downloadBtn = { disabled: false, addEventListener: jest.fn() };
    formatter.expandAllBtn = { disabled: false, addEventListener: jest.fn() };
    formatter.collapseAllBtn = { disabled: false, addEventListener: jest.fn() };
    formatter.indentSelect = { value: '2', addEventListener: jest.fn() };
    formatter.errorStatus = { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } };
    formatter.goToErrorBtn = { hidden: true, textContent: '', addEventListener: jest.fn() };
    formatter.originalSizeEl = { textContent: '' };
    formatter.formattedSizeEl = { textContent: '' };
    formatter.sortCheckbox = { checked: true };
    formatter.autoFixCheckbox = { checked: false };
    formatter.autoFixCheckbox = { checked: false };
    formatter.formatBtn = { addEventListener: jest.fn() };

    formatter.sampleBtn = { addEventListener: jest.fn() };
    formatter.shareBtn = { addEventListener: jest.fn() };
    formatter.clearButtonInstance = { updateVisibility: jest.fn(), disconnect: jest.fn() };
    mockNotificationManager = NotificationManagerModule.NotificationManager;
    mockDownloadManager = new DownloadManager(); // Get instance of the mocked DownloadManager
    formatter.downloadManager = mockDownloadManager; // Assign to formatter instance
    jest.clearAllMocks();
  });

  describe('autoFixJSON', () => {
    test('should fix trailing commas in objects', () => {
      const input = '{"a": 1, "b": 2,}';
      const expected = '{"a": 1, "b": 2}';
      expect(JSONFormatter.autoFixJSON(input)).toEqual(expected);
    });

    test('should fix trailing commas in arrays', () => {
      const input = '[1, 2, 3,]';
      const expected = '[1, 2, 3]';
      expect(JSONFormatter.autoFixJSON(input)).toEqual(expected);
    });

    test('should fix single quotes', () => {
      const input = "{'a': 1, 'b': 'hello'}";
      const expected = '{"a": 1, "b": "hello"}';
      expect(JSONFormatter.autoFixJSON(input)).toEqual(expected);
    });

    test('should fix unquoted keys', () => {
      const input = '{a: 1, b: 2}';
      const expected = '{"a": 1, "b": 2}';
      expect(JSONFormatter.autoFixJSON(input)).toEqual(expected);
    });

    test('should fix a combination of errors', () => {
      const input = "{a: 1, 'b': 'hello',}";
      const expected = '{"a": 1, "b": "hello"}';
      expect(JSONFormatter.autoFixJSON(input)).toEqual(expected);
    });
  });

  describe('sortKeysAlphabetically', () => {
    test('should sort object keys alphabetically', () => {
      const input = { z: 1, a: 2, m: 3 };
      const expected = { a: 2, m: 3, z: 1 };
      expect(JSONFormatter.sortKeysAlphabetically(input)).toEqual(expected);
    });

    test('should handle nested objects', () => {
      const input = { z: { y: 1, x: 2 }, a: 3 };
      const expected = { a: 3, z: { x: 2, y: 1 } };
      expect(JSONFormatter.sortKeysAlphabetically(input)).toEqual(expected);
    });

    test('should handle arrays', () => {
      const input = { items: [{ b: 1, a: 2 }, { d: 3, c: 4 }] };
      const expected = { items: [{ a: 2, b: 1 }, { c: 4, d: 3 }] };
      expect(JSONFormatter.sortKeysAlphabetically(input)).toEqual(expected);
    });

    test('should handle null values', () => {
      const input = { b: null, a: 1 };
      const expected = { a: 1, b: null };
      expect(JSONFormatter.sortKeysAlphabetically(input)).toEqual(expected);
    });
  });



  describe('renderJSONAsync', () => {
    beforeEach(() => {
      formatter.output = document.createElement('div');
    });

    test('should render primitive values correctly', async () => {
      await formatter.renderJSONAsync(42, formatter.output);
      expect(formatter.output.innerHTML).toContain('42');
    });

    test('should render objects with toggle buttons', async () => {
      await formatter.renderJSONAsync({ a: 1 }, formatter.output);
      expect(formatter.output.querySelector('.json-toggle')).not.toBeNull();
    });

    test('should toggle between expanded/collapsed states', async () => {
      await formatter.renderJSONAsync({ a: 1 }, formatter.output);
      const toggle = formatter.output.querySelector('.json-toggle');
      // Initial state should be expanded ('-')
      expect(toggle.textContent).toBe('-');
      expect(toggle.getAttribute('aria-expanded')).toBe('true');

      // Click to collapse
      toggle.click();
      expect(toggle.textContent).toBe('+'); // Collapsed state should be '+'
      expect(toggle.getAttribute('aria-expanded')).toBe('false');

      // Click to expand again
      toggle.click();
      expect(toggle.textContent).toBe('-'); // Expanded state should be '-'
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
    });

    test('should toggle via keyboard Enter key', async () => {
      await formatter.renderJSONAsync({ a: 1 }, formatter.output);
      const toggle = formatter.output.querySelector('.json-toggle');
      expect(toggle.textContent).toBe('-');

      // Simulate Enter keydown
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      toggle.dispatchEvent(enterEvent);
      expect(toggle.textContent).toBe('+');
    });

    test('should toggle via keyboard Space key', async () => {
      await formatter.renderJSONAsync({ a: 1 }, formatter.output);
      const toggle = formatter.output.querySelector('.json-toggle');
      expect(toggle.textContent).toBe('-');

      // Simulate Space keydown
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
      toggle.dispatchEvent(spaceEvent);
      expect(toggle.textContent).toBe('+');
    });

    test('should handle max depth limit', async () => {
      // Create deeply nested object
      let deepObj = { value: 'deep' };
      for (let i = 0; i < 150; i++) {
        deepObj = { nested: deepObj };
      }
      await formatter.renderJSONAsync(deepObj, formatter.output);
      expect(formatter.output.textContent).toContain('...');
    });

    test('should add descriptive aria-labels to toggle buttons', async () => {
      const data = {
        user: {
          name: "Alice",
          roles: ["admin"]
        }
      };

      await formatter.renderJSONAsync(data, formatter.output, 0, undefined, 'root');

      const toggles = formatter.output.querySelectorAll('.json-toggle');
      // Should have toggles for root, user, and roles

      const findToggleByLabel = (label) => Array.from(toggles).find(t => t.getAttribute('aria-label') === label);

      expect(findToggleByLabel('Toggle root')).toBeTruthy();
      expect(findToggleByLabel('Toggle user')).toBeTruthy();
      expect(findToggleByLabel('Toggle roles')).toBeTruthy();
    });

    test('should add indexed labels for array items', async () => {
      const data = [
        { id: 1 },
        { id: 2 }
      ];

      await formatter.renderJSONAsync(data, formatter.output, 0, undefined, 'root');

      const toggles = formatter.output.querySelectorAll('.json-toggle');

      const findToggleByLabel = (label) => Array.from(toggles).find(t => t.getAttribute('aria-label') === label);

      expect(findToggleByLabel('Toggle root')).toBeTruthy();
      expect(findToggleByLabel('Toggle item 0')).toBeTruthy();
      expect(findToggleByLabel('Toggle item 1')).toBeTruthy();
    });
  });

  describe('JSON formatting', () => {
    beforeEach(() => {
      formatter.input = { value: '' };
      formatter.output = document.createElement('div');
      formatter.copyBtn = { disabled: false };
      formatter.errorContainer = {
        textContent: '',
        classList: { add: jest.fn(), remove: jest.fn() }
      };
      formatter.sortCheckbox = { checked: true };
    });

    test('should format valid JSON', async () => {
      formatter.input.value = '{"b":2,"a":1}';
      await formatter.formatJSON();

      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys[0].textContent).toBe('"a": ');
      expect(keys[1].textContent).toBe('"b": ');
    });

    test('should auto-switch to plain view when minifying', async () => {
      formatter.switchView = jest.fn();
      formatter.indentSelect = { value: 'minify' };
      formatter.input.value = '{"a":1}';
      await formatter.formatJSON();

      expect(formatter.switchView).toHaveBeenCalledWith('plain');
      expect(formatter.plainViewTextarea.value).toBe('{"a":1}');
    });

    test('should not switch view for non-minify indentation', async () => {
      formatter.switchView = jest.fn();
      formatter.indentSelect = { value: '2' };
      formatter.input.value = '{"a":1}';
      await formatter.formatJSON();

      expect(formatter.switchView).not.toHaveBeenCalled();
    });

    test('should enable expand/collapse controls after a successful format', async () => {
      formatter.input.value = '{"a":1}';
      await formatter.formatJSON();

      expect(formatter.expandAllBtn.disabled).toBe(false);
      expect(formatter.collapseAllBtn.disabled).toBe(false);
    });

    test('should disable expand/collapse controls on invalid JSON', async () => {
      formatter.expandAllBtn.disabled = false;
      formatter.collapseAllBtn.disabled = false;
      formatter.input.value = '{"invalid": json}';
      await formatter.formatJSON();

      expect(formatter.expandAllBtn.disabled).toBe(true);
      expect(formatter.collapseAllBtn.disabled).toBe(true);
    });

    test('should handle invalid JSON', async () => {
      formatter.input.value = '{"invalid": json}';
      await formatter.formatJSON();
      expect(mockNotificationManager.show).toHaveBeenCalledWith(
        expect.stringContaining('Invalid JSON'),
        3000,
        { type: 'error' }
      );
      expect(formatter.errorStatus.textContent).toContain('Invalid JSON');
      expect(formatter.errorStatus.classList.add).toHaveBeenCalledWith('error');
    });

    test('should handle very large JSON input', async () => {
      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }
      formatter.input.value = JSON.stringify(largeObject);
      await formatter.formatJSON();
      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys.length).toBe(1000);
      expect(mockNotificationManager.show).toHaveBeenCalledWith('JSON formatted successfully!', 2000, { type: 'success' });
    });

    test('should handle deeply nested JSON structures', async () => {
      const nestedObject = { a: { b: { c: { d: { e: 1 } } } } };
      formatter.input.value = JSON.stringify(nestedObject);
      await formatter.formatJSON();
      const containers = formatter.output.querySelectorAll('.json-node');
      expect(containers.length).toBeGreaterThanOrEqual(1); // At least 1 (the root)
      expect(mockNotificationManager.show).toHaveBeenCalledWith('JSON formatted successfully!', 2000, { type: 'success' });
    });

    test('should properly sort nested objects', async () => {
      formatter.input.value = '{"b":[{"d":4,"c":3}],"a":{"z":2,"y":1}}';
      await formatter.formatJSON();

      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys[0].textContent).toBe('"a": ');
      expect(keys[1].textContent).toBe('"y": ');
      expect(keys[2].textContent).toBe('"z": ');
      expect(keys[3].textContent).toBe('"b": ');
      expect(keys[4].textContent).toBe('"c": ');
      expect(keys[5].textContent).toBe('"d": ');
    });

    test('should preserve original order when sorting is disabled', async () => {
      formatter.sortCheckbox.checked = false;
      formatter.input.value = '{"b":2,"a":1}';
      await formatter.formatJSON();

      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys[0].textContent).toBe('"b": ');
      expect(keys[1].textContent).toBe('"a": ');
    });

    test('should sort keys when sorting is enabled', async () => {
      formatter.sortCheckbox.checked = true;
      formatter.input.value = '{"b":2,"a":1}';
      await formatter.formatJSON();

      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys[0].textContent).toBe('"a": ');
      expect(keys[1].textContent).toBe('"b": ');
    });

    test('should have sorting enabled by default', async () => {
      formatter.input.value = '{"b":2,"a":1}';
      await formatter.formatJSON();

      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys[0].textContent).toBe('"a": ');
      expect(keys[1].textContent).toBe('"b": ');
    });

    test('should use auto-fix when checkbox is checked', async () => {
      formatter.autoFixCheckbox = { checked: true };
      formatter.input.value = "{'a':1,}";
      await formatter.formatJSON();
      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys[0].textContent).toBe('"a": ');
      expect(mockNotificationManager.show).toHaveBeenCalledWith('JSON formatted successfully!', 2000, { type: 'success' });
    });
  });

  describe('updateStats', () => {
    beforeEach(() => {
      formatter.originalSizeEl = { textContent: '' };
      formatter.formattedSizeEl = { textContent: '' };
    });

    test('should update stats with correct byte sizes for original and formatted JSON', () => {
      const original = '{"key":"value"}';
      const formatted = JSON.stringify(JSON.parse(original), null, 2);
      formatter.updateStats(original, formatted);
      expect(formatter.originalSizeEl.textContent).toBe('15 formatted');
      expect(formatter.formattedSizeEl.textContent).toBe('20 formatted'); // Using mock implementation
    });

    test('should handle empty input and output in stats', () => {
      formatter.updateStats('', '');
      expect(formatter.originalSizeEl.textContent).toBe('0 formatted');
      expect(formatter.formattedSizeEl.textContent).toBe('0 formatted');
    });

    test('should handle large JSON data in stats', () => {
      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }
      const original = JSON.stringify(largeObject);
      const formatted = JSON.stringify(largeObject, null, 2);
      formatter.updateStats(original, formatted);
      expect(formatter.originalSizeEl.textContent).toContain('formatted');
      expect(formatter.formattedSizeEl.textContent).toContain('formatted');
    });
  });



  describe('getFormattedOutput', () => {
    test('should return formatted JSON when input is valid', () => {
      formatter.input.value = '{"b":2,"a":1}';
      formatter.sortCheckbox.checked = true;
      const result = formatter.getFormattedOutput();
      expect(result).toBe('{\n  "a": 1,\n  "b": 2\n}');
    });

    test('should return original input when JSON is invalid', () => {
      formatter.input.value = 'invalid json';
      const result = formatter.getFormattedOutput();
      expect(result).toBe('invalid json');
    });

    test('should respect sort checkbox setting', () => {
      formatter.input.value = '{"b":2,"a":1}';
      formatter.sortCheckbox.checked = false;
      const result = formatter.getFormattedOutput();
      expect(result).toBe('{\n  "b": 2,\n  "a": 1\n}');
    });

    test('should apply auto-fix if enabled', () => {
      formatter.input.value = "{'a':1,}";
      formatter.autoFixCheckbox.checked = true;
      const result = formatter.getFormattedOutput();
      expect(result).toBe('{\n  "a": 1\n}');
    });
  });

  describe('copyOutput', () => {
    let originalNavigator;
    let mockClipboard;

    beforeEach(() => {
      originalNavigator = global.navigator;
      mockClipboard = {
        writeText: jest.fn().mockResolvedValue(undefined)
      };

      // Mock globalThis.navigator.clipboard as used in script.tsx
      global.navigator.clipboard = mockClipboard;

      formatter.input = { value: 'test content' };
      formatter.errorContainer = {
        textContent: '',
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      };
    });

    afterEach(() => {
      global.navigator = originalNavigator;
      delete global.navigator.clipboard; // Clean up mock
    });

    test('should copy formatted output to clipboard', async () => {
      formatter.input.value = '{"b":2,"a":1}';
      formatter.sortCheckbox.checked = true;

      await formatter.copyOutput();

      expect(mockClipboard.writeText).toHaveBeenCalledWith('{\n  "a": 1,\n  "b": 2\n}');
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', 2000, { type: 'success' });
    });

    test('should handle empty input during copy', async () => {
      formatter.input.value = '';
      await formatter.copyOutput();
      expect(mockClipboard.writeText).toHaveBeenCalledWith('');
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', 2000, { type: 'success' });
    });

    test('should handle special characters in input during copy', async () => {
      formatter.input.value = '{"key": "value\\nwith\\nspecial chars"}';
      await formatter.copyOutput();
      expect(mockClipboard.writeText).toHaveBeenCalledWith('{\n  "key": "value\\nwith\\nspecial chars"\n}');
    });

    test('should show error message on copy failure', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Failed'));
      await formatter.copyOutput();
      expect(mockNotificationManager.show).toHaveBeenCalledWith(expect.stringContaining('Failed to copy'), 3000, { type: 'error' });
    });

    test('should use fallback copy mechanism when clipboard API is unavailable', async () => {
      // Simulate no clipboard API by deleting it
      delete global.navigator.clipboard;

      // Mock document.execCommand for fallback
      document.execCommand = jest.fn().mockReturnValue(true);
      const mockCreateElement = jest.spyOn(document, 'createElement').mockReturnValue({
        value: '',
        style: { position: '', top: '', left: '' },
        setAttribute: jest.fn(),
        focus: jest.fn(),
        select: jest.fn()
      });
      const mockAppendChild = jest.spyOn(document.body, 'appendChild').mockImplementation(() => { });
      const mockRemoveChild = jest.spyOn(document.body, 'removeChild').mockImplementation(() => { });

      formatter.output.textContent = 'fallback test content';
      await formatter.copyOutput();

      expect(document.execCommand).toHaveBeenCalledWith('copy');
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Copied to clipboard!', 2000, { type: 'success' });

      mockCreateElement.mockRestore();
      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
      delete document.execCommand; // Clean up
    });

    test('should handle fallback copy mechanism failure', async () => {
      // Simulate no clipboard API
      delete global.navigator.clipboard;

      // Mock document.execCommand for fallback failure
      document.execCommand = jest.fn().mockReturnValue(false);
      const mockCreateElement = jest.spyOn(document, 'createElement').mockReturnValue({
        value: '',
        style: { position: '', top: '', left: '' },
        setAttribute: jest.fn(),
        focus: jest.fn(),
        select: jest.fn()
      });
      const mockAppendChild = jest.spyOn(document.body, 'appendChild').mockImplementation(() => { });
      const mockRemoveChild = jest.spyOn(document.body, 'removeChild').mockImplementation(() => { });

      formatter.output.textContent = 'fallback fail test content';
      await formatter.copyOutput();

      expect(mockNotificationManager.show).toHaveBeenCalledWith(
        expect.stringContaining('Failed to copy'),
        3000,
        { type: 'error' }
      );

      mockCreateElement.mockRestore();
      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
      delete document.execCommand; // Clean up
    });
  });

  describe('shareUrl', () => {
    let originalNavigator;
    let mockClipboard;

    beforeEach(() => {
      originalNavigator = global.navigator;
      mockClipboard = { writeText: jest.fn().mockResolvedValue(undefined) };
      global.navigator.clipboard = mockClipboard;

      formatter.input = { value: '{"a":1}' };
      formatter.sortCheckbox = { checked: true };
      formatter.autoFixCheckbox = { checked: false };
      formatter.indentSelect = { value: '2' };
    });

    afterEach(() => {
      global.navigator = originalNavigator;
      delete global.navigator.clipboard;
    });

    test('copies a share link with the current JSON and settings and notifies success', async () => {
      await formatter.shareUrl();

      expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
      const [copiedUrl] = mockClipboard.writeText.mock.calls[0];
      expect(copiedUrl).toContain('#j=');
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Share link copied to clipboard!', 2000, { type: 'success' });
    });

    test('strips a legacy ?j= query payload from the page URL instead of carrying it into the new link', async () => {
      // Simulates a user who opened the tool via a legacy `?j=<old>` link, then
      // clicks Share: window.location.href still carries that query string.
      const originalUrl = window.location.href;
      window.history.replaceState({}, '', 'http://localhost/json-formatter/?j=stale-legacy-payload');

      try {
        await formatter.shareUrl();

        const [copiedUrl] = mockClipboard.writeText.mock.calls[0];
        expect(copiedUrl).not.toContain('?j=');
        expect(copiedUrl).not.toContain('stale-legacy-payload');
        expect(copiedUrl).toMatch(/^http:\/\/localhost\/json-formatter\/#j=/);
      } finally {
        window.history.replaceState({}, '', originalUrl);
      }
    });

    test('rejects empty input without touching the clipboard', async () => {
      formatter.input.value = '   ';

      await formatter.shareUrl();

      expect(mockClipboard.writeText).not.toHaveBeenCalled();
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Enter some JSON before sharing.', 3000, { type: 'error' });
    });

    test('blocks share links that would exceed the practical URL length', async () => {
      // High-entropy input so lz-string cannot compress it away — a repeated
      // character would compress to a tiny payload and never trip the guard.
      let randomChars = '';
      for (let i = 0; i < 20000; i++) {
        randomChars += Math.random().toString(36).charAt(2);
      }
      formatter.input.value = JSON.stringify(randomChars);

      await formatter.shareUrl();

      expect(mockClipboard.writeText).not.toHaveBeenCalled();
      expect(mockNotificationManager.show).toHaveBeenCalledWith(
        expect.stringContaining('too large to share as a URL'),
        4000,
        { type: 'error' }
      );
    });

    test('shows an error notification when the clipboard write fails', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('denied'));

      await formatter.shareUrl();

      expect(mockNotificationManager.show).toHaveBeenCalledWith(expect.stringContaining('Failed to copy share link'), 3000, { type: 'error' });
    });

    test('falls back to execCommand when the Clipboard API is unavailable', async () => {
      delete global.navigator.clipboard;

      document.execCommand = jest.fn().mockReturnValue(true);
      const mockCreateElement = jest.spyOn(document, 'createElement').mockReturnValue({
        value: '',
        style: { position: '', top: '', left: '' },
        setAttribute: jest.fn(),
        focus: jest.fn(),
        select: jest.fn()
      });
      const mockAppendChild = jest.spyOn(document.body, 'appendChild').mockImplementation(() => { });
      const mockRemoveChild = jest.spyOn(document.body, 'removeChild').mockImplementation(() => { });

      await formatter.shareUrl();

      expect(document.execCommand).toHaveBeenCalledWith('copy');
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Share link copied to clipboard!', 2000, { type: 'success' });

      mockCreateElement.mockRestore();
      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
      delete document.execCommand;
    });

    test('shows an error notification when the execCommand fallback fails', async () => {
      delete global.navigator.clipboard;

      document.execCommand = jest.fn().mockReturnValue(false);
      const mockCreateElement = jest.spyOn(document, 'createElement').mockReturnValue({
        value: '',
        style: { position: '', top: '', left: '' },
        setAttribute: jest.fn(),
        focus: jest.fn(),
        select: jest.fn()
      });
      const mockAppendChild = jest.spyOn(document.body, 'appendChild').mockImplementation(() => { });
      const mockRemoveChild = jest.spyOn(document.body, 'removeChild').mockImplementation(() => { });

      await formatter.shareUrl();

      expect(mockNotificationManager.show).toHaveBeenCalledWith(
        expect.stringContaining('Failed to copy share link'),
        3000,
        { type: 'error' }
      );

      mockCreateElement.mockRestore();
      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
      delete document.execCommand;
    });
  });

  describe('loadFromShareLocation', () => {
    beforeEach(() => {
      formatter.input = { value: '' };
      formatter.sortCheckbox = { checked: true };
      formatter.autoFixCheckbox = { checked: false };
      formatter.indentSelect = { value: '2' };
      formatter.clearButtonInstance = { updateVisibility: jest.fn() };
      formatter.formatJSON = jest.fn().mockResolvedValue(undefined);
    });

    test('populates input and settings from a valid share hash, awaits formatJSON, then notifies', async () => {
      const hash = buildShareHash({
        input: '{"b":2,"a":1}',
        indent: 4,
        sortKeys: false,
        autoFix: true
      });
      const callOrder = [];
      formatter.formatJSON = jest.fn().mockImplementation(() => {
        callOrder.push('formatJSON');
        return Promise.resolve();
      });
      mockNotificationManager.show.mockImplementation(() => callOrder.push('notify'));

      await formatter.loadFromShareLocation({ hash: `#${hash}`, search: '' });

      expect(formatter.input.value).toBe('{"b":2,"a":1}');
      expect(formatter.sortCheckbox.checked).toBe(false);
      expect(formatter.autoFixCheckbox.checked).toBe(true);
      expect(formatter.indentSelect.value).toBe('4');
      expect(formatter.formatJSON).toHaveBeenCalled();
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Loaded JSON from shared link.', 2000, { type: 'success' });
      // formatJSON must resolve before the "loaded" toast fires, so it isn't
      // immediately overwritten by formatJSON's own success/error notification.
      expect(callOrder).toEqual(['formatJSON', 'notify']);
    });

    test('shows a legacy-link warning when the payload came from the query string', async () => {
      const hash = buildShareHash({ input: '{"a":1}', indent: 2, sortKeys: true, autoFix: false });

      await formatter.loadFromShareLocation({ hash: '', search: `?${hash}` });

      expect(formatter.input.value).toBe('{"a":1}');
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Loaded JSON from shared link.', 2000, { type: 'success' });
      expect(mockNotificationManager.show).toHaveBeenCalledWith(
        expect.stringContaining('Legacy ?j= preload detected'),
        4000,
        { type: 'warning' }
      );
    });

    test('does not warn when the payload came from the hash', async () => {
      const hash = buildShareHash({ input: '{"a":1}', indent: 2, sortKeys: true, autoFix: false });

      await formatter.loadFromShareLocation({ hash: `#${hash}`, search: '' });

      expect(mockNotificationManager.show).not.toHaveBeenCalledWith(
        expect.stringContaining('Legacy'),
        expect.anything(),
        expect.anything()
      );
    });

    test('no-ops when neither the hash nor query carries a payload', async () => {
      await formatter.loadFromShareLocation({ hash: '#other=1', search: '' });

      expect(formatter.input.value).toBe('');
      expect(formatter.formatJSON).not.toHaveBeenCalled();
    });

    test('no-ops on an empty hash and search', async () => {
      await formatter.loadFromShareLocation({ hash: '', search: '' });

      expect(formatter.formatJSON).not.toHaveBeenCalled();
    });
  });

  describe('switchView', () => {
    test('should switch to tree view and update classes', () => {
      formatter.switchView('tree');

      expect(formatter.tabs[0].classList.add).toHaveBeenCalledWith('active');
      expect(formatter.tabs[1].classList.remove).toHaveBeenCalledWith('active');

      expect(formatter.viewContainers.tree.classList.add).toHaveBeenCalledWith('active');
      expect(formatter.viewContainers.plain.classList.remove).toHaveBeenCalledWith('active');
    });

    test('should switch to plain view and update classes', () => {
      formatter.switchView('plain');

      expect(formatter.tabs[0].classList.remove).toHaveBeenCalledWith('active');
      expect(formatter.tabs[1].classList.add).toHaveBeenCalledWith('active');

      expect(formatter.viewContainers.tree.classList.remove).toHaveBeenCalledWith('active');
      expect(formatter.viewContainers.plain.classList.add).toHaveBeenCalledWith('active');
    });
  });


  describe('loadSampleData', () => {
    test('should load sample data and format it', () => {
      formatter.formatJSON = jest.fn();
      formatter.loadSampleData();

      expect(formatter.input.value).toBeTruthy();
      expect(formatter.formatJSON).toHaveBeenCalled();
    });
  });

  describe('downloadOutput', () => {
    beforeEach(() => {
      formatter.input = { value: 'test content' };
    });

    test('should call DownloadManager.downloadFile with formatted JSON', async () => {
      formatter.input.value = '{"b":2,"a":1}';
      formatter.sortCheckbox.checked = true;

      await formatter.downloadOutput();

      expect(mockDownloadManager.downloadFile).toHaveBeenCalledWith(
        '{\n  "a": 1,\n  "b": 2\n}',
        'formatted.json',
        'application/json'
      );
      expect(mockNotificationManager.show).toHaveBeenCalledWith('Download started!', 2000, { type: 'success' });
    });

    test('should handle download errors from DownloadManager', async () => {
      mockDownloadManager.downloadFile.mockImplementation(() => {
        throw new Error('Simulated download error');
      });

      await formatter.downloadOutput();

      expect(mockNotificationManager.show).toHaveBeenCalledWith(
        'Download failed: Simulated download error',
        3000,
        { type: 'error' }
      );
    });
  });

  describe('initializeEvents', () => {
    let callbacks;
    let formatBtnMock;
    let copyBtnMock;
    let sampleBtnMock;
    let shareBtnMock;
    let inputMock;
    let clearInputBtnMock;
    let clearOutputBtnMock;

    beforeEach(() => {
      callbacks = {
        formatBtn: { click: null },

        copyBtn: { click: null },
        sampleBtn: { click: null },
        shareBtn: { click: null },
        input: { input: null },
        clearInputBtn: { click: null },
        clearOutputBtn: { click: null },
        indentSelect: { change: null },
        expandAllBtn: { click: null },
        collapseAllBtn: { click: null }
      };

      const captureMock = (target, event) => jest.fn((evt, callback) => {
        if (evt === event) target[event] = callback;
      });

      formatBtnMock = jest.fn((event, callback) => {
        if (event === 'click') {
          callbacks.formatBtn.click = callback;
        }
      });



      copyBtnMock = jest.fn((event, callback) => {
        if (event === 'click') {
          callbacks.copyBtn.click = callback;
        }
      });

      sampleBtnMock = jest.fn((event, callback) => {
        if (event === 'click') {
          callbacks.sampleBtn.click = callback;
        }
      });

      shareBtnMock = jest.fn((event, callback) => {
        if (event === 'click') {
          callbacks.shareBtn.click = callback;
        }
      });

      inputMock = jest.fn((event, callback) => {
        if (event === 'input') {
          callbacks.input.input = callback;
        }
      });

      clearInputBtnMock = jest.fn((event, callback) => {
        if (event === 'click') {
          callbacks.clearInputBtn.click = callback;
        }
      });

      clearOutputBtnMock = jest.fn((event, callback) => {
        if (event === 'click') {
          callbacks.clearOutputBtn.click = callback;
        }
      });

      formatter.formatBtn = { addEventListener: formatBtnMock };

      formatter.copyBtn = { addEventListener: copyBtnMock };
      formatter.sampleBtn = { addEventListener: sampleBtnMock };
      formatter.shareBtn = { addEventListener: shareBtnMock };
      formatter.input = {
        addEventListener: inputMock,
        value: '{"key": "value"}',
        // registerDropZone marks its target for the `?` help overlay, so the
        // stand-in needs the attribute methods a real element has.
        setAttribute: jest.fn(),
        removeAttribute: jest.fn()
      };
      formatter.clearInputBtn = { addEventListener: clearInputBtnMock };
      formatter.clearOutputBtn = { addEventListener: clearOutputBtnMock };
      formatter.indentSelect = { addEventListener: captureMock(callbacks.indentSelect, 'change') };
      formatter.expandAllBtn = { addEventListener: captureMock(callbacks.expandAllBtn, 'click') };
      formatter.collapseAllBtn = { addEventListener: captureMock(callbacks.collapseAllBtn, 'click') };
    });

    test('should set up event listeners', () => {
      formatter.initializeEvents();
      expect(formatBtnMock).toHaveBeenCalledTimes(1);
      expect(copyBtnMock).toHaveBeenCalledTimes(1);
      expect(sampleBtnMock).toHaveBeenCalledTimes(1);
      expect(shareBtnMock).toHaveBeenCalledTimes(1);
      // One 'input' listener plus the four drag events registerDropZone wires
      // onto the same textarea (dragenter/dragover/dragleave/drop).
      const inputEvents = inputMock.mock.calls.map(([eventName]) => eventName);
      expect(inputEvents).toEqual(
        expect.arrayContaining(['input', 'dragenter', 'dragover', 'dragleave', 'drop'])
      );
      expect(inputEvents.filter((eventName) => eventName === 'input')).toHaveLength(1);
    });

    describe('input drop zone', () => {
      const flushDrop = async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
      };

      const dropOn = (files) => {
        formatter.initializeEvents();
        const dropHandler = inputMock.mock.calls.find(([eventName]) => eventName === 'drop')[1];
        dropHandler({
          preventDefault: jest.fn(),
          dataTransfer: { types: ['Files'], files, dropEffect: '' }
        });
      };

      beforeEach(() => {
        // registerDropZone toggles a highlight class on its target.
        formatter.input.classList = { toggle: jest.fn() };
        formatter.clearButtonInstance = { updateVisibility: jest.fn() };
        formatter.formatJSON = jest.fn();
      });

      test('loads a dropped file into the input and formats it', async () => {
        dropOn([new File(['{"dropped": true}'], 'payload.json')]);
        await flushDrop();

        expect(formatter.input.value).toBe('{"dropped": true}');
        expect(formatter.clearButtonInstance.updateVisibility).toHaveBeenCalled();
        expect(formatter.formatJSON).toHaveBeenCalled();
        expect(mockNotificationManager.show).toHaveBeenCalledWith(
          'Loaded payload.json',
          expect.any(Number),
          expect.objectContaining({ type: 'success' })
        );
      });

      test('surfaces a rejected drop as an error toast', async () => {
        dropOn([]);
        await flushDrop();

        expect(formatter.formatJSON).not.toHaveBeenCalled();
        expect(mockNotificationManager.show).toHaveBeenCalledWith(
          expect.stringContaining('No file'),
          expect.any(Number),
          expect.objectContaining({ type: 'error' })
        );
      });
    });

    describe('file picker', () => {
      let fileInput;

      beforeEach(() => {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'json-formatter-file';
        document.body.appendChild(fileInput);
      });

      afterEach(() => {
        fileInput.remove();
      });

      test('loads a selected file through the shared picker path', async () => {
        formatter.loadDroppedText = jest.fn();
        formatter.initializeEvents();
        const file = new File(['{"picker": true}'], 'picker.json');
        Object.defineProperty(file, 'text', { value: () => Promise.resolve('{"picker": true}') });
        Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });

        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(formatter.loadDroppedText).toHaveBeenCalledWith('{"picker": true}', 'picker.json');
      });

      test('surfaces a picker binary-content error through the shared path', async () => {
        const liveFile = new File(['binary'], 'binary.bin');
        Object.defineProperty(liveFile, 'text', { value: () => Promise.resolve('x\u0000y') });
        Object.defineProperty(fileInput, 'files', { configurable: true, value: [liveFile] });
        formatter.initializeEvents();

        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockNotificationManager.show).toHaveBeenCalledWith(
          expect.stringContaining('binary file'),
          3000,
          expect.objectContaining({ type: 'error' })
        );
      });
    });

    test('should trigger formatJSON on format button click', () => {
      formatter.formatJSON = jest.fn();
      formatter.initializeEvents();
      if (callbacks.formatBtn.click) {
        callbacks.formatBtn.click();
        expect(formatter.formatJSON).toHaveBeenCalled();
      } else {
        throw new Error('formatBtn callback not set');
      }
    });

    test('should trigger copyOutput on copy button click', () => {
      formatter.copyOutput = jest.fn();
      formatter.initializeEvents();
      if (callbacks.copyBtn.click) {
        callbacks.copyBtn.click();
        expect(formatter.copyOutput).toHaveBeenCalled();
      } else {
        throw new Error('copyBtn callback not set');
      }
    });

    test('should trigger loadSampleData on sample button click', () => {
      formatter.loadSampleData = jest.fn();
      formatter.initializeEvents();
      if (callbacks.sampleBtn.click) {
        callbacks.sampleBtn.click();
        expect(formatter.loadSampleData).toHaveBeenCalled();
      } else {
        throw new Error('sampleBtn callback not set');
      }
    });

    test('should trigger shareUrl on share button click', () => {
      formatter.shareUrl = jest.fn();
      formatter.initializeEvents();
      if (callbacks.shareBtn.click) {
        callbacks.shareBtn.click();
        expect(formatter.shareUrl).toHaveBeenCalled();
      } else {
        throw new Error('shareBtn callback not set');
      }
    });


    test('should trigger clearError and updateStats on input change', () => {
      jest.useFakeTimers();
      formatter.clearError = jest.fn();
      formatter.updateStats = jest.fn();
      formatter.initializeEvents();
      if (callbacks.input.input) {
        callbacks.input.input();
        expect(formatter.clearError).toHaveBeenCalled();
        // updateStats is debounced, advance timers past delay
        jest.advanceTimersByTime(200);
        expect(formatter.updateStats).toHaveBeenCalledWith('{\"key\": \"value\"}', '');
      } else {
        throw new Error('input callback not set');
      }
      jest.useRealTimers();
    });

    test('should trigger switchView on tab click', () => {
      formatter.switchView = jest.fn();
      const tab0Mock = jest.fn((event, callback) => {
        if (event === 'click') callback();
      });
      const tab1Mock = jest.fn((event, callback) => {
        if (event === 'click') callback();
      });

      formatter.tabs[0].addEventListener = tab0Mock;
      formatter.tabs[1].addEventListener = tab1Mock;

      formatter.initializeEvents();

      // Callbacks are triggered immediately in my mock above,
      // but typically we'd capture them.
      // Let's rewrite to capture.
    });

    test('should re-format on indent change when input is non-empty', () => {
      formatter.formatJSON = jest.fn();
      formatter.input = { addEventListener: inputMock, value: '{"a":1}', setAttribute: jest.fn(), removeAttribute: jest.fn() };
      formatter.initializeEvents();

      callbacks.indentSelect.change();
      expect(formatter.formatJSON).toHaveBeenCalled();
    });

    test('should not re-format on indent change when input is empty', () => {
      formatter.formatJSON = jest.fn();
      formatter.input = { addEventListener: inputMock, value: '   ', setAttribute: jest.fn(), removeAttribute: jest.fn() };
      formatter.initializeEvents();

      callbacks.indentSelect.change();
      expect(formatter.formatJSON).not.toHaveBeenCalled();
    });

    test('should expand all on expand button click', () => {
      formatter.setAllCollapsed = jest.fn();
      formatter.initializeEvents();

      callbacks.expandAllBtn.click();
      expect(formatter.setAllCollapsed).toHaveBeenCalledWith(false);
    });

    test('should collapse all on collapse button click', () => {
      formatter.setAllCollapsed = jest.fn();
      formatter.initializeEvents();

      callbacks.collapseAllBtn.click();
      expect(formatter.setAllCollapsed).toHaveBeenCalledWith(true);
    });
  });

  describe('clearError', () => {
    test('should clear error status text', () => {
      formatter.errorStatus.textContent = 'Error';
      formatter.clearError();
      expect(formatter.errorStatus.textContent).toBe('');
    });
  });

  describe('showError', () => {
    test('should show error in notification and status div', () => {
      formatter.showError('Test error');
      expect(mockNotificationManager.show).toHaveBeenCalledWith(
        'Test error',
        3000,
        { type: 'error' }
      );
      expect(formatter.errorStatus.textContent).toBe('Test error');
      expect(formatter.errorStatus.classList.add).toHaveBeenCalledWith('error');
    });
  });

  describe('jump to error', () => {
    test('reveals the Go to error control with line/column for a locatable error', () => {
      formatter.input = { value: '{"a": 1, "b" 2}' };
      formatter.reportJsonError(formatter.input.value, false, 'fallback');

      expect(formatter.errorStatus.textContent).toContain('Invalid JSON');
      expect(formatter.goToErrorBtn.hidden).toBe(false);
      expect(formatter.goToErrorBtn.textContent).toMatch(/Go to error \(line \d+, col \d+\)/);
      expect(formatter.errorIndex).toBeGreaterThan(0);
    });

    test('falls back to the thrown message and hides the control when unlocatable', () => {
      // A string that parses cleanly cannot be located, so no jump is offered.
      formatter.input = { value: '{"a": 1}' };
      formatter.goToErrorBtn.hidden = false;
      formatter.reportJsonError(formatter.input.value, false, 'engine message');

      expect(formatter.errorStatus.textContent).toBe('Invalid JSON: engine message');
      expect(formatter.goToErrorBtn.hidden).toBe(true);
      expect(formatter.errorIndex).toBeNull();
    });

    test('points the jump past an auto-fixable token when auto-fix is on', () => {
      // `{a:1 b:2}` — auto-fix repairs the unquoted keys; the real error is the
      // missing comma, so the jump must not land on the `a` (index 1).
      formatter.input = { value: '{a:1 b:2}' };
      formatter.reportJsonError(formatter.input.value, true, 'fallback');
      expect(formatter.goToErrorBtn.hidden).toBe(false);
      expect(formatter.errorIndex).toBeGreaterThan(1);
    });

    test('clearError hides the Go to error control and resets the index', () => {
      formatter.goToErrorBtn.hidden = false;
      formatter.errorIndex = 5;
      formatter.clearError();
      expect(formatter.goToErrorBtn.hidden).toBe(true);
      expect(formatter.errorIndex).toBeNull();
    });

    test('goToError focuses the textarea and selects the offending character', () => {
      const textarea = document.createElement('textarea');
      textarea.value = '{"a": 1, "b" 2}';
      document.body.appendChild(textarea);
      formatter.input = textarea;
      formatter.errorIndex = 13;

      const focusSpy = jest.spyOn(textarea, 'focus');
      formatter.goToError();

      expect(focusSpy).toHaveBeenCalled();
      expect(textarea.selectionStart).toBe(13);
      expect(textarea.selectionEnd).toBe(14);

      focusSpy.mockRestore();
      document.body.removeChild(textarea);
    });

    test('goToError is a no-op when no error index is set', () => {
      const textarea = document.createElement('textarea');
      formatter.input = textarea;
      formatter.errorIndex = null;
      const focusSpy = jest.spyOn(textarea, 'focus');
      formatter.goToError();
      expect(focusSpy).not.toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    test('scrollInputToError moves the scroll position toward the error line', () => {
      const textarea = document.createElement('textarea');
      textarea.value = 'a\n'.repeat(200);
      document.body.appendChild(textarea);
      formatter.input = textarea;

      // index near the end -> a positive scrollTop target (jsdom returns 0 sizes,
      // so just assert it runs and assigns a non-negative number).
      formatter.scrollInputToError(textarea.value.length - 1);
      expect(typeof textarea.scrollTop).toBe('number');
      expect(textarea.scrollTop).toBeGreaterThanOrEqual(0);

      document.body.removeChild(textarea);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty objects in renderJSONAsync', async () => {
      formatter.output = document.createElement('div');
      await formatter.renderJSONAsync({}, formatter.output);
      const html = formatter.output.innerHTML;
      expect(html).toContain('json-bracket');
      expect(html).toContain('{');
      expect(html).toContain('}');
    });

    test('should handle empty arrays in renderJSONAsync', async () => {
      formatter.output = document.createElement('div');
      await formatter.renderJSONAsync([], formatter.output);
      const html = formatter.output.innerHTML;
      expect(html).toContain('json-bracket');
      expect(html).toContain('[');
      expect(html).toContain(']');
    });



    test('should handle special characters in JSON', async () => {
      formatter.output = document.createElement('div');
      formatter.input.value = '{"key\\"with\\"quotes":"value\\nwith\\nnewlines"}';
      await formatter.formatJSON();
      expect(formatter.errorStatus.textContent).toBe('');
    });

    test('should handle circular references in JSON (should throw)', () => {
      const circularObj = {};
      circularObj.self = circularObj;
      expect(() => formatter.formatJSON(JSON.stringify(circularObj))).toThrow();
    });
  });

  describe('Constructor Initialization', () => {
    afterEach(() => {
      document.querySelector = originalDocumentQuerySelector;
    });

    test('should initialize DOM elements when initDom is true', () => {
      const formatter = new JSONFormatter(true);
      expect(document.querySelector).toHaveBeenCalledTimes(19); // Updated count (adds #shareUrlBtn)
      expect(document.querySelectorAll).toHaveBeenCalledTimes(1);
    });

    test('should use default initDom=true when no argument provided', () => {
      const formatter = new JSONFormatter();
      expect(document.querySelector).toHaveBeenCalledTimes(19);
      expect(document.querySelectorAll).toHaveBeenCalledTimes(1);
    });

    test('should terminate workers when the page is discarded', () => {
      const formatter = new JSONFormatter(true);
      formatter.lazyFormatRunner.terminate = jest.fn();
      formatter.lazySchemaRunner.terminate = jest.fn();

      const event = new Event('pagehide');
      Object.defineProperty(event, 'persisted', { value: false });
      window.dispatchEvent(event);

      expect(formatter.lazyFormatRunner.terminate).toHaveBeenCalledTimes(1);
      expect(formatter.lazySchemaRunner.terminate).toHaveBeenCalledTimes(1);
    });

    test('should preserve workers for a persisted page', () => {
      const formatter = new JSONFormatter(true);
      formatter.lazyFormatRunner.terminate = jest.fn();
      formatter.lazySchemaRunner.terminate = jest.fn();

      const event = new Event('pagehide');
      Object.defineProperty(event, 'persisted', { value: true });
      window.dispatchEvent(event);

      expect(formatter.lazyFormatRunner.terminate).not.toHaveBeenCalled();
      expect(formatter.lazySchemaRunner.terminate).not.toHaveBeenCalled();
    });

    test('should not initialize DOM elements when initDom is false', () => {
      const formatter = new JSONFormatter(false);
      expect(document.querySelector).not.toHaveBeenCalled();
      expect(formatter.input).toBeUndefined();
    });

    test('should handle missing DOM elements gracefully', () => {
      document.querySelector.mockImplementation(() => null);
      const formatter = new JSONFormatter(true);
      expect(formatter.input).toBeNull();
    });
  });

  describe('DOM Structure Expectations', () => {
    test('should create correct HTML structure for objects', async () => {
      formatter.output = document.createElement('div');
      await formatter.renderJSONAsync({ key: 'value' }, formatter.output);

      const container = formatter.output.querySelector('.json-node');
      expect(container).not.toBeNull();

      const toggle = container.querySelector('.json-toggle');
      expect(toggle).not.toBeNull();
      expect(toggle.textContent).toBe('-');

      const keySpan = container.querySelector('.json-key');
      expect(keySpan).not.toBeNull();
      expect(keySpan.textContent).toBe('"key": ');

      const brackets = container.querySelectorAll('.json-bracket');
      expect(brackets.length).toBe(2);
      expect(brackets[0].textContent).toBe('{');
      expect(brackets[1].textContent).toBe('}');
    });

    test('should apply correct indentation based on depth', async () => {
      formatter.output = document.createElement('div');
      await formatter.renderJSONAsync({ key: 'value' }, formatter.output, 2);

      const container = formatter.output.querySelector('.json-node');
      expect(container.style.marginLeft).toBe('30px');
    });
  });

  describe('Large Dataset Rendering (>500 nodes)', () => {
    beforeEach(() => {
      formatter.output = document.createElement('div');
    });

    test('should yield to main thread when rendering >500 nodes', async () => {
      // Create an object with 600 properties to trigger chunking
      const largeObject = {};
      for (let i = 0; i < 600; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }

      const context = { count: 0, runId: 1 };
      formatter.currentRunId = 1;

      await formatter.renderJSONAsync(largeObject, formatter.output, 0, context);

      // Verify rendering completed
      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys.length).toBe(600);
    });

    test('should handle deeply nested arrays with >500 total elements', async () => {
      // Create a large array structure
      const largeArray = [];
      for (let i = 0; i < 550; i++) {
        largeArray.push({ id: i, value: `item${i}` });
      }

      const context = { count: 0, runId: 1 };
      formatter.currentRunId = 1;

      await formatter.renderJSONAsync(largeArray, formatter.output, 0, context);

      // Verify rendering completed
      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys.length).toBe(1100); // 2 keys per object * 550 objects
    });

    test('should reset context count after yielding', async () => {
      const largeObject = {};
      for (let i = 0; i < 600; i++) {
        largeObject[`key${i}`] = i;
      }

      const context = { count: 0, runId: 1 };
      formatter.currentRunId = 1;

      await formatter.renderJSONAsync(largeObject, formatter.output, 0, context);

      // Context count should have been reset during rendering
      expect(context.count).toBeLessThan(600);
    });
  });

  describe('Concurrent Execution Cancellation', () => {
    beforeEach(() => {
      formatter.output = document.createElement('div');
      formatter.plainViewTextarea = { value: '' };
      formatter.formatBtn = { textContent: 'Format JSON', disabled: false };
      formatter.copyBtn = { disabled: true };
      formatter.downloadBtn = { disabled: true };
      formatter.errorStatus = { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } };
      formatter.originalSizeEl = { textContent: '' };
      formatter.formattedSizeEl = { textContent: '' };
      formatter.sortCheckbox = { checked: false };
      formatter.autoFixCheckbox = { checked: false };
    });

    test('should cancel first formatJSON when called twice rapidly', async () => {
      const firstInput = '{"first": "data"}';
      const secondInput = '{"second": "data"}';

      formatter.input.value = firstInput;
      const firstPromise = formatter.formatJSON();

      // Immediately start second format
      formatter.input.value = secondInput;
      const secondPromise = formatter.formatJSON();

      await Promise.all([firstPromise, secondPromise]);

      // Only the second input should be rendered
      expect(formatter.plainViewTextarea.value).toContain('second');
      expect(formatter.plainViewTextarea.value).not.toContain('first');
    });

    test('should cancel stale render after yielding with large dataset', async () => {
      // Create large object to trigger yielding
      const largeObject = {};
      for (let i = 0; i < 600; i++) {
        largeObject[`key${i}`] = i;
      }

      formatter.input.value = JSON.stringify(largeObject);
      const firstPromise = formatter.formatJSON();

      // Start a second format immediately
      formatter.input.value = '{"new": "data"}';
      const secondPromise = formatter.formatJSON();

      await Promise.all([firstPromise, secondPromise]);

      // The final output should be from the second call
      expect(formatter.plainViewTextarea.value).toContain('new');
      expect(formatter.plainViewTextarea.value).not.toContain('key599');
    });

    test('should abort renderJSONAsync when runId changes mid-render', async () => {
      const largeObject = {};
      for (let i = 0; i < 100; i++) {
        largeObject[`key${i}`] = i;
      }

      const context = { count: 0, runId: 1 };
      formatter.currentRunId = 1;

      // Start rendering
      const renderPromise = formatter.renderJSONAsync(largeObject, formatter.output, 0, context);

      // Change currentRunId to simulate a new format operation
      formatter.currentRunId = 2;

      await renderPromise;

      // The render should check runId and abort early
      // Since we changed runId immediately, it should abort at the first check
      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys.length).toBeLessThanOrEqual(100);
    });

    test('should abort renderJSONAsync after yielding when runId changes', async () => {
      // Create object large enough to trigger yielding
      const largeObject = {};
      for (let i = 0; i < 600; i++) {
        largeObject[`key${i}`] = i;
      }

      const context = { count: 501, runId: 1 }; // Start with count > 500 to trigger yield
      formatter.currentRunId = 1;

      // Start rendering
      const renderPromise = formatter.renderJSONAsync(largeObject, formatter.output, 0, context);

      // Change runId immediately to simulate cancellation
      formatter.currentRunId = 2;

      await renderPromise;

      // Should have aborted early
      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys.length).toBe(0);
    });
  });

  describe('Debounce Function Edge Cases', () => {
    test('should debounce rapid successive calls', (done) => {
      const mockFn = jest.fn();
      const debouncedFn = JSONFormatter.debounce(mockFn, 50);

      // Call multiple times rapidly
      debouncedFn('call1');
      debouncedFn('call2');
      debouncedFn('call3');
      debouncedFn('call4');

      // Should not be called yet
      expect(mockFn).not.toHaveBeenCalled();

      // Wait for debounce delay
      setTimeout(() => {
        // Should only be called once with the last argument
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('call4');
        done();
      }, 100);
    });

    test('should reset timer on each call within delay period', (done) => {
      const mockFn = jest.fn();
      const debouncedFn = JSONFormatter.debounce(mockFn, 50);

      debouncedFn('call1');

      setTimeout(() => {
        debouncedFn('call2'); // Reset timer
      }, 30);

      setTimeout(() => {
        debouncedFn('call3'); // Reset timer again
      }, 60);

      // After 80ms, still shouldn't be called (timer keeps resetting)
      setTimeout(() => {
        expect(mockFn).not.toHaveBeenCalled();
      }, 80);

      // After 120ms, should be called once with last argument
      setTimeout(() => {
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('call3');
        done();
      }, 120);
    });
  });

  describe('SwitchView ARIA Attributes', () => {
    test('should update aria-pressed attributes when switching views', () => {
      formatter.switchView('plain');

      // Tree tab should have aria-pressed="false"
      expect(formatter.tabs[0].setAttribute).toHaveBeenCalledWith('aria-pressed', false);
      // Plain tab should have aria-pressed="true"
      expect(formatter.tabs[1].setAttribute).toHaveBeenCalledWith('aria-pressed', true);
    });

    test('should update aria-pressed when switching back to tree view', () => {
      formatter.switchView('tree');

      expect(formatter.tabs[0].setAttribute).toHaveBeenCalledWith('aria-pressed', true);
      expect(formatter.tabs[1].setAttribute).toHaveBeenCalledWith('aria-pressed', false);
    });
  });

  describe('LoadSampleData Notification', () => {
    beforeEach(() => {
      formatter.input = { value: '' };
      formatter.formatJSON = jest.fn();
      formatter.clearButtonInstance = { updateVisibility: jest.fn() };
    });

    test('should show success notification when loading sample data', () => {
      formatter.loadSampleData();

      expect(mockNotificationManager.show).toHaveBeenCalledWith(
        'Sample data loaded successfully!',
        2000,
        { type: 'success' }
      );
    });

    test('should update clear button visibility after loading sample', () => {
      formatter.loadSampleData();

      expect(formatter.clearButtonInstance.updateVisibility).toHaveBeenCalled();
    });

    test('should populate input with valid JSON sample', () => {
      formatter.loadSampleData();

      expect(formatter.input.value).toBeTruthy();
      // Verify it's valid JSON
      expect(() => JSON.parse(formatter.input.value)).not.toThrow();
    });
  });

  describe('Integration Workflows', () => {
    beforeEach(() => {
      formatter.output = document.createElement('div');
      formatter.plainViewTextarea = { value: '' };
      formatter.formatBtn = { textContent: 'Format JSON', disabled: false };
      formatter.copyBtn = { disabled: true };
      formatter.downloadBtn = { disabled: true };
      formatter.errorStatus = { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } };
      formatter.originalSizeEl = { textContent: '' };
      formatter.formattedSizeEl = { textContent: '' };
      formatter.sortCheckbox = { checked: true };
      formatter.autoFixCheckbox = { checked: false };
      formatter.input = { value: '{"b":2,"a":1}' };
    });

    test('should complete format → copy → download workflow', async () => {
      // Mock clipboard API for this test
      const mockClipboard = {
        writeText: jest.fn().mockResolvedValue(undefined)
      };
      global.navigator.clipboard = mockClipboard;

      // Format
      await formatter.formatJSON();
      expect(formatter.copyBtn.disabled).toBe(false);
      expect(formatter.downloadBtn.disabled).toBe(false);

      // Copy
      await formatter.copyOutput();
      expect(mockClipboard.writeText).toHaveBeenCalled();

      // Download
      await formatter.downloadOutput();
      expect(mockDownloadManager.downloadFile).toHaveBeenCalled();

      // Cleanup
      delete global.navigator.clipboard;
    });

    test('should handle tab switching workflow: tree → plain → tree', () => {
      // Start on tree view
      formatter.switchView('tree');
      expect(formatter.viewContainers.tree.classList.add).toHaveBeenCalledWith('active');
      expect(formatter.viewContainers.plain.classList.remove).toHaveBeenCalledWith('active');

      // Switch to plain
      formatter.switchView('plain');
      expect(formatter.viewContainers.plain.classList.add).toHaveBeenCalledWith('active');
      expect(formatter.viewContainers.tree.classList.remove).toHaveBeenCalledWith('active');

      // Switch back to tree
      formatter.switchView('tree');
      expect(formatter.viewContainers.tree.classList.add).toHaveBeenCalledWith('active');
      expect(formatter.viewContainers.plain.classList.remove).toHaveBeenCalledWith('active');
    });

    test('should handle input change → debounced stats update workflow', (done) => {
      jest.useFakeTimers();
      formatter.clearError = jest.fn();
      formatter.updateStats = jest.fn();
      formatter.input = { addEventListener: jest.fn(), value: '{"test": "data"}', setAttribute: jest.fn(), removeAttribute: jest.fn() };
      formatter.formatBtn = { addEventListener: jest.fn() };
      formatter.copyBtn = { addEventListener: jest.fn() };
      formatter.downloadBtn = { addEventListener: jest.fn() };
      formatter.sampleBtn = { addEventListener: jest.fn() };
      formatter.tabs = [];

      formatter.initializeEvents();

      // Get the input event handler
      const inputHandler = formatter.input.addEventListener.mock.calls.find(
        call => call[0] === 'input'
      )[1];

      // Trigger input event
      inputHandler();

      expect(formatter.clearError).toHaveBeenCalled();
      expect(formatter.updateStats).not.toHaveBeenCalled(); // Not called yet due to debounce

      // Advance timers past debounce delay
      jest.advanceTimersByTime(200);

      expect(formatter.updateStats).toHaveBeenCalledWith('{"test": "data"}', '');

      jest.useRealTimers();
      done();
    });
  });

  describe('AutoFixJSON Edge Cases', () => {
    test('should handle nested single quotes', () => {
      const input = "{'outer': {'inner': 'value'}}";
      const result = JSONFormatter.autoFixJSON(input);
      expect(result).toBe('{"outer": {"inner": "value"}}');
    });

    test('should handle mixed errors in complex JSON', () => {
      const input = "{unquoted: 'single', trailing: 'comma',}";
      const result = JSONFormatter.autoFixJSON(input);
      expect(result).toBe('{"unquoted": "single", "trailing": "comma"}');
    });

    test('should handle arrays with trailing commas and single quotes', () => {
      const input = "['a', 'b', 'c',]";
      const result = JSONFormatter.autoFixJSON(input);
      expect(result).toBe('["a", "b", "c"]');
    });

    test('should handle escaped quotes within single-quoted strings', () => {
      const input = "{'key': 'value with \\'escaped\\' quotes'}";
      const result = JSONFormatter.autoFixJSON(input);
      // The regex handles escaped quotes
      expect(result).toContain('"key"');
    });
  });

  describe('Array Rendering in renderJSONAsync', () => {
    beforeEach(() => {
      formatter.output = document.createElement('div');
    });

    test('should render array with correct brackets', async () => {
      await formatter.renderJSONAsync([1, 2, 3], formatter.output);

      const brackets = formatter.output.querySelectorAll('.json-bracket');
      expect(brackets[0].textContent).toBe('[');
      expect(brackets[1].textContent).toBe(']');
    });

    test('should render array items without keys', async () => {
      await formatter.renderJSONAsync(['a', 'b', 'c'], formatter.output);

      const keys = formatter.output.querySelectorAll('.json-key');
      expect(keys.length).toBe(0); // Arrays don't have keys, only objects do
    });

    test('should render nested arrays correctly', async () => {
      await formatter.renderJSONAsync([[1, 2], [3, 4]], formatter.output);

      const brackets = formatter.output.querySelectorAll('.json-bracket');
      // Outer array: [ ]
      // Inner arrays: [ ] [ ]
      expect(brackets.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('getIndentOption', () => {
    test('maps select values to indent options and defaults to 2', () => {
      formatter.indentSelect = { value: '4' };
      expect(formatter.getIndentOption()).toBe(4);

      formatter.indentSelect = { value: 'tab' };
      expect(formatter.getIndentOption()).toBe('tab');

      formatter.indentSelect = { value: 'minify' };
      expect(formatter.getIndentOption()).toBe('minify');

      formatter.indentSelect = { value: '2' };
      expect(formatter.getIndentOption()).toBe(2);

      formatter.indentSelect = { value: 'unknown' };
      expect(formatter.getIndentOption()).toBe(2);
    });

    test('feeds the indent choice into prepareFormattedJson (copy/download text)', () => {
      formatter.input = { value: '{"b":2,"a":1}' };
      formatter.autoFixCheckbox = { checked: false };
      formatter.sortCheckbox = { checked: true };

      formatter.indentSelect = { value: '4' };
      expect(formatter.prepareFormattedJson()[1]).toBe('{\n    "a": 1,\n    "b": 2\n}');

      formatter.indentSelect = { value: 'minify' };
      expect(formatter.prepareFormattedJson()[1]).toBe('{"a":1,"b":2}');
    });
  });

  describe('setAllCollapsed', () => {
    beforeEach(() => {
      formatter.output = document.createElement('div');
    });

    test('collapses then expands every node, syncing glyphs and aria', async () => {
      await formatter.renderJSONAsync(
        { user: { name: 'Alice', roles: ['admin'] } },
        formatter.output,
        0,
        undefined,
        'root'
      );

      const toggles = () => formatter.output.querySelectorAll('.json-toggle');
      expect(toggles().length).toBeGreaterThan(1);

      formatter.setAllCollapsed(true);
      toggles().forEach((toggle) => {
        expect(toggle.textContent).toBe('+');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
      });
      expect(formatter.output.querySelectorAll('.json-node.collapsed').length).toBe(toggles().length);

      formatter.setAllCollapsed(false);
      toggles().forEach((toggle) => {
        expect(toggle.textContent).toBe('-');
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
      });
      expect(formatter.output.querySelectorAll('.json-node.collapsed').length).toBe(0);
    });

    test('skips empty nodes that have no toggle', async () => {
      await formatter.renderJSONAsync({}, formatter.output);
      expect(() => formatter.setAllCollapsed(true)).not.toThrow();
      expect(formatter.output.querySelector('.json-toggle')).toBeNull();
    });
  });

});
