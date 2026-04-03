import { getGroupedToolDefinitions } from '../../scripts/tool-manifest';
import { TOOL_NAVIGATION_GROUPS } from './toolNavigation';

describe('tool navigation catalog', () => {
    it('stays aligned with the grouped manifest data used by the generated root index', () => {
        expect(TOOL_NAVIGATION_GROUPS).toEqual(
            getGroupedToolDefinitions().map((group) => ({
                label: group.label,
                tools: group.tools.map((tool) => ({
                    label: tool.title,
                    href: tool.publicPath
                }))
            }))
        );
    });
});
