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
export const TOOL_CATALOG_GROUPS: AppShellCatalogGroup[] = TOOL_CATALOG.groups;
export const TOOL_CATALOG_ENTRIES: AppShellToolCatalogEntry[] = TOOL_CATALOG.entries;
