import { mountToolShell } from './common/app-shell/mountToolShell';
import { ROOT_PAGE_METADATA } from './common/app-shell/toolCatalog';

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        mountToolShell({
            title: ROOT_PAGE_METADATA.title,
            description: ROOT_PAGE_METADATA.description,
            homeHref: '/',
            showThemeToggle: true
        });
    });
}
