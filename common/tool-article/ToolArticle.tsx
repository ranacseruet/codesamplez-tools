import type { ComponentChildren, JSX } from 'preact';

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
