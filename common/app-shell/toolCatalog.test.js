const { getAppShellCatalogDefinition } = require('../../scripts/app-shell-catalog');
const { getCatalogGroups, getRootPageDefinition, getToolDefinitions } = require('../../scripts/tool-manifest');
const { ROOT_PAGE_METADATA, TOOL_CATALOG_ENTRIES, TOOL_CATALOG_GROUPS, normalizeToolCatalog } = require('./toolCatalog');

function sortToolDefinitionsForCatalog(toolDefinitions) {
    const groupOrder = new Map(getCatalogGroups().map((group, index) => [group.id, index]));

    return toolDefinitions.slice().sort((left, right) => {
        const leftGroupOrder = groupOrder.get(left.catalogGroupId) ?? Number.MAX_SAFE_INTEGER;
        const rightGroupOrder = groupOrder.get(right.catalogGroupId) ?? Number.MAX_SAFE_INTEGER;

        if (leftGroupOrder !== rightGroupOrder) {
            return leftGroupOrder - rightGroupOrder;
        }

        return left.catalogOrder - right.catalogOrder || left.title.localeCompare(right.title);
    });
}

describe('tool catalog runtime data', () => {
    it('matches the generated browser catalog payload', () => {
        const generatedCatalog = getAppShellCatalogDefinition();

        expect(ROOT_PAGE_METADATA).toEqual(generatedCatalog.rootPage);
        expect(TOOL_CATALOG_GROUPS).toEqual(generatedCatalog.groups);
        expect(TOOL_CATALOG_ENTRIES).toEqual(generatedCatalog.entries);
    });

    it('preserves root-config group order and root-page metadata', () => {
        const rootPageDefinition = getRootPageDefinition();

        expect(ROOT_PAGE_METADATA).toEqual({
            title: rootPageDefinition.title,
            description: rootPageDefinition.description,
            rootPath: new URL(rootPageDefinition.absoluteUrl).pathname,
            absoluteUrl: rootPageDefinition.absoluteUrl,
            staticRootUri: rootPageDefinition.staticRootUri
        });
        expect(TOOL_CATALOG_GROUPS).toEqual(getCatalogGroups());
        expect(TOOL_CATALOG_ENTRIES.map((entry) => entry.id)).toEqual(
            sortToolDefinitionsForCatalog(getToolDefinitions()).map((tool) => tool.id)
        );
    });

    it('normalizes entries using root-config group order instead of catalog-group id sorting', () => {
        const normalizedCatalog = normalizeToolCatalog(
            {
                rootPage: {
                    title: 'Fixture',
                    description: 'Fixture description',
                    rootPath: '/tools/',
                    absoluteUrl: 'https://example.com/tools/',
                    staticRootUri: 'https://static.example.com/tools/'
                },
                catalogGroups: [
                    { id: 'group-b', label: 'Group B' },
                    { id: 'group-a', label: 'Group A' }
                ]
            },
            [
                {
                    id: 'tool-a',
                    title: 'Tool A',
                    indexDescription: 'Tool A description',
                    publicPath: '/tool-a/',
                    catalogGroupId: 'group-a',
                    catalogOrder: 1
                },
                {
                    id: 'tool-b',
                    title: 'Tool B',
                    indexDescription: 'Tool B description',
                    publicPath: '/tool-b/',
                    catalogGroupId: 'group-b',
                    catalogOrder: 1
                }
            ]
        );

        expect(normalizedCatalog.groups.map((group) => group.id)).toEqual(['group-b', 'group-a']);
        expect(normalizedCatalog.entries.map((entry) => entry.id)).toEqual(['tool-b', 'tool-a']);
    });

    it('falls back to title sorting when group and catalog order are tied', () => {
        const normalizedCatalog = normalizeToolCatalog(
            {
                rootPage: {
                    title: 'Fixture',
                    description: 'Fixture description',
                    rootPath: '/tools/',
                    absoluteUrl: 'https://example.com/tools/',
                    staticRootUri: 'https://static.example.com/tools/'
                },
                catalogGroups: [
                    { id: 'group-a', label: 'Group A' }
                ]
            },
            [
                {
                    id: 'tool-z',
                    title: 'Zulu Tool',
                    indexDescription: 'Zulu description',
                    publicPath: '/tool-z/',
                    catalogGroupId: 'group-a',
                    catalogOrder: 1
                },
                {
                    id: 'tool-a',
                    title: 'Alpha Tool',
                    indexDescription: 'Alpha description',
                    publicPath: '/tool-a/',
                    catalogGroupId: 'group-a',
                    catalogOrder: 1
                }
            ]
        );

        expect(normalizedCatalog.entries.map((entry) => entry.id)).toEqual(['tool-a', 'tool-z']);
    });

    it('throws when the injected runtime catalog is missing', () => {
        const previousCatalog = global.__CST_APP_SHELL_CATALOG__;

        delete global.__CST_APP_SHELL_CATALOG__;
        jest.resetModules();

        expect(() => {
            jest.isolateModules(() => {
                require('./toolCatalog');
            });
        }).toThrow('App shell catalog was not injected into the runtime bundle');

        global.__CST_APP_SHELL_CATALOG__ = previousCatalog;
        jest.resetModules();
    });
});

describe('resolveToolIdFromPath', () => {
    const { resolveToolIdFromPath } = require('./toolCatalog');

    it.each([
        ['a canonical tool path', '/json-formatter/', 'json-formatter-tool'],
        ['a path without the trailing slash', '/json-formatter', 'json-formatter-tool'],
        ['an explicit index document', '/json-formatter/index.html', 'json-formatter-tool'],
        ['a sub-directory deployment', '/tools/diff-checker/', 'diff-checker-tool']
    ])('resolves %s', (_label, pathName, expectedId) => {
        expect(resolveToolIdFromPath(pathName)).toBe(expectedId);
    });

    it.each([
        ['the tools index', '/'],
        ['an empty path', ''],
        ['an unknown route', '/not-a-tool/'],
        ['the index document of the root page', '/index.html']
    ])('returns null for %s', (_label, pathName) => {
        expect(resolveToolIdFromPath(pathName)).toBeNull();
    });
});
