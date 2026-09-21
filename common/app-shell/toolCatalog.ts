export interface AppShellCatalogGroup {
    id: string;
    label: string;
}

export interface AppShellToolCatalogEntry {
    id: string;
    title: string;
    description: string;
    publicPath: string;
    catalogGroupId: string;
    catalogOrder: number;
}

export interface AppShellRootPageMetadata {
    title: string;
    description: string;
    rootPath: string;
    absoluteUrl: string;
    staticRootUri: string;
}

interface AppShellRootConfig {
    rootPage: AppShellRootPageMetadata;
    catalogGroups: AppShellCatalogGroup[];
}

interface AppShellToolMetadata {
    id: string;
    title: string;
    indexDescription: string;
    publicPath: string;
    catalogGroupId: string;
    catalogOrder: number;
}

interface AppShellToolCatalog {
    rootPage: AppShellRootPageMetadata;
    groups: AppShellCatalogGroup[];
    entries: AppShellToolCatalogEntry[];
}

function normalizeRootPath(rootPath: string): string {
    const trimmedRootPath = rootPath.trim();

    if (!trimmedRootPath || trimmedRootPath === '/') {
        return '/';
    }

    return `/${trimmedRootPath.replace(/^\/+|\/+$/g, '')}/`;
}

export function resolveCatalogHref(pathName: string, rootPath: string): string {
    const normalizedRootPath = normalizeRootPath(rootPath);
    const normalizedPathName = pathName.replace(/^\/+/, '');

    return normalizedRootPath === '/'
        ? `/${normalizedPathName}`
        : `${normalizedRootPath}${normalizedPathName}`;
}

/**
 * Last meaningful path segment: `/tools/json-formatter/index.html` and
 * `/json-formatter` both reduce to `json-formatter`. Written with index loops
 * rather than `Array#at`/`findLast` so consuming tool bundles don't pull core-js
 * helpers for a string comparison (same reasoning as `common/drop-zone.ts`).
 */
function getToolPathSlug(pathName: string): string {
    const rawSegments = pathName.split('/');
    const segments: string[] = [];
    for (let index = 0; index < rawSegments.length; index += 1) {
        const segment = rawSegments[index];
        if (segment && segment !== 'index.html') {
            segments.push(segment);
        }
    }

    return segments.length > 0 ? segments[segments.length - 1] : '';
}

/**
 * Resolves a location pathname to a catalog tool id, or `null` when the path is
 * not a tool page (the index, the 404 page, an unknown route).
 *
 * Matching on the trailing slug rather than the full public path keeps this
 * correct when the site is served from a sub-directory or without a trailing
 * slash, and means visit recording needs no per-tool wiring that could drift
 * from the catalog.
 */
export function resolveToolIdFromPath(pathName: string): string | null {
    const slug = getToolPathSlug(pathName);
    if (!slug) {
        return null;
    }

    for (let index = 0; index < TOOL_CATALOG_ENTRIES.length; index += 1) {
        const entry = TOOL_CATALOG_ENTRIES[index];
        if (getToolPathSlug(entry.publicPath) === slug) {
            return entry.id;
        }
    }

    return null;
}

export function normalizeToolCatalog(
    rawRootConfig: AppShellRootConfig,
    toolMetadata: AppShellToolMetadata[]
): AppShellToolCatalog {
    const groupOrder = new Map(rawRootConfig.catalogGroups.map((group, index) => [group.id, index]));

    return {
        rootPage: rawRootConfig.rootPage,
        groups: rawRootConfig.catalogGroups.slice(),
        entries: toolMetadata
            .map((tool) => ({
                id: tool.id,
                title: tool.title,
                description: tool.indexDescription,
                publicPath: tool.publicPath,
                catalogGroupId: tool.catalogGroupId,
                catalogOrder: tool.catalogOrder
            }))
            .sort((left, right) => {
                const leftGroupOrder = groupOrder.get(left.catalogGroupId) ?? Number.MAX_SAFE_INTEGER;
                const rightGroupOrder = groupOrder.get(right.catalogGroupId) ?? Number.MAX_SAFE_INTEGER;

                if (leftGroupOrder !== rightGroupOrder) {
                    return leftGroupOrder - rightGroupOrder;
                }

                return left.catalogOrder - right.catalogOrder || left.title.localeCompare(right.title);
            })
    };
}

function getInjectedToolCatalog(): AppShellToolCatalog {
    const toolCatalog = globalThis.__CST_APP_SHELL_CATALOG__;

    if (!toolCatalog) {
        throw new Error('App shell catalog was not injected into the runtime bundle');
    }

    return toolCatalog;
}

const TOOL_CATALOG = getInjectedToolCatalog();

export const ROOT_PAGE_METADATA = TOOL_CATALOG.rootPage;
export const TOOL_CATALOG_ROOT_PATH = normalizeRootPath(TOOL_CATALOG.rootPage.rootPath);
export const TOOL_CATALOG_GROUPS: AppShellCatalogGroup[] = TOOL_CATALOG.groups;
export const TOOL_CATALOG_ENTRIES: AppShellToolCatalogEntry[] = TOOL_CATALOG.entries;
