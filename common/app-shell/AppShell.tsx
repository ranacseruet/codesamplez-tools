import type { JSX } from 'preact';
import { TOOL_NAVIGATION_GROUPS } from './toolNavigation';
import { MAIN_SITE_URL, SITE_BASE_URL } from '../siteBaseUrl';

type ThemeMode = 'light' | 'dark';

// Visible breadcrumb root label. Kept as a single source of truth so the tool
// page UI and the BreadcrumbList JSON-LD (scripts/structured-data.js) stay in
// sync — Google requires the structured-data names to match the on-page trail.
export const BREADCRUMB_HOME_LABEL = 'Home';

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

// Two-level trail shown on every tool page: Home → <tool>. The default homeHref
// mirrors the brand link so the breadcrumb root points at the tools index even
// when a caller omits it.
export function createToolBreadcrumbItems(toolTitle: string, homeHref: string = SITE_BASE_URL): BreadcrumbItem[] {
    return [
        { label: BREADCRUMB_HOME_LABEL, href: homeHref },
        { label: toolTitle }
    ];
}

// The shell header re-renders on theme toggle, so its icons are rendered as
// inline Lucide-geometry SVGs (Preact-owned) rather than `<i data-lucide>` nodes
// that the CDN script would swap out from under Preact. Static surfaces (e.g. the
// landing CTA) use real `<i data-lucide>` markup with lucide.createIcons().
function SunIcon(): JSX.Element {
    return (
        <svg
            className="cst-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
    );
}

function MoonIcon(): JSX.Element {
    return (
        <svg
            className="cst-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
    );
}

interface ToolShellHeaderProps {
    title?: string;
    description?: string;
    homeHref?: string;
    breadcrumbItems?: BreadcrumbItem[];
    showThemeToggle?: boolean;
    themeMode?: ThemeMode;
    onToggleTheme?: () => void;
}

export function ToolShellHeader({
    title,
    description,
    homeHref = SITE_BASE_URL,
    breadcrumbItems,
    showThemeToggle = false,
    themeMode = 'light',
    onToggleTheme
}: ToolShellHeaderProps): JSX.Element {
    const isDarkMode = themeMode === 'dark';
    const themeToggleLabel = isDarkMode ? 'Light mode' : 'Dark mode';
    const themeToggleAriaLabel = isDarkMode ? 'Switch to light mode' : 'Switch to dark mode';

    const hasBreadcrumb = Boolean(breadcrumbItems && breadcrumbItems.length > 0);
    // The page-header band (breadcrumb + H1 + description) only renders when there
    // is something to show. The tools index omits it — its own hero inside
    // `.main-container` is the page H1 — so the bar sits directly above the hero.
    const hasPageHeader = hasBreadcrumb || Boolean(title) || Boolean(description);

    return (
        <header className="cst-shell__header">
            {/* Slim, full-bleed bar pinned to the top of the viewport: brand left,
                Browse Tools menu + theme toggle right. The page title/breadcrumb live
                in the page-header band below so the bar stays compact while scrolling. */}
            <div className="cst-appbar">
                <div className="cst-appbar__inner">
                    <a className="cst-shell__brand" href={homeHref} aria-label="CodeSamplez Tools home">
                        <span className="cst-shell__brand-mark" aria-hidden="true">{'</>'}</span>
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
                                    {isDarkMode ? <SunIcon /> : <MoonIcon />}
                                </span>
                                <span className="cst-shell__theme-toggle-text">{themeToggleLabel}</span>
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
            {/* Page-header band: breadcrumb + H1 + description, constrained to the
                content column. Kept in the prerendered markup so the H1 and the
                BreadcrumbList trail stay visible to crawlers. */}
            {hasPageHeader ? (
            <div className={`cst-page-header${hasBreadcrumb ? ' cst-page-header--with-breadcrumb' : ''}`}>
                <div className="cst-page-header__inner">
                    {hasBreadcrumb ? (
                        <nav className="cst-shell__breadcrumb" aria-label="Breadcrumb">
                            <ol className="cst-shell__breadcrumb-list">
                                {breadcrumbItems!.map((item, index) => {
                                    const isCurrent = index === breadcrumbItems!.length - 1;
                                    return (
                                        <li className="cst-shell__breadcrumb-item" key={`${item.label}-${index}`}>
                                            {index > 0 ? (
                                                <span className="cst-shell__breadcrumb-separator" aria-hidden="true">/</span>
                                            ) : null}
                                            {item.href && !isCurrent ? (
                                                <a className="cst-shell__breadcrumb-link" href={item.href}>{item.label}</a>
                                            ) : (
                                                <span className="cst-shell__breadcrumb-current" aria-current="page">{item.label}</span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ol>
                        </nav>
                    ) : null}
                    {title || description ? (
                        <div className="cst-shell__title-wrap">
                            {title ? <h1 className="cst-shell__title">{title}</h1> : null}
                            {description ? <p className="cst-shell__description">{description}</p> : null}
                        </div>
                    ) : null}
                </div>
            </div>
            ) : null}
        </header>
    );
}

interface ToolShellFooterProps {
    homeHref?: string;
}

export function ToolShellFooter({ homeHref = SITE_BASE_URL }: ToolShellFooterProps): JSX.Element {
    return (
        <footer className="cst-shell__footer">
            <div className="cst-shell__footer-inner">
                <span>Client-side by design</span>
                <span aria-hidden="true">|</span>
                <a href={homeHref} className="cst-shell__footer-link">All Tools</a>
                <span aria-hidden="true">|</span>
                <a href={MAIN_SITE_URL} className="cst-shell__footer-link">CodeSamplez.com</a>
            </div>
        </footer>
    );
}
