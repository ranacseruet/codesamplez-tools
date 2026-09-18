import { TOOL_CATALOG_ENTRIES, TOOL_CATALOG_GROUPS } from './toolCatalog';
import { buildSiteHref } from '../siteBaseUrl';

export interface ToolNavigationItem {
    label: string;
    href: string;
}

export interface ToolNavigationGroup {
    label: string;
    tools: ToolNavigationItem[];
}

export const TOOL_NAVIGATION_GROUPS: ToolNavigationGroup[] = TOOL_CATALOG_GROUPS.map((group) => ({
    label: group.label,
    tools: TOOL_CATALOG_ENTRIES
        .filter((tool) => tool.catalogGroupId === group.id)
        .sort((left, right) => left.catalogOrder - right.catalogOrder || left.title.localeCompare(right.title))
        .map((tool) => ({
            label: tool.title,
            href: buildSiteHref(tool.publicPath)
        }))
}));
