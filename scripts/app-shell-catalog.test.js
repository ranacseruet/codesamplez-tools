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

function withEnv(overrides, run) {
    const originalEnv = { ...process.env };

    Object.keys(overrides).forEach((key) => {
        const value = overrides[key];
        if (typeof value === 'undefined') {
            delete process.env[key];
            return;
        }

        process.env[key] = value;
    });

    try {
        return run();
    } finally {
        process.env = originalEnv;
    }
}

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

    it('uses the root path derived from the development site base url in development mode', () => {
        const catalog = withEnv({
            NODE_ENV: 'development',
            PORT: '8081',
            CST_SITE_BASE_URL: undefined
        }, () => getAppShellCatalogDefinition());

        expect(catalog.rootPage.rootPath).toBe('/');
    });
});
