import type { JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { TOOL_NAVIGATION_GROUPS } from './toolNavigation';
import { MAIN_SITE_URL, SITE_BASE_URL } from '../siteBaseUrl';

const REPO_URL = 'https://github.com/ranacseruet/codesamplez-tools';

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

// Browse Tools dropdown. Progressive behavior on top of native <details>:
// closes on outside click and on Escape (returning focus to the trigger);
// works with zero JS otherwise. useLayoutEffect (not useEffect) so the
// listeners attach synchronously at mount — deterministic in tests; effects
// never run during SSR (renderToString skips them), so prerendered markup is
// unchanged. The header re-renders on theme toggle; cleanup handles that.
function ToolMenu(): JSX.Element {
    const detailsRef = useRef<HTMLDetailsElement>(null);

    useLayoutEffect(() => {
        // Preact assigns object refs during commit, before layout effects run,
        // so the element is guaranteed present here.
        const details = detailsRef.current as HTMLDetailsElement;

        const onDocumentClick = (event: MouseEvent) => {
            if (details.open && event.target instanceof Node && !details.contains(event.target)) {
                details.open = false;
            }
        };
        const onDocumentKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && details.open) {
                details.open = false;
                (details.querySelector('summary') as HTMLElement | null)?.focus();
            }
        };

        document.addEventListener('click', onDocumentClick);
        document.addEventListener('keydown', onDocumentKeydown);
        return () => {
            document.removeEventListener('click', onDocumentClick);
            document.removeEventListener('keydown', onDocumentKeydown);
        };
    }, []);

    return (
        <details className="cst-shell__tool-menu" ref={detailsRef}>
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
    /**
     * Opens the `?` shortcut help overlay. Supplied only by the client mount —
     * the server-rendered header omits the button, so it can never appear
     * before the handler that makes it work exists.
     */
    onOpenShortcutHelp?: () => void;
}

export function ToolShellHeader({
    title,
    description,
    homeHref = SITE_BASE_URL,
    breadcrumbItems,
    showThemeToggle = false,
    themeMode = 'light',
    onToggleTheme,
    onOpenShortcutHelp
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
                        <ToolMenu />
                        {onOpenShortcutHelp ? (
                            <button
                                type="button"
                                className="cst-shell__shortcut-help-button"
                                aria-label="Keyboard shortcuts"
                                title="Keyboard shortcuts (?)"
                                onClick={onOpenShortcutHelp}
                            >
                                {/* The glyph is the shortcut: pressing `?` does
                                    the same thing this button does. */}
                                <span aria-hidden="true">?</span>
                            </button>
                        ) : null}
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
    const currentYear = new Date().getFullYear();
    return (
        <footer className="cst-shell__footer">
            <div className="cst-shell__footer-inner">
                {/* v4: directory footer — brand/tagline column + per-group tool
                    columns. Doubles as crawlable internal linking on every page. */}
                <div className="cst-shell__footer-grid">
                    <div className="cst-shell__footer-brand">
                        <a className="cst-shell__footer-brand-link" href={homeHref} aria-label="CodeSamplez Tools home">
                            <span className="cst-shell__brand-mark" aria-hidden="true">{'</>'}</span>
                            CodeSamplez Tools
                        </a>
                        <p className="cst-shell__footer-tagline">
                            Free, fast, client-side developer tools — your data never leaves the browser.
                        </p>
                    </div>
                    {TOOL_NAVIGATION_GROUPS.map((group) => (
                        <nav className="cst-shell__footer-nav" key={group.label} aria-label={group.label}>
                            <h2 className="cst-shell__footer-heading">{group.label}</h2>
                            <ul className="cst-shell__footer-list">
                                {group.tools.map((tool) => (
                                    <li key={tool.href}>
                                        <a className="cst-shell__footer-link" href={tool.href}>
                                            {tool.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    ))}
                </div>
                <div className="cst-shell__footer-bottom">
                    <span>Client-side by design</span>
                    <span aria-hidden="true">·</span>
                    <a href={REPO_URL} className="cst-shell__footer-link">GitHub</a>
                    <span aria-hidden="true">·</span>
                    <a href={MAIN_SITE_URL} className="cst-shell__footer-link">CodeSamplez.com</a>
                    <span aria-hidden="true">·</span>
                    <span>© {currentYear} CodeSamplez</span>
                </div>
            </div>
        </footer>
    );
}
