import type { ComponentChildren, JSX } from 'preact';
import { SITE_BASE_URL, buildSiteHref } from '../siteBaseUrl';

export interface ToolArticleSectionProps {
    id: string;
    title: string;
    children: ComponentChildren;
}

export interface ToolFaqItem {
    question: string;
    answer: JSX.Element | string;
    structuredDataAnswer: string;
}

export interface ToolFaqListProps {
    items: ToolFaqItem[];
}

export interface ToolArticleRelatedTool {
    id: string;
    title: string;
    publicPath: string;
}

/** Props every `*Article` export accepts; supplied by `createArticleAfterAppNode`. */
export interface ToolArticleProps {
    relatedTools?: ToolArticleRelatedTool[];
}

export function ToolArticleSection({ id, title, children }: ToolArticleSectionProps): JSX.Element {
    return (
        <section className="c-tool-article__section" aria-labelledby={id}>
            <h2 id={id} className="c-tool-article__title">{title}</h2>
            <div className="c-tool-article__content">
                {children}
            </div>
        </section>
    );
}

export function ToolFaqList({ items }: ToolFaqListProps): JSX.Element | null {
    if (!items.length) {
        return null;
    }

    return (
        <dl className="c-tool-faq">
            {items.map((item) => (
                <div className="c-tool-faq__item" key={item.question}>
                    <dt className="c-tool-faq__question">{item.question}</dt>
                    <dd className="c-tool-faq__answer">
                        {typeof item.answer === 'string' ? <p>{item.answer}</p> : item.answer}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

/**
 * Article CTA row linking straight to the tool's related tools. It replaced a
 * single generic "Explore More Dev Tools" link to the index after the
 * related-tools decision read (2026-09-24) came back flat: a named next tool
 * is one click from a hop, the index is two.
 *
 * Falls back to the index link only when no related tools are passed, which
 * happens in isolated unit renders — the prerender always supplies them.
 */
export function ToolArticleNextSteps({ relatedTools = [] }: ToolArticleProps): JSX.Element {
    return (
        <div className="c-tool-article__cta-row">
            {relatedTools.length ? (
                relatedTools.map((tool) => (
                    <a className="c-button" href={buildSiteHref(tool.publicPath)} key={tool.id}>
                        {tool.title}
                    </a>
                ))
            ) : (
                <a className="c-button" href={SITE_BASE_URL}>
                    Explore More Dev Tools
                </a>
            )}
        </div>
    );
}
