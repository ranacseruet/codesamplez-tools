import { render } from 'preact';
import { fireEvent, waitFor } from '@testing-library/dom';
import { RecentTools, mountRecentTools, resolveRecentToolLinks } from './RecentTools';
import { TOOL_CATALOG_ENTRIES } from './toolCatalog';
import { RECENT_TOOLS_STORAGE_KEY, recordToolVisit } from '../recent-tools';

function createSlot() {
    const slot = document.createElement('div');
    slot.id = 'recent-tools-root';
    slot.className = 'recent-tools-slot';
    document.body.appendChild(slot);
    return slot;
}

function renderedTitles() {
    return [...document.querySelectorAll('.recent-tools__item')].map((item) => item.textContent);
}

describe('RecentTools', () => {
    let mountedRoots;

    beforeEach(() => {
        window.localStorage.clear();
        document.body.innerHTML = '';
        mountedRoots = [];
    });

    afterEach(() => {
        mountedRoots.forEach((root) => render(null, root));
        document.body.innerHTML = '';
        window.localStorage.clear();
    });

    function mountInto(slot) {
        mountedRoots.push(slot);
        render(<RecentTools />, slot);
    }

    describe('resolveRecentToolLinks', () => {
        it('resolves ids to catalog titles and hrefs, newest first', () => {
            recordToolVisit('json-formatter-tool', 1);
            recordToolVisit('diff-checker-tool', 2);

            const [first, second] = resolveRecentToolLinks();
            const diffChecker = TOOL_CATALOG_ENTRIES.find((entry) => entry.id === 'diff-checker-tool');

            expect(first.id).toBe('diff-checker-tool');
            expect(first.title).toBe(diffChecker.title);
            expect(first.href).toContain(diffChecker.publicPath);
            expect(second.id).toBe('json-formatter-tool');
        });

        it('drops ids the catalog no longer knows about', () => {
            recordToolVisit('retired-tool', 1);
            recordToolVisit('json-formatter-tool', 2);

            expect(resolveRecentToolLinks().map((link) => link.id)).toEqual(['json-formatter-tool']);
        });

        it('honours the display limit', () => {
            TOOL_CATALOG_ENTRIES.slice(0, 5).forEach((entry, index) => {
                recordToolVisit(entry.id, index);
            });

            expect(resolveRecentToolLinks(2)).toHaveLength(2);
        });

        it('carries the category accent slug of each tool', () => {
            const encoderEntry = TOOL_CATALOG_ENTRIES.find(
                (entry) => entry.catalogGroupId === 'encoders-decoders'
            );
            recordToolVisit(encoderEntry.id, 1);

            expect(resolveRecentToolLinks()[0].categorySlug).toBe('encoders');
        });
    });

    it('renders nothing when there is no history', () => {
        const slot = createSlot();
        mountInto(slot);

        expect(slot.innerHTML).toBe('');
    });

    it('renders a labelled row of recent tools', () => {
        recordToolVisit('json-formatter-tool', 1);
        recordToolVisit('diff-checker-tool', 2);
        mountInto(createSlot());

        const region = document.querySelector('.recent-tools');
        expect(region.getAttribute('aria-labelledby')).toBe('recent-tools-label');
        expect(document.getElementById('recent-tools-label').textContent).toBe('Recently used');
        expect(renderedTitles()).toHaveLength(2);
        expect(document.querySelector('.recent-tools__item').getAttribute('href')).toContain(
            '/diff-checker/'
        );
    });

    it('clears the row and the stored history on Clear', async () => {
        recordToolVisit('json-formatter-tool', 1);
        const slot = createSlot();
        mountInto(slot);

        fireEvent.click(document.querySelector('.recent-tools__clear'));

        // Preact re-renders on a microtask; poll rather than assume a turn count.
        await waitFor(() => {
            expect(slot.innerHTML).toBe('');
        });
        expect(window.localStorage.getItem(RECENT_TOOLS_STORAGE_KEY)).toBeNull();
    });

    it('refreshes the row when the page is restored from the back/forward cache', async () => {
        recordToolVisit('json-formatter-tool', 1);
        mountInto(createSlot());
        expect(renderedTitles()).toHaveLength(1);

        // The visit the user made on the tool page they just came Back from:
        // written to storage while this document sat in the bfcache.
        recordToolVisit('diff-checker-tool', 2);
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

        await waitFor(() => {
            expect(renderedTitles()).toEqual(['Diff Checker', 'JSON Formatter']);
        });
    });

    it('ignores a pageshow that is not a bfcache restore', async () => {
        recordToolVisit('json-formatter-tool', 1);
        mountInto(createSlot());

        recordToolVisit('diff-checker-tool', 2);
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
        // A normal load re-mounts the component anyway, so re-reading here would
        // be redundant work on the busiest page of the site.
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(renderedTitles()).toEqual(['JSON Formatter']);
    });

    it('stops listening for pageshow once unmounted', async () => {
        recordToolVisit('json-formatter-tool', 1);
        const slot = createSlot();
        mountInto(slot);
        render(null, slot);

        recordToolVisit('diff-checker-tool', 2);
        expect(() =>
            window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
        ).not.toThrow();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(document.querySelector('.recent-tools')).toBeNull();
    });

    describe('mountRecentTools', () => {
        it('fills the slot when one exists', () => {
            recordToolVisit('json-formatter-tool', 1);
            const slot = createSlot();
            mountedRoots.push(slot);

            mountRecentTools();

            expect(document.querySelectorAll('.recent-tools__item')).toHaveLength(1);
        });

        it('is a no-op without a slot (the 404 page shares this bundle)', () => {
            recordToolVisit('json-formatter-tool', 1);

            expect(() => mountRecentTools()).not.toThrow();
            expect(document.querySelector('.recent-tools')).toBeNull();
        });
    });
});
