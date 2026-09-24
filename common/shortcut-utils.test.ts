import { waitFor } from '@testing-library/dom';
import {
  formatModifierChord,
  isEditableTarget,
  openShortcutHelp,
  registerPrimaryActionShortcut,
  registerShortcutHelp
} from './shortcut-utils';
import { closeShortcutHelpDialog } from './shortcut-help';

// The overlay arrives through a real dynamic import (Jest's VM-modules mode
// leaves `import()` native, so it cannot be mocked) — these tests assert on the
// overlay it actually renders.
function isHelpOverlayOpen(): boolean {
  return document.querySelector('.cst-shortcut-help') !== null;
}

/** Lets a rejected/settled dynamic import drain without asserting a turn count. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function setPlatform(platform: string): void {
  Object.defineProperty(window.navigator, 'platform', {
    value: platform,
    configurable: true
  });
}

describe('registerPrimaryActionShortcut', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }
  });

  it('clicks the target button on Cmd+Enter', () => {
    const button = document.createElement('button');
    const clickSpy = jest.spyOn(button, 'click');
    cleanup = registerPrimaryActionShortcut(button);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('clicks the target button on Ctrl+Enter', () => {
    const button = document.createElement('button');
    const clickSpy = jest.spyOn(button, 'click');
    cleanup = registerPrimaryActionShortcut(button);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('invokes a callback target', () => {
    const callback = jest.fn();
    cleanup = registerPrimaryActionShortcut(callback);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('fires once per press, ignoring key auto-repeat while the chord is held', () => {
    const callback = jest.fn();
    cleanup = registerPrimaryActionShortcut(callback);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }));
    const repeat = new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, repeat: true, cancelable: true });
    document.dispatchEvent(repeat);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, repeat: true }));

    expect(callback).toHaveBeenCalledTimes(1);
    // Repeats are still swallowed so the browser default doesn't leak through.
    expect(repeat.defaultPrevented).toBe(true);
  });

  it('ignores plain Enter without a modifier', () => {
    const button = document.createElement('button');
    const clickSpy = jest.spyOn(button, 'click');
    cleanup = registerPrimaryActionShortcut(button);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('ignores modifier combinations with other keys', () => {
    const callback = jest.fn();
    cleanup = registerPrimaryActionShortcut(callback);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', ctrlKey: true }));

    expect(callback).not.toHaveBeenCalled();
  });

  it('prevents the default browser behavior of Cmd/Ctrl+Enter', () => {
    const callback = jest.fn();
    cleanup = registerPrimaryActionShortcut(callback);

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('stops firing after cleanup', () => {
    const button = document.createElement('button');
    const clickSpy = jest.spyOn(button, 'click');
    cleanup = registerPrimaryActionShortcut(button);
    cleanup();
    cleanup = undefined;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }));

    expect(clickSpy).not.toHaveBeenCalled();
  });
});

describe('isEditableTarget', () => {
  it.each([
    ['an input', 'input'],
    ['a textarea', 'textarea'],
    ['a select', 'select']
  ])('is true for %s', (_label, tagName) => {
    expect(isEditableTarget(document.createElement(tagName))).toBe(true);
  });

  it('is true for a contenteditable element', () => {
    const editor = document.createElement('div');
    // jsdom does not derive isContentEditable from the attribute.
    Object.defineProperty(editor, 'isContentEditable', { value: true });

    expect(isEditableTarget(editor)).toBe(true);
  });

  it('is false for a plain element and for a non-element target', () => {
    expect(isEditableTarget(document.createElement('div'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(document)).toBe(false);
  });
});

describe('formatModifierChord', () => {
  const originalPlatform = window.navigator.platform;

  afterEach(() => {
    setPlatform(originalPlatform);
  });

  it('uses the command glyph on Apple platforms', () => {
    setPlatform('MacIntel');

    expect(formatModifierChord('K')).toBe('⌘K');
  });

  it('spells out Ctrl elsewhere', () => {
    setPlatform('Win32');

    expect(formatModifierChord('↵')).toBe('Ctrl ↵');
  });
});

describe('registerShortcutHelp', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }
    closeShortcutHelpDialog();
    document.body.innerHTML = '';
  });

  it('opens the help overlay on "?"', async () => {
    cleanup = registerShortcutHelp();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));

    // Poll rather than assuming how many turns the chunk resolution takes.
    await waitFor(() => {
      expect(isHelpOverlayOpen()).toBe(true);
    });
  });

  it('prevents the default so the key never reaches a page find-as-you-type', () => {
    cleanup = registerShortcutHelp();

    const event = new KeyboardEvent('keydown', { key: '?', cancelable: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores "?" typed into a tool input', async () => {
    const input = document.createElement('textarea');
    document.body.appendChild(input);
    cleanup = registerShortcutHelp();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    await settle();

    expect(isHelpOverlayOpen()).toBe(false);
  });

  it.each([
    ['meta', { metaKey: true }],
    ['ctrl', { ctrlKey: true }],
    ['alt', { altKey: true }]
  ])('ignores "?" held with %s', async (_label, modifiers) => {
    cleanup = registerShortcutHelp();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', ...modifiers }));
    await settle();

    expect(isHelpOverlayOpen()).toBe(false);
  });

  it('stops firing after cleanup', async () => {
    cleanup = registerShortcutHelp();
    cleanup();
    cleanup = undefined;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    await settle();

    expect(isHelpOverlayOpen()).toBe(false);
  });
});

describe('openShortcutHelp', () => {
  afterEach(() => {
    closeShortcutHelpDialog();
    document.body.innerHTML = '';
  });

  it('loads the overlay chunk and opens it', async () => {
    await openShortcutHelp();

    expect(isHelpOverlayOpen()).toBe(true);
  });

  it('swallows a failed chunk load, leaving the page untouched', async () => {
    await expect(
      openShortcutHelp(() => Promise.reject(new Error('chunk load failed')))
    ).resolves.toBeUndefined();

    expect(isHelpOverlayOpen()).toBe(false);
  });
});
