import { render } from 'preact';
import { ToolShellFooter, ToolShellHeader } from './AppShell.jsx';

export function mountToolShell({
    title,
    description,
    homeHref = '/',
    headerRootId = 'app-shell-header',
    footerRootId = 'app-shell-footer'
} = {}) {
    const headerRoot = document.getElementById(headerRootId);
    const footerRoot = document.getElementById(footerRootId);

    if (headerRoot) {
        render(
            <ToolShellHeader title={title} description={description} homeHref={homeHref} />,
            headerRoot
        );
    }

    if (footerRoot) {
        render(<ToolShellFooter />, footerRoot);
    }
}

