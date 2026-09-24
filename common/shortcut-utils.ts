/**
 * Shared keyboard shortcut helpers for tools.
 *
 * Contract (UI v4 Phase C): the primary action of every tool with an explicit
 * action button is reachable via Cmd/Ctrl+Enter, and the button carries a
 * `.c-kbd` hint chip. The hint is hidden on touch devices purely via CSS
 * (`@media (pointer: coarse)` in shared-styles.css), so this module only
 * handles the listener wiring.
 *
 * Phase D3 adds the `?` help overlay. Only the trigger lives here: the overlay
 * itself is a lazy chunk (`common/shortcut-help`), so pages pay for it on first
 * use rather than in every tool's main bundle.
 */

export type ShortcutCleanup = () => void;

/**
 * True for elements that own their keystrokes. Single-key shortcuts (`?`, `/`)
 * must not fire while the user is typing into a tool.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        // Boolean(): `isContentEditable` is undefined for detached elements in
        // jsdom, and callers rely on this being a strict boolean.
        Boolean(target.isContentEditable)
    );
}

/**
 * Renders a modifier chord the way the platform writes it: `⌘K` on Apple
 * keyboards, `Ctrl K` elsewhere. Single source of truth for the search hint
 * chip and the help overlay so the two never disagree.
 */
export function formatModifierChord(key: string): string {
    const platform = typeof navigator !== 'undefined' ? navigator.platform : '';
    return /Mac|iPhone|iPad/.test(platform) ? `⌘${key}` : `Ctrl ${key}`;
}

/**
 * Registers a document-level Cmd/Ctrl+Enter listener that clicks the given
 * button (or invokes the given callback). Clicking a disabled button is a
 * no-op in the browser, so disabled-state gating is preserved automatically.
 *
 * Returns a cleanup function that removes the listener.
 */
export function registerPrimaryActionShortcut(
  target: HTMLElement | (() => void),
): ShortcutCleanup {
  const handler = (event: KeyboardEvent) => {
    const isPrimaryModifier = event.metaKey || event.ctrlKey;
    if (!isPrimaryModifier || event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    // Holding the chord auto-repeats keydown; fire the action once per press.
    if (event.repeat) {
      return;
    }
    if (typeof target === 'function') {
      target();
    } else {
      target.click();
    }
  };

  document.addEventListener('keydown', handler);
  return () => {
    document.removeEventListener('keydown', handler);
  };
}

/**
 * Loads the help overlay chunk and opens it. Safe to call repeatedly: the
 * overlay module itself no-ops when it is already open.
 *
 * The import is deliberately unconditional *inside* this function and never at
 * module scope — that split is what keeps the overlay (and its markup) out of
 * every tool's main bundle. See the same pattern for the share codecs.
 */
type ShortcutHelpModule = typeof import('./shortcut-help');

export function openShortcutHelp(
  // Injectable only so the chunk-load failure path can be exercised in tests:
  // under Jest's VM-modules mode `import()` stays native and cannot be mocked.
  loadOverlay: () => Promise<ShortcutHelpModule> = () => import('./shortcut-help')
): Promise<void> {
  return loadOverlay()
    .then(({ openShortcutHelpDialog }) => {
      openShortcutHelpDialog();
    })
    .catch(() => {
      // A failed chunk load costs the user the help overlay and nothing else;
      // every shortcut it documents still works.
    });
}

/**
 * Registers the global `?` shortcut that opens the help overlay. Ignores the
 * key while the user is typing and while a modifier is held, so it never
 * competes with a browser or tool shortcut.
 */
export function registerShortcutHelp(): ShortcutCleanup {
  const handler = (event: KeyboardEvent) => {
    if (event.key !== '?' || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (isEditableTarget(event.target)) {
      return;
    }

    event.preventDefault();
    void openShortcutHelp();
  };

  document.addEventListener('keydown', handler);
  return () => {
    document.removeEventListener('keydown', handler);
  };
}
