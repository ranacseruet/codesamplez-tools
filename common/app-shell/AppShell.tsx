import type { JSX } from 'preact';
import { TOOL_NAVIGATION_GROUPS } from './toolNavigation';
import { TOOL_CATALOG_ROOT_PATH } from './toolCatalog';

type ThemeMode = 'light' | 'dark';

interface ToolShellHeaderProps {
    title?: string;
    description?: string;
    homeHref?: string;
    showThemeToggle?: boolean;
    themeMode?: ThemeMode;
    onToggleTheme?: () => void;
}

export function ToolShellHeader({
    title,
    description,
    homeHref = TOOL_CATALOG_ROOT_PATH,
    showThemeToggle = false,
    themeMode = 'light',
    onToggleTheme
}: ToolShellHeaderProps): JSX.Element {
    const isDarkMode = themeMode === 'dark';
    const themeToggleLabel = isDarkMode ? 'Light mode' : 'Dark mode';
    const themeToggleAriaLabel = isDarkMode ? 'Switch to light mode' : 'Switch to dark mode';

    return (
        <header className="cst-shell__header">
            <div className="cst-shell__header-inner">
                <div className="cst-shell__header-top">
                    <a className="cst-shell__brand" href={homeHref} aria-label="Back to all tools">
                        CodeSamplez Tools
                    </a>
                    <div className="cst-shell__header-actions">
                        <details className="cst-shell__tool-menu">
                            <summary className="cst-shell__tool-menu-trigger">Browse Tools</summary>
                            <nav className="cst-shell__tool-menu-panel" aria-label="Tool directory">
                                {TOOL_NAVIGATION_GROUPS.map((group) => (
                                    <section className="cst-shell__tool-menu-group" key={group.label}>
                                        <h2 className="cst-shell__tool-menu-heading">{group.label}</h2>
                                        <ul className="cst-shell__tool-menu-list">
                                            {group.tools.map((tool) => (
                                                <li className="cst-shell__tool-menu-item" key={tool.href}>
                                                    <a className="cst-shell__tool-menu-link" href={tool.href}>
                                                        {tool.label}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                ))}
                            </nav>
                        </details>
                        {showThemeToggle ? (
                            <button
                                type="button"
                                className="cst-shell__theme-toggle"
                                aria-pressed={isDarkMode ? 'true' : 'false'}
                                aria-label={themeToggleAriaLabel}
                                title={themeToggleAriaLabel}
                                onClick={onToggleTheme}
                            >
                                <span className="cst-shell__theme-toggle-icon" aria-hidden="true">
                                    {isDarkMode ? '☀' : '☾'}
                                </span>
                                <span className="cst-shell__theme-toggle-text">{themeToggleLabel}</span>
                            </button>
                        ) : null}
                    </div>
                </div>
                <div className="cst-shell__title-wrap">
                    <h1 className="cst-shell__title">{title}</h1>
                    {description ? <p className="cst-shell__description">{description}</p> : null}
                </div>
            </div>
        </header>
    );
}

interface ToolShellFooterProps {
    homeHref?: string;
}

export function ToolShellFooter({ homeHref = TOOL_CATALOG_ROOT_PATH }: ToolShellFooterProps): JSX.Element {
    return (
        <footer className="cst-shell__footer">
            <div className="cst-shell__footer-inner">
                <span>Client-side by design</span>
                <span aria-hidden="true">|</span>
                <a href={homeHref} className="cst-shell__footer-link">All Tools</a>
            </div>
        </footer>
    );
}
