import type { JSX } from 'preact';
import { analyticsToolIdFromPublicPath } from '../app-shell/toolCatalog';
import { buildSiteHref } from '../siteBaseUrl';
import { RELATED_TOOL_TARGET_ATTR } from './related-tool-click-analytics';
import type { RelatedToolSummary } from './RelatedTools';

interface RelatedToolsCompactRowProps {
    tools: RelatedToolSummary[];
}

/**
 * Compact handoff row directly under the interactive workspace. Reuses the
 * same related-tool list as {@link RelatedToolsSection} but surfaces only the
 * destination titles so visitors see follow-ons before they scroll to the full
 * cards below the article.
 */
export function RelatedToolsCompactRow({ tools }: RelatedToolsCompactRowProps): JSX.Element | null {
    if (!tools.length) {
        return null;
    }

    return (
        <nav className="c-related-tools-compact" aria-labelledby="related-tools-compact-heading">
            <h2 id="related-tools-compact-heading" className="c-related-tools-compact__title">
                Related tools
            </h2>
            <ul className="c-related-tools-compact__list">
                {tools.map((tool) => (
                    <li className="c-related-tools-compact__item" key={tool.id}>
                        <a
                            className="c-related-tools-compact__link"
                            href={buildSiteHref(tool.publicPath)}
                            {...{ [RELATED_TOOL_TARGET_ATTR]: analyticsToolIdFromPublicPath(tool.publicPath) }}
                        >
                            {tool.title}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
