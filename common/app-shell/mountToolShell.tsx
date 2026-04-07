import { render } from 'preact';
import { ToolShellFooter, ToolShellHeader } from './AppShell';
import { TOOL_CATALOG_ROOT_PATH } from './toolCatalog';
import type { MountToolShellOptions } from '../tooling-contracts';

const STANDALONE_THEME_STORAGE_KEY = 'cst-standalone-theme-mode';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';
const THEME_ATTR = 'data-theme';
const LEGACY_THEME_ATTR = 'data-cst-theme';
let activeThemeObserver: MutationObserver | null = null;

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

function getSystemPreferredThemeMode(): ThemeMode {
    try {
        return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? THEME_DARK : THEME_LIGHT;
    } catch {
        return THEME_LIGHT;
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
    homeHref = TOOL_CATALOG_ROOT_PATH,
    headerRootId = 'app-shell-header',
    footerRootId = 'app-shell-footer',
    showThemeToggle = false
}: MountToolShellOptions = {}): void {
    const headerRoot = document.getElementById(headerRootId);
    const footerRoot = document.getElementById(footerRootId);
    const isStandaloneMode = document.body?.classList.contains('standalone-app');
    const shouldEnableThemeToggle = showThemeToggle || Boolean(isStandaloneMode);

    if (activeThemeObserver) {
        activeThemeObserver.disconnect();
        activeThemeObserver = null;
    }

    let currentThemeMode: ThemeMode = THEME_LIGHT;
    const resolvedHomeHref = homeHref === '/' ? TOOL_CATALOG_ROOT_PATH : homeHref;

    if (shouldEnableThemeToggle) {
        currentThemeMode = applyStandaloneThemeMode(
            getDocumentThemeMode() || getStoredStandaloneThemeMode() || getSystemPreferredThemeMode()
        );
    }

    function handleThemeToggle(): void {
        currentThemeMode = currentThemeMode === THEME_DARK ? THEME_LIGHT : THEME_DARK;
        applyStandaloneThemeMode(currentThemeMode);
        persistStandaloneThemeMode(currentThemeMode);
        renderHeader();
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
                showThemeToggle={shouldEnableThemeToggle}
                themeMode={currentThemeMode}
                onToggleTheme={shouldEnableThemeToggle ? handleThemeToggle : undefined}
            />,
            headerRoot
        );
    }

    renderHeader();

    if (footerRoot) {
        render(<ToolShellFooter homeHref={resolvedHomeHref} />, footerRoot);
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
