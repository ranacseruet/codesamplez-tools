import { render } from 'preact';
import { ToolShellFooter, ToolShellHeader, createToolBreadcrumbItems } from './AppShell';
import { ShareBar } from './ShareBar';
import { resolveToolIdFromPath } from './toolCatalog';
import { recordToolVisit } from '../recent-tools';
import { openShortcutHelp, registerShortcutHelp } from '../shortcut-utils';
import { SITE_BASE_URL } from '../siteBaseUrl';
import type { MountToolShellOptions } from '../tooling-contracts';

const STANDALONE_THEME_STORAGE_KEY = 'cst-standalone-theme-mode';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';
const THEME_ATTR = 'data-theme';
const LEGACY_THEME_ATTR = 'data-cst-theme';
let activeThemeObserver: MutationObserver | null = null;
let activeShortcutHelpCleanup: (() => void) | null = null;
let activeVisitRecordingCleanup: (() => void) | null = null;

type ThemeMode = typeof THEME_LIGHT | typeof THEME_DARK;

function isValidThemeMode(value: unknown): value is ThemeMode {
    return value === THEME_LIGHT || value === THEME_DARK;
}

function getStoredStandaloneThemeMode(): ThemeMode | null {
    try {
        const storedThemeMode = window.localStorage.getItem(STANDALONE_THEME_STORAGE_KEY);
        return isValidThemeMode(storedThemeMode) ? storedThemeMode : null;
    } catch {
        return null;
    }
}

function getDocumentThemeMode(): ThemeMode | null {
    if (typeof document === 'undefined' || !document.documentElement) {
        return null;
    }

    const currentThemeMode = document.documentElement.getAttribute(THEME_ATTR);
    if (isValidThemeMode(currentThemeMode)) {
        return currentThemeMode;
    }

    const legacyThemeMode = document.documentElement.getAttribute(LEGACY_THEME_ATTR);
    return isValidThemeMode(legacyThemeMode) ? legacyThemeMode : null;
}

function applyStandaloneThemeMode(themeMode: ThemeMode): ThemeMode {
    if (typeof document === 'undefined' || !document.documentElement) {
        return themeMode;
    }

    const resolvedThemeMode = themeMode === THEME_DARK ? THEME_DARK : THEME_LIGHT;
    document.documentElement.setAttribute(THEME_ATTR, resolvedThemeMode);
    // Keep the legacy attribute during migration to avoid breaking existing selectors.
    document.documentElement.setAttribute(LEGACY_THEME_ATTR, resolvedThemeMode);
    return resolvedThemeMode;
}

function persistStandaloneThemeMode(themeMode: ThemeMode): void {
    try {
        window.localStorage.setItem(STANDALONE_THEME_STORAGE_KEY, themeMode);
    } catch {
        // Ignore storage failures (private mode / blocked storage).
    }
}

export function mountToolShell({
    title,
    description,
    homeHref = SITE_BASE_URL,
    headerRootId = 'app-shell-header',
    footerRootId = 'app-shell-footer',
    shareRootId = 'app-shell-share',
    showThemeToggle = false
}: MountToolShellOptions = {}): void {
    const headerRoot = document.getElementById(headerRootId);
    const footerRoot = document.getElementById(footerRootId);
    const shareRoot = document.getElementById(shareRootId);
    const isStandaloneMode = document.body?.classList.contains('standalone-app');
    const shouldEnableThemeToggle = showThemeToggle || Boolean(isStandaloneMode);

    if (activeThemeObserver) {
        activeThemeObserver.disconnect();
        activeThemeObserver = null;
    }

    if (activeShortcutHelpCleanup) {
        activeShortcutHelpCleanup();
        activeShortcutHelpCleanup = null;
    }

    // The `?` overlay is available on every page the shell mounts; the chunk
    // that renders it only loads on first use.
    activeShortcutHelpCleanup = registerShortcutHelp();

    if (activeVisitRecordingCleanup) {
        activeVisitRecordingCleanup();
        activeVisitRecordingCleanup = null;
    }

    // Recently used tools (Phase D3). Recorded here rather than per tool so the
    // id always comes from the catalog: the landing row and the recorded visit
    // cannot drift apart. The tools index mounts the same shell, and resolves
    // to no tool id, so browsing the index never counts as a visit.
    if (isStandaloneMode) {
        const visitedToolId = resolveToolIdFromPath(window.location.pathname);
        if (visitedToolId) {
            recordToolVisit(visitedToolId);

            // Coming Back to this tool restores it from the back/forward cache
            // without re-running this mount, so the visit would keep the
            // timestamp of the *first* time it was opened and sink down the
            // recency order. `pageshow` is the one event that fires on a
            // bfcache restore.
            const onPageShow = (event: PageTransitionEvent) => {
                if (event.persisted) {
                    recordToolVisit(visitedToolId);
                }
            };

            window.addEventListener('pageshow', onPageShow);
            activeVisitRecordingCleanup = () => {
                window.removeEventListener('pageshow', onPageShow);
            };
        }
    }

    // Dark is the product default: it applies when the toggle is disabled (no
    // resolution runs) and as the final fallback below — the generated documents'
    // pre-paint init script normally sets data-theme (stored choice or dark)
    // before this code executes.
    let currentThemeMode: ThemeMode = THEME_DARK;
    const resolvedHomeHref = homeHref === '/' ? SITE_BASE_URL : homeHref;
    // The breadcrumb belongs to individual tool pages (standalone shell), not the
    // tools index. Build it from the current tool title so the re-render on theme
    // toggle keeps it in place, matching the server-rendered markup.
    const breadcrumbItems = isStandaloneMode && title
        ? createToolBreadcrumbItems(title, resolvedHomeHref)
        : undefined;

    if (shouldEnableThemeToggle) {
        currentThemeMode = applyStandaloneThemeMode(
            getDocumentThemeMode() || getStoredStandaloneThemeMode() || THEME_DARK
        );
    }

    function handleThemeToggle(): void {
        currentThemeMode = currentThemeMode === THEME_DARK ? THEME_LIGHT : THEME_DARK;
        applyStandaloneThemeMode(currentThemeMode);
        persistStandaloneThemeMode(currentThemeMode);
        renderHeader();
    }

    function handleOpenShortcutHelp(): void {
        void openShortcutHelp();
    }

    function renderHeader(): void {
        if (!headerRoot) {
            return;
        }

        render(
            <ToolShellHeader
                title={title}
                description={description}
                homeHref={resolvedHomeHref}
                breadcrumbItems={breadcrumbItems}
                showThemeToggle={shouldEnableThemeToggle}
                themeMode={currentThemeMode}
                onToggleTheme={shouldEnableThemeToggle ? handleThemeToggle : undefined}
                onOpenShortcutHelp={handleOpenShortcutHelp}
            />,
            headerRoot
        );
    }

    renderHeader();

    if (footerRoot) {
        render(<ToolShellFooter homeHref={resolvedHomeHref} />, footerRoot);
    }

    // The share rail lives only on standalone tool pages. Re-render it on the
    // client (it survives the server markup being replaced) and derive the URL
    // from the live location so no per-tool config is needed. Share only the
    // canonical origin+pathname — never `search`/`hash` — so tools that encode
    // user input into the URL (e.g. the Base64 converter's `#data=` links) don't
    // leak that payload to the social platforms, keeping the no-transmission model.
    if (shareRoot && isStandaloneMode) {
        const shareTitle = title ?? document.title;
        const shareUrl = `${window.location.origin}${window.location.pathname}`;
        render(<ShareBar shareUrl={shareUrl} shareTitle={shareTitle} />, shareRoot);
    }

    if (shouldEnableThemeToggle && typeof MutationObserver !== 'undefined' && document.documentElement) {
        activeThemeObserver = new MutationObserver((mutations: MutationRecord[]) => {
            const hasThemeMutation = mutations.some((mutation) =>
                mutation.type === 'attributes' &&
                (mutation.attributeName === THEME_ATTR || mutation.attributeName === LEGACY_THEME_ATTR)
            );
            if (!hasThemeMutation) {
                return;
            }

            const observedThemeMode = getDocumentThemeMode();
            if (!isValidThemeMode(observedThemeMode) || observedThemeMode === currentThemeMode) {
                return;
            }

            currentThemeMode = applyStandaloneThemeMode(observedThemeMode);
            renderHeader();
        });

        activeThemeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: [THEME_ATTR, LEGACY_THEME_ATTR]
        });
    }
}
