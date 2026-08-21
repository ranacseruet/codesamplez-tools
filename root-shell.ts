import { mountToolShell } from './common/app-shell/mountToolShell';
import { mountRecentTools } from './common/app-shell/RecentTools';

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // The index renders only the app bar (no page-header band): its hero inside
        // `.main-container` is the page H1, so title/description are omitted here to
        // avoid duplicating them directly above the hero.
        mountToolShell({
            homeHref: '/',
            showThemeToggle: true
        });
        // v4 Phase D3: fills the hero's empty "Recently used" slot from this
        // browser's own visit history. Kept in the entry bundle (not code-split
        // like the search island) because it is tiny and a returning visitor
        // should see the row without waiting on a second request. No slot or no
        // history → renders nothing.
        mountRecentTools();
        // v4: the tool search island is code-split out of the entry bundle so
        // the landing's first-paint JS stays lean; the SSR'd box/chips are
        // already visible and the chunk arrives right after DOMContentLoaded.
        // No root element → no-op (e.g. the 404 page shares this bundle).
        if (document.getElementById('tool-search-root')) {
            import('./common/app-shell/ToolSearch')
                .then(({ mountToolSearch }) => mountToolSearch())
                .catch(() => {
                    // Chunk load failure leaves the SSR'd static search shell in
                    // place — the grid stays fully usable without enhancement.
                });
        }
    });
}
