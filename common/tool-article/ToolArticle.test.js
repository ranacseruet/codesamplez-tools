import { render } from 'preact';
import { ToolArticleSection, ToolFaqList } from './ToolArticle';

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
});
