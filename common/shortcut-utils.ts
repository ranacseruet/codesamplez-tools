/**
 * Shared keyboard shortcut helpers for tools.
 *
 * Contract (UI v4 Phase C): the primary action of every tool with an explicit
 * action button is reachable via Cmd/Ctrl+Enter, and the button carries a
 * `.c-kbd` hint chip. The hint is hidden on touch devices purely via CSS
 * (`@media (pointer: coarse)` in shared-styles.css), so this module only
 * handles the listener wiring.
 */

export type ShortcutCleanup = () => void;

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
