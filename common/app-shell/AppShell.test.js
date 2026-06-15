import { render } from 'preact';
import { ToolShellFooter, ToolShellHeader, createToolBreadcrumbItems } from './AppShell';
import { SITE_BASE_URL, buildSiteHref } from '../siteBaseUrl';

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
        expect(dataFormatConverterLink?.getAttribute('href')).toBe(buildSiteHref('/data-format-converter/'));
    });

    it('defaults the header home link to the shared site base URL', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        render(
            <ToolShellHeader
                title="Data Format Converter"
            />,
            root
        );

        const homeLink = root.querySelector('a.cst-shell__brand');
        expect(homeLink).not.toBeNull();
        expect(homeLink?.getAttribute('href')).toBe(SITE_BASE_URL);
    });

    it('renders a breadcrumb trail when breadcrumb items are provided', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        render(
            <ToolShellHeader
                title="Data Format Converter"
                homeHref="/"
                breadcrumbItems={createToolBreadcrumbItems('Data Format Converter', SITE_BASE_URL)}
            />,
            root
        );

        const breadcrumb = root.querySelector('nav.cst-shell__breadcrumb');
        expect(breadcrumb).not.toBeNull();
        expect(breadcrumb.getAttribute('aria-label')).toBe('Breadcrumb');

        const homeLink = breadcrumb.querySelector('a.cst-shell__breadcrumb-link');
        expect(homeLink).not.toBeNull();
        expect(homeLink.textContent).toBe('Home');
        expect(homeLink.getAttribute('href')).toBe(SITE_BASE_URL);

        const current = breadcrumb.querySelector('.cst-shell__breadcrumb-current');
        expect(current).not.toBeNull();
        expect(current.textContent).toBe('Data Format Converter');
        expect(current.getAttribute('aria-current')).toBe('page');
    });

    it('omits the breadcrumb when no breadcrumb items are provided', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        render(<ToolShellHeader title="Data Format Converter" />, root);

        expect(root.querySelector('nav.cst-shell__breadcrumb')).toBeNull();
    });

    it('omits the page-header band entirely when there is no title, description, or breadcrumb', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        // The tools index mounts the shell with no title/description, so only the
        // app bar should render — no page-header band, no h1.
        render(<ToolShellHeader />, root);

        expect(root.querySelector('.cst-appbar')).not.toBeNull();
        expect(root.querySelector('a.cst-shell__brand')).not.toBeNull();
        expect(root.querySelector('.cst-page-header')).toBeNull();
        expect(root.querySelector('h1')).toBeNull();
        expect(root.querySelector('.cst-shell__title-wrap')).toBeNull();
    });

    it('renders the page-header description without an h1 when only a description is provided', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        render(<ToolShellHeader description="Standalone description" />, root);

        expect(root.querySelector('.cst-page-header')).not.toBeNull();
        expect(root.querySelector('.cst-shell__title-wrap')).not.toBeNull();
        expect(root.querySelector('h1')).toBeNull();
        expect(root.textContent).toContain('Standalone description');
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

    it('renders the light-mode affordance (sun icon) when the current theme is dark', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        render(
            <ToolShellHeader
                title="Data Format Converter"
                showThemeToggle={true}
                themeMode="dark"
            />,
            root
        );

        const themeToggle = root.querySelector('.cst-shell__theme-toggle');
        expect(themeToggle).not.toBeNull();
        expect(themeToggle.textContent).toContain('Light mode');
        expect(themeToggle.getAttribute('aria-pressed')).toBe('true');
    });

    it('renders footer accessibility and navigation link', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        render(<ToolShellFooter />, root);

        const footer = root.querySelector('footer.cst-shell__footer');
        expect(footer).not.toBeNull();
        const footerLinks = root.querySelectorAll('a.cst-shell__footer-link');
        expect(footerLinks).toHaveLength(2);
        const [allToolsLink, mainSiteLink] = footerLinks;
        expect(allToolsLink.textContent).toBe('All Tools');
        expect(allToolsLink.getAttribute('href')).toBe(SITE_BASE_URL);
        expect(mainSiteLink.textContent).toBe('CodeSamplez.com');
        expect(mainSiteLink.getAttribute('href')).toBe('https://codesamplez.com');
    });
});
