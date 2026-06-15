import { mountToolShell } from './common/app-shell/mountToolShell';

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // The index renders only the app bar (no page-header band): its hero inside
        // `.main-container` is the page H1, so title/description are omitted here to
        // avoid duplicating them directly above the hero.
        mountToolShell({
            homeHref: '/',
            showThemeToggle: true
        });
    });
}
