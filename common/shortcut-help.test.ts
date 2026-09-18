import { fireEvent } from '@testing-library/dom';
import {
    buildShortcutHelpContent,
    closeShortcutHelpDialog,
    openShortcutHelpDialog
} from './shortcut-help';

function overlay(): HTMLElement | null {
    return document.querySelector('.cst-shortcut-help');
}

function sectionTitles(): string[] {
    return [...document.querySelectorAll('.cst-shortcut-help__section-title')].map(
        (element) => element.textContent ?? ''
    );
}

function rowText(): string[] {
    return [...document.querySelectorAll('.cst-shortcut-help__row')].map((row) =>
        (row.textContent ?? '').trim()
    );
}

function addSearchIsland(): void {
    const island = document.createElement('div');
    island.id = 'tool-search-root';
    document.body.appendChild(island);
}

function addPrimaryActionButton(label = 'Format JSON'): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.append(label);
    const hint = document.createElement('span');
    hint.className = 'c-kbd';
    hint.textContent = '⌘⏎';
    button.appendChild(hint);
    document.body.appendChild(button);
    return button;
}

describe('shortcut help overlay', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        closeShortcutHelpDialog();
        document.body.innerHTML = '';
    });

    describe('buildShortcutHelpContent', () => {
        it('always documents the global keys', () => {
            expect(sectionTitlesOf(buildShortcutHelpContent(document))).toEqual(['Everywhere']);
        });

        it('documents the tool search only on a page that has the island', () => {
            addSearchIsland();

            const { sections } = buildShortcutHelpContent(document);
            expect(sectionTitlesOf({ sections, tips: [] })).toEqual(['Tool search', 'Everywhere']);
            expect(sections[0].rows.map((row) => row.description)).toContain('Open the highlighted tool');
        });

        it('names the primary action of the current tool', () => {
            addPrimaryActionButton('Compare');

            const { sections } = buildShortcutHelpContent(document);
            const toolSection = sections.find((section) => section.title === 'This tool');
            expect(toolSection?.rows[0].description).toBe('Run Compare');
        });

        it('ignores a hint chip that is not inside a button', () => {
            const strayChip = document.createElement('span');
            strayChip.className = 'c-kbd';
            strayChip.textContent = '⌘⏎';
            document.body.appendChild(strayChip);

            expect(sectionTitlesOf(buildShortcutHelpContent(document))).toEqual(['Everywhere']);
        });

        it('advertises drag-and-drop only when the page registered a drop target', () => {
            expect(buildShortcutHelpContent(document).tips).toEqual([]);

            const input = document.createElement('textarea');
            input.setAttribute('data-drop-target', 'true');
            document.body.appendChild(input);

            expect(buildShortcutHelpContent(document).tips).toHaveLength(1);
            expect(buildShortcutHelpContent(document).tips[0]).toContain('never uploaded');
        });

        function sectionTitlesOf(content: ReturnType<typeof buildShortcutHelpContent>): string[] {
            return content.sections.map((section) => section.title);
        }
    });

    describe('openShortcutHelpDialog', () => {
        it('renders a labelled modal dialog', () => {
            openShortcutHelpDialog();

            const dialog = document.querySelector('[role="dialog"]');
            expect(dialog).not.toBeNull();
            expect(dialog?.getAttribute('aria-modal')).toBe('true');
            expect(
                document.getElementById(dialog?.getAttribute('aria-labelledby') ?? '')?.textContent
            ).toBe('Keyboard shortcuts');
        });

        it('renders the drag-and-drop tip when the page has a drop target', () => {
            const input = document.createElement('textarea');
            input.setAttribute('data-drop-target', 'true');
            document.body.appendChild(input);

            openShortcutHelpDialog();

            expect(document.querySelector('.cst-shortcut-help__tip')?.textContent).toContain(
                'never uploaded'
            );
        });

        it('renders no tip on a page without drop targets', () => {
            openShortcutHelpDialog();

            expect(document.querySelector('.cst-shortcut-help__tip')).toBeNull();
        });

        it('renders the page-specific rows', () => {
            addSearchIsland();
            addPrimaryActionButton('Compare');
            openShortcutHelpDialog();

            expect(sectionTitles()).toEqual(['Tool search', 'This tool', 'Everywhere']);
            expect(rowText().some((text) => text.includes('Run Compare'))).toBe(true);
        });

        it('moves focus into the overlay and restores it on close', () => {
            const trigger = document.createElement('button');
            document.body.appendChild(trigger);
            trigger.focus();

            openShortcutHelpDialog();
            expect(document.activeElement).toBe(document.querySelector('.cst-shortcut-help__close'));

            closeShortcutHelpDialog();
            expect(document.activeElement).toBe(trigger);
        });

        it('is a no-op when the overlay is already open', () => {
            openShortcutHelpDialog();
            openShortcutHelpDialog();

            expect(document.querySelectorAll('.cst-shortcut-help')).toHaveLength(1);
        });

        it('closes on Escape', () => {
            openShortcutHelpDialog();

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(overlay()).toBeNull();
        });

        it('closes on the close button', () => {
            openShortcutHelpDialog();

            fireEvent.click(document.querySelector('.cst-shortcut-help__close') as HTMLElement);

            expect(overlay()).toBeNull();
        });

        it('closes on a backdrop click but not on a click inside the panel', () => {
            openShortcutHelpDialog();

            fireEvent.click(document.querySelector('.cst-shortcut-help__panel') as HTMLElement);
            expect(overlay()).not.toBeNull();

            fireEvent.click(overlay() as HTMLElement);
            expect(overlay()).toBeNull();
        });

        it('pulls focus back when Tab would leave the overlay', () => {
            const outsideButton = document.createElement('button');
            document.body.appendChild(outsideButton);
            openShortcutHelpDialog();
            const closeButton = document.querySelector('.cst-shortcut-help__close') as HTMLElement;

            // Focus sitting on the page behind the overlay (however it got there)
            // must not be able to walk further into it.
            outsideButton.focus();
            const backwardTab = new KeyboardEvent('keydown', {
                key: 'Tab',
                shiftKey: true,
                cancelable: true,
                bubbles: true
            });
            document.dispatchEvent(backwardTab);
            expect(backwardTab.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(closeButton);

            // Forward from the last focusable wraps to the first — the overlay
            // currently has one, so the assertion that proves the trap ran is
            // that the browser's own Tab handling was cancelled.
            const forwardTab = new KeyboardEvent('keydown', {
                key: 'Tab',
                cancelable: true,
                bubbles: true
            });
            document.dispatchEvent(forwardTab);
            expect(forwardTab.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(closeButton);
        });

        it('swallows page shortcuts while it is open', () => {
            // Stand-in for the page's own document-level shortcuts (ToolSearch's
            // `/` and Cmd/Ctrl+K, shortcut-utils' Cmd/Ctrl+Enter): they must not
            // fire behind the modal.
            const pageShortcut = jest.fn();
            document.addEventListener('keydown', pageShortcut);

            openShortcutHelpDialog();
            fireEvent.keyDown(document, { key: '/' });
            fireEvent.keyDown(document, { key: 'k', metaKey: true });
            fireEvent.keyDown(document, { key: 'Enter', metaKey: true });
            expect(pageShortcut).not.toHaveBeenCalled();

            closeShortcutHelpDialog();
            fireEvent.keyDown(document, { key: '/' });
            expect(pageShortcut).toHaveBeenCalledTimes(1);

            document.removeEventListener('keydown', pageShortcut);
        });

        it('never cancels the default action of a swallowed key', () => {
            openShortcutHelpDialog();

            // Only propagation is stopped, so the browser still does its own
            // work — activating the focused close button with Enter/Space,
            // typing, browser shortcuts.
            const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
            (document.querySelector('.cst-shortcut-help__close') as HTMLElement).dispatchEvent(event);

            expect(event.defaultPrevented).toBe(false);
            expect(overlay()).not.toBeNull();
        });

        it('leaves other keys alone', () => {
            openShortcutHelpDialog();

            fireEvent.keyDown(document, { key: 'a' });

            expect(overlay()).not.toBeNull();
        });
    });

    describe('closeShortcutHelpDialog', () => {
        it('is a no-op when nothing is open', () => {
            expect(() => closeShortcutHelpDialog()).not.toThrow();
        });

        it('stops handling Escape once closed', () => {
            openShortcutHelpDialog();
            closeShortcutHelpDialog();

            const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
            document.dispatchEvent(escapeEvent);

            expect(escapeEvent.defaultPrevented).toBe(false);
        });
    });
});
