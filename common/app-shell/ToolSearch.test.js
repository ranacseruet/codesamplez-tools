import { render } from 'preact';
import { fireEvent } from '@testing-library/dom';
import { ToolSearch, mountToolSearch } from './ToolSearch';
import { TOOL_CATALOG_ENTRIES, TOOL_CATALOG_GROUPS } from './toolCatalog';

const GRID_MARKUP = `
    <div id="tools">
        <section class="tool-group" data-tool-group="code-formatters">
            <article class="tool-card" data-tool-id="json-formatter-tool"></article>
            <article class="tool-card" data-tool-id="js-minifier-tool"></article>
        </section>
        <section class="tool-group" data-tool-group="text-analysis">
            <article class="tool-card" data-tool-id="diff-checker-tool"></article>
            <article class="tool-card" data-tool-id="text-analyzer-tool"></article>
        </section>
    </div>
`;

function createRoot(withGrid = true) {
    const root = document.createElement('div');
    root.id = 'tool-search-root';
    root.className = 'tool-search';
    document.body.appendChild(root);
    if (withGrid) {
        const grid = document.createElement('div');
        grid.innerHTML = GRID_MARKUP;
        document.body.appendChild(grid);
    }
    return root;
}

function visibleCardIds() {
    return [...document.querySelectorAll('.tool-card:not(.tool-card--hidden)')].map((card) => card.dataset.toolId);
}

function hiddenGroupIds() {
    return [...document.querySelectorAll('.tool-group--hidden')].map((group) => group.dataset.toolGroup);
}

// Preact flushes state-driven re-renders on a microtask — await this after
// firing events before asserting on the DOM.
function flush() {
    return Promise.resolve();
}

describe('ToolSearch', () => {
    let mountedRoots;

    beforeEach(() => {
        document.body.innerHTML = '';
        mountedRoots = [];
    });

    afterEach(() => {
        mountedRoots.forEach((root) => render(null, root));
        document.body.innerHTML = '';
    });

    function renderSearch(root) {
        mountedRoots.push(root);
        render(<ToolSearch />, root);
        return root;
    }

    it('renders the search input and one chip per catalog group plus All', () => {
        const root = renderSearch(createRoot());

        expect(root.querySelector('.tool-search__input')).not.toBeNull();
        const chips = root.querySelectorAll('.tool-search__chip');
        expect(chips).toHaveLength(TOOL_CATALOG_GROUPS.length + 1);
        expect(chips[0].textContent).toBe('All tools');
        expect(root.querySelector('.tool-search__palette')).toBeNull();
    });

    it('filters the palette and the grid as the query changes', async () => {
        const root = renderSearch(createRoot());
        const input = root.querySelector('.tool-search__input');

        input.focus();
        fireEvent.input(input, { target: { value: 'diff' } });
        await flush();

        const itemTitles = [...root.querySelectorAll('.tool-search__item-title')].map((node) => node.textContent);
        // Title hit ranks first; "diff" also substring-matches Data Format
        // Converter ("different") and the Text group label ("Diff Tools").
        expect(itemTitles).toEqual(['Diff Checker', 'Data Format Converter', 'Text Analyzer']);
        expect(visibleCardIds()).toEqual(['diff-checker-tool', 'text-analyzer-tool']);
        expect(hiddenGroupIds()).toEqual(['code-formatters']);
        expect(root.querySelector('.tool-search__count')?.textContent).toContain('3 of 10');
    });

    it('matches across descriptions and supports multi-token queries', async () => {
        const root = renderSearch(createRoot());
        const input = root.querySelector('.tool-search__input');

        input.focus();
        fireEvent.input(input, { target: { value: 'minify css' } });
        await flush();

        const itemTitles = [...root.querySelectorAll('.tool-search__item-title')].map((node) => node.textContent);
        expect(itemTitles).toEqual(['CSS Minifier']);
    });

    it('filters by category chip and toggles back off', async () => {
        const root = renderSearch(createRoot());
        const chip = [...root.querySelectorAll('.tool-search__chip')]
            .find((node) => node.getAttribute('href') === '#group-text-analysis');

        fireEvent.click(chip);
        await flush();

        expect(chip.getAttribute('aria-pressed')).toBe('true');
        const expectedIds = TOOL_CATALOG_ENTRIES.filter((entry) => entry.catalogGroupId === 'text-analysis')
            .map((entry) => entry.id);
        expect(visibleCardIds()).toEqual(expectedIds);
        expect(hiddenGroupIds()).toEqual(['code-formatters']);

        fireEvent.click(chip);
        await flush();

        expect(chip.getAttribute('aria-pressed')).toBe('false');
        expect(visibleCardIds()).toHaveLength(4);
        expect(hiddenGroupIds()).toEqual([]);
    });

    it('shows an empty state when nothing matches', async () => {
        const root = renderSearch(createRoot());
        const input = root.querySelector('.tool-search__input');

        input.focus();
        fireEvent.input(input, { target: { value: 'zzzz nothing' } });
        await flush();

        expect(root.querySelector('.tool-search__empty')?.textContent).toContain('No tools match');
        expect(visibleCardIds()).toEqual([]);
        expect(hiddenGroupIds()).toEqual(['code-formatters', 'text-analysis']);
    });

    it('focuses the search on / and on Ctrl+K', async () => {
        const root = renderSearch(createRoot());
        const input = root.querySelector('.tool-search__input');

        fireEvent.keyDown(document.body, { key: '/' });
        await flush();
        expect(document.activeElement).toBe(input);

        input.blur();
        fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
        await flush();
        expect(document.activeElement).toBe(input);
        expect(root.querySelector('.tool-search__palette')).not.toBeNull();
    });

    it('does not hijack / typed inside editable fields', () => {
        const root = renderSearch(createRoot());
        const otherInput = document.createElement('input');
        document.body.appendChild(otherInput);

        fireEvent.keyDown(otherInput, { key: '/' });
        expect(document.activeElement).not.toBe(root.querySelector('.tool-search__input'));
    });

    it('navigates the palette with arrows and activates the option on Enter', async () => {
        const root = renderSearch(createRoot());
        const input = root.querySelector('.tool-search__input');

        input.focus();
        fireEvent.input(input, { target: { value: 'json' } });
        await flush();

        const firstItem = root.querySelector('.tool-search__item');
        expect(firstItem.className).toContain('tool-search__item--active');

        // Enter "clicks" the active anchor — capture it at the document level.
        const clicks = [];
        document.addEventListener('click', (event) => {
            clicks.push(event.target.closest('a')?.getAttribute('href'));
            event.preventDefault();
        }, { once: true });

        fireEvent.keyDown(input, { key: 'Enter' });
        expect(clicks).toHaveLength(1);
        expect(clicks[0]).toContain('/json-formatter/');
    });

    it('moves the active option with arrow keys and tracks hover', async () => {
        const root = renderSearch(createRoot());
        const input = root.querySelector('.tool-search__input');

        input.focus();
        await flush();

        fireEvent.keyDown(input, { key: 'ArrowDown' });
        await flush();
        let items = root.querySelectorAll('.tool-search__item');
        expect(items[0].className).not.toContain('--active');
        expect(items[1].className).toContain('--active');

        fireEvent.keyDown(input, { key: 'ArrowUp' });
        await flush();
        items = root.querySelectorAll('.tool-search__item');
        expect(items[0].className).toContain('--active');

        fireEvent.mouseEnter(items[3]);
        await flush();
        expect(root.querySelectorAll('.tool-search__item')[3].className).toContain('--active');
    });

    it('clears the query with Escape when the palette is already closed', async () => {
        const root = renderSearch(createRoot());
        const input = root.querySelector('.tool-search__input');

        input.focus();
        fireEvent.input(input, { target: { value: 'json' } });
        await flush();
        fireEvent.keyDown(input, { key: 'Escape' });
        await flush();
        expect(root.querySelector('.tool-search__palette')).toBeNull();

        fireEvent.keyDown(input, { key: 'Escape' });
        await flush();
        expect(input.value).toBe('');
    });

    it('toggles the category with Space on a chip', async () => {
        const root = renderSearch(createRoot());
        const chip = [...root.querySelectorAll('.tool-search__chip')]
            .find((node) => node.getAttribute('href') === '#group-code-formatters');

        fireEvent.keyDown(chip, { key: ' ' });
        await flush();

        expect(chip.getAttribute('aria-pressed')).toBe('true');
        expect(visibleCardIds()).toEqual(['json-formatter-tool', 'js-minifier-tool']);
    });

    it('still fires the / shortcut when the event target is the document itself', async () => {
        const root = renderSearch(createRoot());

        fireEvent.keyDown(document, { key: '/' });
        await flush();

        expect(document.activeElement).toBe(root.querySelector('.tool-search__input'));
    });

    it('closes the palette on Escape and on outside click', async () => {
        const root = renderSearch(createRoot());
        const input = root.querySelector('.tool-search__input');

        input.focus();
        await flush();
        expect(root.querySelector('.tool-search__palette')).not.toBeNull();

        fireEvent.keyDown(input, { key: 'Escape' });
        await flush();
        expect(root.querySelector('.tool-search__palette')).toBeNull();

        // Blur first — re-focusing an already-focused input fires no event.
        input.blur();
        input.focus();
        await flush();
        expect(root.querySelector('.tool-search__palette')).not.toBeNull();
        fireEvent.click(document.body);
        await flush();
        expect(root.querySelector('.tool-search__palette')).toBeNull();
    });

    it('mountToolSearch mounts into the root and no-ops when absent', () => {
        expect(() => mountToolSearch('missing-root')).not.toThrow();

        const root = createRoot(false);
        mountedRoots.push(root);
        mountToolSearch();
        expect(root.querySelector('.tool-search__input')).not.toBeNull();
    });
});
