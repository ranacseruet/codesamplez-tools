import { render } from 'preact';
import { ToolShellFooter, ToolShellHeader } from './AppShell.jsx';

describe('AppShell components', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('renders header title, description, and home link', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        render(
            <ToolShellHeader
                title="Data Format Converter"
                description="Convert JSON, XML, YAML, and Properties formats"
                homeHref="/"
            />,
            root
        );

        const heading = root.querySelector('h1');
        expect(heading).not.toBeNull();
        expect(heading.textContent).toBe('Data Format Converter');
        expect(root.textContent).toContain('Convert JSON, XML, YAML, and Properties formats');

        const homeLink = root.querySelector('a.cst-shell__brand');
        expect(homeLink).not.toBeNull();
        expect(homeLink.getAttribute('href')).toBe('/');
        expect(homeLink.getAttribute('aria-label')).toBe('Back to all tools');
    });

    it('renders footer accessibility and navigation link', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        render(<ToolShellFooter />, root);

        const footer = root.querySelector('footer.cst-shell__footer');
        expect(footer).not.toBeNull();
        const allToolsLink = root.querySelector('a.cst-shell__footer-link');
        expect(allToolsLink).not.toBeNull();
        expect(allToolsLink.textContent).toBe('All Tools');
        expect(allToolsLink.getAttribute('href')).toBe('/');
    });
});

