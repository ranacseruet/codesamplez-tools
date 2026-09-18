import { waitFor } from '@testing-library/dom';
import { SITE_BASE_URL } from '../siteBaseUrl';
import { mountToolShell } from './mountToolShell';
import { closeShortcutHelpDialog } from '../shortcut-help';
import { readRecentToolVisits, recordToolVisit } from '../recent-tools';

describe('mountToolShell', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.body.className = '';
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
        expect(document.querySelector('#app-shell-header .cst-shell__brand')?.getAttribute('href')).toBe(SITE_BASE_URL);
        expect(document.querySelector('#app-shell-footer .cst-shell__footer-brand-link')?.getAttribute('href')).toBe(SITE_BASE_URL);
        expect(document.querySelector('#app-shell-header .cst-shell__tool-menu-trigger')?.textContent).toContain('Browse Tools');
    });

    it('mounts the share rail on standalone tool pages using the live location', () => {
        document.body.className = 'standalone-app';
        document.body.innerHTML = `
            <div id="app-shell-header"></div>
            <div id="app-shell-share"></div>
            <div id="app-shell-footer"></div>
        `;

        mountToolShell({
            title: 'Diff Checker',
            description: 'Compare text',
            homeHref: '/'
        });

        const shareNav = document.querySelector('#app-shell-share nav.cst-share');
        expect(shareNav).not.toBeNull();
        const canonicalUrl = `${window.location.origin}${window.location.pathname}`;
        const xLink = document.querySelector('#app-shell-share a.cst-share__btn[aria-label="Share on X"]');
        expect(xLink?.getAttribute('href')).toContain(encodeURIComponent(canonicalUrl));
        expect(document.querySelector('#app-shell-share button.cst-share__btn--copy')).not.toBeNull();
    });

    it('strips query/hash payloads from the shared url to avoid leaking user data', () => {
        window.history.pushState({}, '', '/base64-converter/?data=secret-payload#data=more-secret');
        document.body.className = 'standalone-app';
        document.body.innerHTML = `
            <div id="app-shell-header"></div>
            <div id="app-shell-share"></div>
            <div id="app-shell-footer"></div>
        `;

        mountToolShell({
            title: 'Base64 Converter',
            description: 'Encode and decode Base64',
            homeHref: '/'
        });

        const links = Array.from(document.querySelectorAll('#app-shell-share a.cst-share__btn'));
        expect(links.length).toBeGreaterThan(0);
        links.forEach((link) => {
            expect(link.getAttribute('href')).not.toContain('secret');
            expect(link.getAttribute('href')).toContain(encodeURIComponent('/base64-converter/'));
        });

        window.history.pushState({}, '', '/');
    });

    it('does not mount the share rail on the non-standalone tools index', () => {
        document.body.innerHTML = `
            <div id="app-shell-header"></div>
            <div id="app-shell-share"></div>
            <div id="app-shell-footer"></div>
        `;

        mountToolShell({
            title: 'Online Developer Tools',
            description: 'Tools index',
            homeHref: '/'
        });

        expect(document.querySelector('#app-shell-share nav.cst-share')).toBeNull();
    });

    it('renders a tool breadcrumb on standalone tool pages', () => {
        document.body.className = 'standalone-app';
        document.body.innerHTML = `
            <div id="app-shell-header"></div>
            <div id="app-shell-footer"></div>
        `;

        mountToolShell({
            title: 'Data Format Converter',
            description: 'Convert JSON, XML, YAML, and Properties formats',
            homeHref: '/'
        });

        const breadcrumb = document.querySelector('#app-shell-header nav.cst-shell__breadcrumb');
        expect(breadcrumb).not.toBeNull();
        expect(breadcrumb?.querySelector('a.cst-shell__breadcrumb-link')?.getAttribute('href')).toBe(SITE_BASE_URL);
        expect(breadcrumb?.querySelector('.cst-shell__breadcrumb-current')?.textContent).toBe('Data Format Converter');
    });

    it('does not render a breadcrumb on the non-standalone tools index', () => {
        document.body.innerHTML = `
            <div id="app-shell-header"></div>
            <div id="app-shell-footer"></div>
        `;

        mountToolShell({
            title: 'Online Developer Tools',
            description: 'Tools index',
            homeHref: '/'
        });

        expect(document.querySelector('#app-shell-header nav.cst-shell__breadcrumb')).toBeNull();
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
        expect(document.querySelector('#custom-footer .cst-shell__footer-brand-link')?.getAttribute('href')).toBe('/custom');
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
        // Dark is the product default when no stored/document theme exists.
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(document.documentElement.getAttribute('data-cst-theme')).toBe('dark');
        expect(themeToggle.textContent).toContain('Light mode');

        themeToggle.click();

        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        expect(document.documentElement.getAttribute('data-cst-theme')).toBe('light');
        expect(window.localStorage.getItem('cst-standalone-theme-mode')).toBe('light');
        expect(document.querySelector('#app-shell-header .cst-shell__theme-toggle')?.textContent).toContain('Dark mode');
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

        // Dark is the product default, so the toggle offers the switch to light.
        expect(document.querySelector('#app-shell-header .cst-shell__theme-toggle')?.textContent).toContain('Light mode');

        document.documentElement.setAttribute('data-theme', 'light');
        await Promise.resolve();

        expect(document.documentElement.getAttribute('data-cst-theme')).toBe('light');
        expect(document.querySelector('#app-shell-header .cst-shell__theme-toggle')?.textContent).toContain('Dark mode');

        document.documentElement.setAttribute('data-theme', 'dark');
        await Promise.resolve();

        expect(document.documentElement.getAttribute('data-cst-theme')).toBe('dark');
        expect(document.querySelector('#app-shell-header .cst-shell__theme-toggle')?.textContent).toContain('Light mode');
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
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(document.documentElement.getAttribute('data-cst-theme')).toBe('dark');
    });
    describe('recently used tools', () => {
        const originalPath = window.location.pathname;

        afterEach(() => {
            window.history.replaceState({}, '', originalPath);
        });

        it('records a visit on a tool page, resolving the id from the catalog', () => {
            window.history.replaceState({}, '', '/json-formatter/');
            document.body.className = 'standalone-app';
            document.body.innerHTML = '<div id="app-shell-header"></div>';

            mountToolShell({ title: 'JSON Formatter', homeHref: '/' });

            expect(readRecentToolVisits().map((visit) => visit.id)).toEqual(['json-formatter-tool']);
        });

        it('re-records the visit when the tool page is restored from the bfcache', () => {
            window.history.replaceState({}, '', '/json-formatter/');
            document.body.className = 'standalone-app';
            document.body.innerHTML = '<div id="app-shell-header"></div>';

            mountToolShell({ title: 'JSON Formatter', homeHref: '/' });
            const [firstVisit] = readRecentToolVisits();

            // A tool visited in between; coming Back restores this document
            // without re-running the mount, so recency would otherwise be stale.
            recordToolVisit('diff-checker-tool', Date.now() + 1000);
            window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

            const visits = readRecentToolVisits();
            expect(visits[0].id).toBe('json-formatter-tool');
            expect(visits[0].at).toBeGreaterThanOrEqual(firstVisit.at);
        });

        it('ignores a pageshow that is not a bfcache restore', () => {
            window.history.replaceState({}, '', '/json-formatter/');
            document.body.className = 'standalone-app';
            document.body.innerHTML = '<div id="app-shell-header"></div>';

            mountToolShell({ title: 'JSON Formatter', homeHref: '/' });
            recordToolVisit('diff-checker-tool', Date.now() + 1000);
            window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));

            expect(readRecentToolVisits()[0].id).toBe('diff-checker-tool');
        });

        it('releases the previous pageshow listener when the shell remounts', () => {
            window.history.replaceState({}, '', '/json-formatter/');
            document.body.className = 'standalone-app';
            document.body.innerHTML = '<div id="app-shell-header"></div>';

            // Warm-up mount so the spies below see one remount in isolation,
            // whatever earlier tests left registered.
            mountToolShell({ title: 'JSON Formatter', homeHref: '/' });
            const addSpy = jest.spyOn(window, 'addEventListener');
            const removeSpy = jest.spyOn(window, 'removeEventListener');

            mountToolShell({ title: 'JSON Formatter', homeHref: '/' });

            const added = addSpy.mock.calls.filter(([type]) => type === 'pageshow').length;
            const removed = removeSpy.mock.calls.filter(([type]) => type === 'pageshow').length;
            expect([added, removed]).toEqual([1, 1]);

            addSpy.mockRestore();
            removeSpy.mockRestore();
        });

        it('does not record a visit for the tools index', () => {
            window.history.replaceState({}, '', '/');
            document.body.className = 'landing-page';
            document.body.innerHTML = '<div id="app-shell-header"></div>';

            mountToolShell({ homeHref: '/', showThemeToggle: true });

            expect(readRecentToolVisits()).toEqual([]);
        });

        it('does not record a visit for a path outside the catalog', () => {
            window.history.replaceState({}, '', '/not-a-tool/');
            document.body.className = 'standalone-app';
            document.body.innerHTML = '<div id="app-shell-header"></div>';

            mountToolShell({ title: 'Missing', homeHref: '/' });

            expect(readRecentToolVisits()).toEqual([]);
        });
    });

    describe('shortcut help', () => {
        afterEach(() => {
            closeShortcutHelpDialog();
        });

        it('opens the overlay from the shell header button', async () => {
            document.body.innerHTML = '<div id="app-shell-header"></div>';

            mountToolShell({ title: 'Diff Checker', homeHref: '/' });

            const helpButton = document.querySelector('#app-shell-header .cst-shell__shortcut-help-button');
            expect(helpButton?.getAttribute('aria-label')).toBe('Keyboard shortcuts');

            helpButton.click();

            // The overlay is a lazy chunk — poll for it rather than assuming how
            // many turns the import takes.
            await waitFor(() => {
                expect(document.querySelector('.cst-shortcut-help [role="dialog"]')).not.toBeNull();
            });
        });

        it('opens the overlay on "?"', async () => {
            document.body.innerHTML = '<div id="app-shell-header"></div>';

            mountToolShell({ title: 'Diff Checker', homeHref: '/' });
            document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));

            await waitFor(() => {
                expect(document.querySelector('.cst-shortcut-help')).not.toBeNull();
            });
        });

        it('leaves only one "?" listener behind when the shell remounts', async () => {
            document.body.innerHTML = '<div id="app-shell-header"></div>';
            const addSpy = jest.spyOn(document, 'addEventListener');
            const removeSpy = jest.spyOn(document, 'removeEventListener');

            mountToolShell({ title: 'Diff Checker', homeHref: '/' });
            mountToolShell({ title: 'Diff Checker', homeHref: '/' });

            const added = addSpy.mock.calls.filter(([type]) => type === 'keydown').length;
            const removed = removeSpy.mock.calls.filter(([type]) => type === 'keydown').length;
            expect(added - removed).toBe(1);

            addSpy.mockRestore();
            removeSpy.mockRestore();
        });
    });
});
