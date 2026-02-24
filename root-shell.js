import { mountToolShell } from './common/app-shell/mountToolShell.js';

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        mountToolShell({
            title: 'Developer Utilities',
            description: 'Client-side formatters, converters, token tools, and text utilities with a consistent privacy-preserving workflow.',
            homeHref: '/',
            showThemeToggle: true
        });
    });
}
