// @ts-check

const { REPO_ROOT, ROOT_CONFIG_PATH, getCatalogGroups, getRootPageDefinition, getToolDefinitions, getToolMetadataPath } = require('./tool-manifest');

/**
 * @typedef {{ id: string, label: string }} AppShellCatalogGroup
 * @typedef {{ title: string, description: string, rootPath: string }} AppShellRootPageMetadata
 * @typedef {{
 *   id: string,
 *   title: string,
 *   description: string,
 *   publicPath: string,
 *   catalogGroupId: string,
 *   catalogOrder: number
 * }} AppShellToolCatalogEntry
 * @typedef {{
 *   rootPage: AppShellRootPageMetadata,
 *   groups: AppShellCatalogGroup[],
 *   entries: AppShellToolCatalogEntry[]
 * }} AppShellCatalogDefinition
 */

/**
 * @param {AppShellToolCatalogEntry[]} entries
 * @param {AppShellCatalogGroup[]} groups
 * @returns {AppShellToolCatalogEntry[]}
 */
function sortCatalogEntries(entries, groups) {
    const groupOrder = new Map(groups.map((group, index) => [group.id, index]));

    return entries.slice().sort((left, right) => {
        const leftGroupOrder = groupOrder.get(left.catalogGroupId) ?? Number.MAX_SAFE_INTEGER;
        const rightGroupOrder = groupOrder.get(right.catalogGroupId) ?? Number.MAX_SAFE_INTEGER;

        if (leftGroupOrder !== rightGroupOrder) {
            return leftGroupOrder - rightGroupOrder;
        }

        return left.catalogOrder - right.catalogOrder || left.title.localeCompare(right.title);
    });
}

/**
 * @returns {AppShellCatalogDefinition}
 */
function getAppShellCatalogDefinition() {
    const groups = getCatalogGroups();
    const rootPage = getRootPageDefinition();

    return {
        rootPage: {
            title: rootPage.title,
            description: rootPage.description,
            rootPath: new URL(rootPage.absoluteUrl).pathname
        },
        groups,
        entries: sortCatalogEntries(
            getToolDefinitions().map((tool) => ({
                id: tool.id,
                title: tool.title,
                description: tool.indexDescription,
                publicPath: tool.publicPath,
                catalogGroupId: tool.catalogGroupId,
                catalogOrder: tool.catalogOrder
            })),
            groups
        )
    };
}

/**
 * @returns {{ fileDependencies: string[], contextDependencies: string[] }}
 */
function getAppShellCatalogDependencies() {
    return {
        fileDependencies: [
            ROOT_CONFIG_PATH,
            ...getToolDefinitions().map((tool) => getToolMetadataPath(tool.id))
        ],
        contextDependencies: [REPO_ROOT]
    };
}

module.exports = {
    getAppShellCatalogDefinition,
    getAppShellCatalogDependencies,
    sortCatalogEntries
};
