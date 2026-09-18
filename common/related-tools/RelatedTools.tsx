import type { JSX } from 'preact';
import { buildSiteHref } from '../siteBaseUrl';

export interface RelatedToolSummary {
    id: string;
    title: string;
    /** One-line handoff from the current tool — see `scripts/related-tools-metadata.js`. */
    reason: string;
    publicPath: string;
    /**
     * Prerendered inline Lucide SVG from `renderInlineIcon` (`scripts/lucide-icons.js`),
     * passed as markup because this component is only ever server-rendered.
     */
    iconSvg: string;
    /** v4 category accent slug — `formatters` | `encoders` | `text`. */
    categorySlug: string;
}

interface RelatedToolsSectionProps {
    tools: RelatedToolSummary[];
    /** Title of the tool the visitor is on, used to frame the section. */
    sourceToolTitle?: string;
}

export function RelatedToolsSection({ tools, sourceToolTitle }: RelatedToolsSectionProps): JSX.Element | null {
    if (!tools.length) {
        return null;
    }

    const subheading = sourceToolTitle
        ? `Common follow-ons after using the ${sourceToolTitle}.`
        : 'Common follow-ons from this tool.';

    return (
        <section className="c-related-tools c-surface-card" aria-labelledby="related-tools-heading">
            <div className="c-related-tools__header">
                {/* "Next step" rather than "Related tools": the section is a task
                    handoff, not a directory — the footer below already lists every
                    tool, so a second directory adds nothing. */}
                <h2 id="related-tools-heading" className="c-related-tools__title">Next step</h2>
                <p className="c-related-tools__description">{subheading}</p>
            </div>
            <div className="c-related-tools__grid">
                {tools.map((tool) => (
                    <article
                        className={`c-related-tools__card c-related-tools__card--${tool.categorySlug}`}
                        key={tool.id}
                    >
                        <span
                            className="c-related-tools__icon"
                            aria-hidden="true"
                            // Build-time constant from the vendored Lucide geometry,
                            // never user input.
                            dangerouslySetInnerHTML={{ __html: tool.iconSvg }}
                        />
                        {/* Stretched link, matching the landing cards: the title
                            anchor covers the whole card, so each card is one tab
                            stop with a unique, descriptive accessible name. The
                            three identical "Open tool" links this replaces failed
                            WCAG 2.4.4 and wasted the internal anchor text. */}
                        <h3 className="c-related-tools__card-title">
                            <a className="c-related-tools__link" href={buildSiteHref(tool.publicPath)}>
                                {tool.title}
                            </a>
                        </h3>
                        <p className="c-related-tools__card-copy">{tool.reason}</p>
                        <span className="c-related-tools__cta" aria-hidden="true">Open tool →</span>
                    </article>
                ))}
            </div>
        </section>
    );
}
