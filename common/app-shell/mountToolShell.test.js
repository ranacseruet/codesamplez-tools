import { mountToolShell } from './mountToolShell.js';

describe('mountToolShell', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
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
});
