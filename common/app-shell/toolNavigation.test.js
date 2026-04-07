import { getGroupedToolDefinitions, getRootPageDefinition } from '../../scripts/tool-manifest';
import { resolveCatalogHref, TOOL_CATALOG_ROOT_PATH } from './toolCatalog';
import { TOOL_NAVIGATION_GROUPS } from './toolNavigation';

describe('tool navigation catalog', () => {
    it('stays aligned with the grouped manifest data used by the generated root index', () => {
        const rootPath = new URL(getRootPageDefinition().absoluteUrl).pathname;

        expect(TOOL_CATALOG_ROOT_PATH).toBe(rootPath);
        expect(TOOL_NAVIGATION_GROUPS).toEqual(
            getGroupedToolDefinitions().map((group) => ({
                label: group.label,
                tools: group.tools.map((tool) => ({
                    label: tool.title,
                    href: resolveCatalogHref(tool.publicPath, rootPath)
                }))
            }))
        );
    });
});
