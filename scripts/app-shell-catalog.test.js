const {
    getAppShellCatalogDefinition,
    getAppShellCatalogDependencies,
    sortCatalogEntries
} = require('./app-shell-catalog');
const {
    REPO_ROOT,
    ROOT_CONFIG_PATH,
    getCatalogGroups,
    getRootPageDefinition,
    getToolDefinitions,
    getToolMetadataPath
} = require('./tool-manifest');

describe('app-shell catalog helper', () => {
    it('builds the minimal browser catalog from the manifest', () => {
        const catalog = getAppShellCatalogDefinition();
        const rootPageDefinition = getRootPageDefinition();

        expect(catalog.rootPage).toEqual({
            title: rootPageDefinition.title,
            description: rootPageDefinition.description,
            rootPath: new URL(rootPageDefinition.absoluteUrl).pathname
        });
        expect(catalog.groups).toEqual(getCatalogGroups());
        expect(catalog.entries).toEqual(
            sortCatalogEntries(
                getToolDefinitions().map((tool) => ({
                    id: tool.id,
                    title: tool.title,
                    description: tool.indexDescription,
                    publicPath: tool.publicPath,
                    catalogGroupId: tool.catalogGroupId,
                    catalogOrder: tool.catalogOrder
                })),
                getCatalogGroups()
            )
        );
        expect(catalog.entries[0]).not.toHaveProperty('absolutePageUrl');
        expect(catalog.entries[0]).not.toHaveProperty('relatedToolIds');
    });

    it('tracks root config, tool metadata, and repo context as dependencies', () => {
        expect(getAppShellCatalogDependencies()).toEqual({
            fileDependencies: [
                ROOT_CONFIG_PATH,
                ...getToolDefinitions().map((tool) => getToolMetadataPath(tool.id))
            ],
            contextDependencies: [REPO_ROOT]
        });
    });
});
