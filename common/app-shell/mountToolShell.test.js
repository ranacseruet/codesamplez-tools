import { mountToolShell } from './mountToolShell.js';

describe('mountToolShell', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.removeAttribute('data-cst-theme');
        window.localStorage.clear();
    });

    it('mounts header and footer into default roots', () => {
        document.body.innerHTML = `
            <div id="app-shell-header"></div>
            <div id="app-shell-footer"></div>
        `;

        mountToolShell({
            title: 'Data Format Converter',
            description: 'Convert JSON, XML, YAML, and Properties formats',
            homeHref: '/'
        });

        expect(document.querySelector('#app-shell-header .cst-shell__title')?.textContent).toBe('Data Format Converter');
        expect(document.querySelector('#app-shell-header .cst-shell__description')?.textContent)
            .toContain('Convert JSON, XML, YAML, and Properties formats');
        expect(document.querySelector('#app-shell-footer .cst-shell__footer-link')?.getAttribute('href')).toBe('/');
    });

    it('supports custom mount root ids', () => {
        document.body.innerHTML = `
            <div id="custom-header"></div>
            <div id="custom-footer"></div>
        `;

        mountToolShell({
            title: 'Custom Tool',
            description: 'Custom description',
            homeHref: '/custom',
            headerRootId: 'custom-header',
            footerRootId: 'custom-footer'
        });

        expect(document.querySelector('#custom-header .cst-shell__title')?.textContent).toBe('Custom Tool');
        expect(document.querySelector('#custom-header .cst-shell__brand')?.getAttribute('href')).toBe('/custom');
        expect(document.querySelector('#custom-footer .cst-shell__footer-link')).not.toBeNull();
    });

    it('is a no-op when mount roots are missing', () => {
        expect(() => {
            mountToolShell({
                title: 'Data Format Converter',
                description: 'Convert JSON, XML, YAML, and Properties formats'
            });
        }).not.toThrow();
        expect(document.body.textContent).toBe('');
    });

    it('mounts a standalone theme toggle and persists manual mode changes', () => {
        document.body.className = 'standalone-app';
        document.body.innerHTML = `
            <div id="app-shell-header"></div>
            <div id="app-shell-footer"></div>
        `;

        mountToolShell({
            title: 'Theme Test Tool',
            description: 'Tool with standalone theme toggle',
            homeHref: '/'
        });

        const themeToggle = document.querySelector('#app-shell-header .cst-shell__theme-toggle');
        expect(themeToggle).not.toBeNull();
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        expect(document.documentElement.getAttribute('data-cst-theme')).toBe('light');
        expect(themeToggle.textContent).toContain('Dark mode');

        themeToggle.click();

        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(document.documentElement.getAttribute('data-cst-theme')).toBe('dark');
        expect(window.localStorage.getItem('cst-standalone-theme-mode')).toBe('dark');
        expect(document.querySelector('#app-shell-header .cst-shell__theme-toggle')?.textContent).toContain('Light mode');
    });

    it('prefers an existing data-theme attribute during initialization', () => {
        document.body.className = 'standalone-app';
        document.body.innerHTML = `
            <div id="app-shell-header"></div>
            <div id="app-shell-footer"></div>
        `;
        window.localStorage.setItem('cst-standalone-theme-mode', 'light');
        document.documentElement.setAttribute('data-theme', 'dark');

        mountToolShell({
            title: 'Theme Init Preference',
            description: 'Uses external theme if present',
            homeHref: '/'
        });

        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(document.documentElement.getAttribute('data-cst-theme')).toBe('dark');
        expect(document.querySelector('#app-shell-header .cst-shell__theme-toggle')?.textContent).toContain('Light mode');
    });

    it('syncs the toggle state when data-theme changes externally', async () => {
        document.body.className = 'standalone-app';
        document.body.innerHTML = `
            <div id="app-shell-header"></div>
            <div id="app-shell-footer"></div>
        `;

        mountToolShell({
            title: 'Theme Observer Test',
            description: 'Responds to external theme changes',
            homeHref: '/'
        });

        expect(document.querySelector('#app-shell-header .cst-shell__theme-toggle')?.textContent).toContain('Dark mode');

        document.documentElement.setAttribute('data-theme', 'dark');
        await Promise.resolve();

        expect(document.documentElement.getAttribute('data-cst-theme')).toBe('dark');
        expect(document.querySelector('#app-shell-header .cst-shell__theme-toggle')?.textContent).toContain('Light mode');

        document.documentElement.setAttribute('data-theme', 'light');
        await Promise.resolve();

        expect(document.documentElement.getAttribute('data-cst-theme')).toBe('light');
        expect(document.querySelector('#app-shell-header .cst-shell__theme-toggle')?.textContent).toContain('Dark mode');
    });

    it('supports forcing the shared theme toggle outside standalone tool pages', () => {
        document.body.className = 'landing-page';
        document.body.innerHTML = `
            <div id="app-shell-header"></div>
            <div id="app-shell-footer"></div>
        `;

        mountToolShell({
            title: 'Root Index',
            description: 'Landing page',
            homeHref: '/',
            showThemeToggle: true
        });

        expect(document.querySelector('#app-shell-header .cst-shell__theme-toggle')).not.toBeNull();
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        expect(document.documentElement.getAttribute('data-cst-theme')).toBe('light');
    });
});
