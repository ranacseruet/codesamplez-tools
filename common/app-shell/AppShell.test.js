import { render } from 'preact';
import { ToolShellFooter, ToolShellHeader } from './AppShell';

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

        const menuTrigger = root.querySelector('summary.cst-shell__tool-menu-trigger');
        expect(menuTrigger).not.toBeNull();
        expect(menuTrigger.textContent).toContain('Browse Tools');

        const groupHeadings = Array.from(root.querySelectorAll('.cst-shell__tool-menu-heading')).map((node) => node.textContent);
        expect(groupHeadings).toEqual([
            'Code Formatters & Validators',
            'Encoders & Decoders',
            'Text Analysis & Diff Tools'
        ]);

        const dataFormatConverterLink = Array.from(root.querySelectorAll('.cst-shell__tool-menu-link'))
            .find((link) => link.textContent === 'Data Format Converter');
        expect(dataFormatConverterLink).not.toBeNull();
        expect(dataFormatConverterLink?.getAttribute('href')).toBe('/data-format-converter/');
    });

    it('renders a theme toggle when enabled', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        const onToggleTheme = jest.fn();

        render(
            <ToolShellHeader
                title="Data Format Converter"
                description="Convert JSON, XML, YAML, and Properties formats"
                homeHref="/"
                showThemeToggle={true}
                themeMode="light"
                onToggleTheme={onToggleTheme}
            />,
            root
        );

        const themeToggle = root.querySelector('.cst-shell__theme-toggle');
        expect(themeToggle).not.toBeNull();
        expect(themeToggle.textContent).toContain('Dark mode');

        themeToggle.click();
        expect(onToggleTheme).toHaveBeenCalledTimes(1);
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
