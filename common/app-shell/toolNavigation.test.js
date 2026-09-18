import { getGroupedToolDefinitions, getRootPageDefinition } from '../../scripts/tool-manifest';
import { SITE_BASE_URL, buildSiteHref } from '../siteBaseUrl';
import { TOOL_NAVIGATION_GROUPS } from './toolNavigation';

describe('tool navigation catalog', () => {
    it('stays aligned with the grouped manifest data used by the generated root index', () => {
        const rootAbsoluteUrl = getRootPageDefinition().absoluteUrl;

        expect(SITE_BASE_URL).toBe(rootAbsoluteUrl);
        expect(TOOL_NAVIGATION_GROUPS).toEqual(
            getGroupedToolDefinitions().map((group) => ({
                label: group.label,
                tools: group.tools.map((tool) => ({
                    label: tool.title,
                    href: buildSiteHref(tool.publicPath)
                }))
            }))
        );
    });
});
