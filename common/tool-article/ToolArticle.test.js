import { render } from 'preact';
import { SITE_BASE_URL, buildSiteHref } from '../siteBaseUrl';
import { ToolArticleNextSteps, ToolArticleSection, ToolFaqList } from './ToolArticle';

describe('ToolArticle primitives', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="test-root"></div>';
    });

    it('renders a titled article section with children', () => {
        const root = document.getElementById('test-root');

        render(
            <ToolArticleSection id="section-a" title="Section A">
                <p>Section body copy</p>
            </ToolArticleSection>,
            root
        );

        expect(root.querySelector('#section-a')?.textContent).toBe('Section A');
        expect(root.textContent).toContain('Section body copy');
    });

    it('returns no markup for an empty FAQ list', () => {
        const root = document.getElementById('test-root');

        render(<ToolFaqList items={[]} />, root);

        expect(root.innerHTML).toBe('');
    });

    it('renders both string and JSX FAQ answers', () => {
        const root = document.getElementById('test-root');

        render(
            <ToolFaqList
                items={[
                    { question: 'Question 1', answer: 'String answer', structuredDataAnswer: 'String answer' },
                    { question: 'Question 2', answer: <span>JSX answer</span>, structuredDataAnswer: 'JSX answer' }
                ]}
            />,
            root
        );

        const questions = Array.from(root.querySelectorAll('.c-tool-faq__question')).map((node) => node.textContent);
        const answers = Array.from(root.querySelectorAll('.c-tool-faq__answer')).map((node) => node.textContent);

        expect(questions).toEqual(['Question 1', 'Question 2']);
        expect(answers).toEqual(['String answer', 'JSX answer']);
    });

    it('links the CTA row to each related tool, in order', () => {
        const root = document.getElementById('test-root');

        render(
            <ToolArticleNextSteps
                relatedTools={[
                    { id: 'jwt-builder-tool', title: 'JWT Builder', publicPath: '/jwt-builder/' },
                    { id: 'base64-converter-tool', title: 'Base64 Converter', publicPath: '/base64-converter/' }
                ]}
            />,
            root
        );

        const links = [...root.querySelectorAll('.c-tool-article__cta-row a')];
        expect(links.map((link) => link.textContent)).toEqual(['JWT Builder', 'Base64 Converter']);
        expect(links.map((link) => link.getAttribute('href')))
            .toEqual([buildSiteHref('/jwt-builder/'), buildSiteHref('/base64-converter/')]);
    });

    it('falls back to the tools index when no related tools are passed', () => {
        const root = document.getElementById('test-root');

        render(<ToolArticleNextSteps />, root);

        const links = root.querySelectorAll('.c-tool-article__cta-row a');
        expect(links).toHaveLength(1);
        expect(links[0].getAttribute('href')).toBe(SITE_BASE_URL);
    });
});
