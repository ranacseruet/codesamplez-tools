/**
 * `?` keyboard-shortcut help overlay (UI v4 Phase D3).
 *
 * Loaded as a lazy chunk by `registerShortcutHelp`/`openShortcutHelp` in
 * `common/shortcut-utils.ts` — nothing here belongs in a tool's main bundle,
 * since the overlay only ever renders after a deliberate `?` press or a click
 * on the shell's shortcuts button.
 *
 * Two implementation choices are deliberate and worth keeping:
 *
 * - **Plain DOM, not Preact.** Rendering this chunk with Preact makes webpack
 *   expose the preact modules to it from the main bundle, which breaks scope
 *   hoisting there: measured at **+3.7 KB minified in every tool's main
 *   bundle** (text-analyzer went over its budget). The overlay is static
 *   markup with no state, so `createElement`/`textContent` costs nothing in
 *   readability and keeps the chunk dependency-free apart from one tiny helper.
 * - **A plain overlay, not `<dialog>.showModal()`.** jsdom (30.x) implements
 *   neither `showModal` nor its focus behaviour, so the native version could
 *   only be tested against a shim — a test that cannot observe the broken
 *   state. Focus trapping and Escape are ~30 lines here, with real assertions.
 *
 * The contents are derived from the live DOM at open time rather than from a
 * per-page config: the tool search island, the primary-action button, and the
 * drag-and-drop targets all already mark themselves in the markup, so a page
 * can never advertise a shortcut it does not have (or omit one it gained).
 */

import { formatModifierChord } from './shortcut-utils';

const HOST_ELEMENT_ID = 'cst-shortcut-help-root';
const TITLE_ELEMENT_ID = 'cst-shortcut-help-title';
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface ShortcutRow {
    /** Rendered as individual `<kbd>` chips, in press order. */
    keys: string[];
    description: string;
}

export interface ShortcutSection {
    title: string;
    rows: ShortcutRow[];
}

export interface ShortcutHelpContent {
    sections: ShortcutSection[];
    tips: string[];
}

/**
 * The primary action button's own label ("Format JSON", "Compare"), read from
 * its leading text nodes so the `.c-kbd` hint chip inside it is not included.
 */
function getPrimaryActionLabel(doc: Document): string | null {
    const hintChip = doc.querySelector('.c-kbd');
    const button = hintChip ? hintChip.closest('button') : null;
    if (!button) {
        return null;
    }

    let label = '';
    for (let index = 0; index < button.childNodes.length; index += 1) {
        const node = button.childNodes[index];
        if (node.nodeType === 3 /* Node.TEXT_NODE */) {
            label += node.textContent || '';
        }
    }

    label = label.trim();
    return label || null;
}

/**
 * Builds the overlay contents for the current page. Exported for tests and for
 * anyone auditing which shortcuts a page claims to support.
 */
export function buildShortcutHelpContent(doc: Document = document): ShortcutHelpContent {
    const sections: ShortcutSection[] = [];
    const tips: string[] = [];

    if (doc.getElementById('tool-search-root')) {
        sections.push({
            title: 'Tool search',
            rows: [
                { keys: [formatModifierChord('K')], description: 'Focus the tool search' },
                { keys: ['/'], description: 'Focus the tool search' },
                { keys: ['↑', '↓'], description: 'Move through the results' },
                { keys: ['↵'], description: 'Open the highlighted tool' }
            ]
        });
    }

    const primaryActionLabel = getPrimaryActionLabel(doc);
    if (primaryActionLabel) {
        sections.push({
            title: 'This tool',
            rows: [{ keys: [formatModifierChord('↵')], description: `Run ${primaryActionLabel}` }]
        });
    }

    sections.push({
        title: 'Everywhere',
        rows: [
            { keys: ['?'], description: 'Show this help' },
            { keys: ['Esc'], description: 'Close this help' }
        ]
    });

    if (doc.querySelector('[data-drop-target]')) {
        tips.push(
            'Drag a file onto any input to load it — files are read in this browser and never uploaded.'
        );
    }

    return { sections, tips };
}

function createElement(
    doc: Document,
    tagName: string,
    className?: string,
    text?: string
): HTMLElement {
    const element = doc.createElement(tagName);
    if (className) {
        element.className = className;
    }
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}

function renderSection(doc: Document, section: ShortcutSection): HTMLElement {
    const sectionElement = createElement(doc, 'section', 'cst-shortcut-help__section');
    sectionElement.appendChild(
        createElement(doc, 'h3', 'cst-shortcut-help__section-title', section.title)
    );

    const list = createElement(doc, 'dl', 'cst-shortcut-help__list');
    section.rows.forEach((row) => {
        const rowElement = createElement(doc, 'div', 'cst-shortcut-help__row');
        const keys = createElement(doc, 'dt', 'cst-shortcut-help__keys');
        row.keys.forEach((key) => {
            keys.appendChild(createElement(doc, 'kbd', 'cst-shortcut-help__key', key));
        });
        rowElement.appendChild(keys);
        rowElement.appendChild(
            createElement(doc, 'dd', 'cst-shortcut-help__description', row.description)
        );
        list.appendChild(rowElement);
    });

    sectionElement.appendChild(list);
    return sectionElement;
}

function renderOverlay(doc: Document, content: ShortcutHelpContent): HTMLElement {
    const overlay = createElement(doc, 'div', 'cst-shortcut-help');
    overlay.setAttribute('role', 'presentation');

    const panel = createElement(doc, 'div', 'cst-shortcut-help__panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', TITLE_ELEMENT_ID);

    const head = createElement(doc, 'div', 'cst-shortcut-help__head');
    const title = createElement(doc, 'h2', 'cst-shortcut-help__title', 'Keyboard shortcuts');
    title.id = TITLE_ELEMENT_ID;
    const closeButton = createElement(doc, 'button', 'cst-shortcut-help__close');
    closeButton.setAttribute('type', 'button');
    closeButton.setAttribute('aria-label', 'Close keyboard shortcuts');
    const closeGlyph = createElement(doc, 'span', undefined, '×');
    closeGlyph.setAttribute('aria-hidden', 'true');
    closeButton.appendChild(closeGlyph);
    head.appendChild(title);
    head.appendChild(closeButton);
    panel.appendChild(head);

    content.sections.forEach((section) => {
        panel.appendChild(renderSection(doc, section));
    });
    content.tips.forEach((tip) => {
        panel.appendChild(createElement(doc, 'p', 'cst-shortcut-help__tip', tip));
    });

    overlay.appendChild(panel);
    return overlay;
}

let hostElement: HTMLElement | null = null;
let previouslyFocusedElement: HTMLElement | null = null;
let activeDocument: Document | null = null;

function getFocusableElements(): HTMLElement[] {
    /* istanbul ignore next -- unreachable: only called with the overlay open */
    if (!hostElement) {
        return [];
    }

    const focusable: HTMLElement[] = [];
    hostElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR).forEach((element) => {
        if (!element.hasAttribute('disabled')) {
            focusable.push(element);
        }
    });
    return focusable;
}

// Backdrop clicks close; clicks inside the panel must not, so this checks the
// event target rather than relying on stopPropagation (which would also swallow
// clicks the page's own listeners care about).
function handleOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
        closeShortcutHelpDialog();
    }
}

// Capture phase on the document, so the overlay sees every keystroke before the
// page does. While it is open it swallows all of them: the page's own
// document-level shortcuts (`/` and Cmd/Ctrl+K focus the tool search,
// Cmd/Ctrl+Enter runs the primary action) would otherwise act *behind* the
// modal — moving focus out of it, or changing a tool's output while the user
// is reading the help. Propagation is stopped for every keydown, including
// those targeted inside the overlay, since the page's listeners sit on the
// document either way. The default action is never cancelled, so the browser
// still activates the focused close button, types, and runs its own shortcuts.
function handleDocumentKeydown(event: KeyboardEvent): void {
    event.stopPropagation();

    if (event.key === 'Escape') {
        event.preventDefault();
        closeShortcutHelpDialog();
        return;
    }

    if (event.key !== 'Tab') {
        return;
    }

    const focusable = getFocusableElements();
    /* istanbul ignore next -- unreachable: the overlay always renders its close button */
    if (focusable.length === 0) {
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = activeDocument ? activeDocument.activeElement : null;

    // Wrap at both ends so focus cannot walk back into the page behind the
    // overlay while it is modal.
    if (event.shiftKey && (active === first || !hostElement?.contains(active))) {
        event.preventDefault();
        last.focus();
        return;
    }

    if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
    }
}

/** Opens the overlay. A second call while it is open is a no-op. */
export function openShortcutHelpDialog(doc: Document = document): void {
    if (hostElement) {
        return;
    }

    activeDocument = doc;
    previouslyFocusedElement = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;

    hostElement = doc.createElement('div');
    hostElement.id = HOST_ELEMENT_ID;

    const overlay = renderOverlay(doc, buildShortcutHelpContent(doc));
    overlay.addEventListener('click', handleOverlayClick as EventListener);
    overlay
        .querySelector('.cst-shortcut-help__close')
        ?.addEventListener('click', () => closeShortcutHelpDialog());

    hostElement.appendChild(overlay);
    doc.body.appendChild(hostElement);

    doc.addEventListener('keydown', handleDocumentKeydown, true);
    getFocusableElements()[0]?.focus();
}

/** Closes the overlay and returns focus where it was. Safe to call when closed. */
export function closeShortcutHelpDialog(): void {
    if (!hostElement || !activeDocument) {
        return;
    }

    activeDocument.removeEventListener('keydown', handleDocumentKeydown, true);
    hostElement.remove();
    hostElement = null;
    activeDocument = null;

    previouslyFocusedElement?.focus();
    previouslyFocusedElement = null;
}
