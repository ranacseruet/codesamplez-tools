import type { JSX } from 'preact';

export interface RelatedToolSummary {
    id: string;
    title: string;
    description: string;
    publicPath: string;
}

interface RelatedToolsSectionProps {
    tools: RelatedToolSummary[];
}

export function RelatedToolsSection({ tools }: RelatedToolsSectionProps): JSX.Element | null {
    if (!tools.length) {
        return null;
    }

    return (
        <section className="c-related-tools c-surface-card" aria-labelledby="related-tools-heading">
            <div className="c-related-tools__header">
                <h2 id="related-tools-heading" className="c-related-tools__title">Related tools</h2>
                <p className="c-related-tools__description">More browser-based utilities that fit naturally into the same workflow.</p>
            </div>
            <div className="c-related-tools__grid">
                {tools.map((tool) => (
                    <article className="c-related-tools__card c-surface-card" key={tool.id}>
                        <h3 className="c-related-tools__card-title">{tool.title}</h3>
                        <p className="c-related-tools__card-copy">{tool.description}</p>
                        <a className="c-button c-button--secondary c-button--small c-related-tools__cta" href={tool.publicPath}>
                            Open tool
                        </a>
                    </article>
                ))}
            </div>
        </section>
    );
}
