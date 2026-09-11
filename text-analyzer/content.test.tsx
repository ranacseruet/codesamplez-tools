import { render } from 'preact';
import { FAQ_ITEMS, TextAnalyzerIntro, TextAnalyzerArticle } from './content';

describe('text-analyzer content', () => {
    it('keeps every FAQ answer self-contained and in parity with its structured-data answer', () => {
        expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(5);

        FAQ_ITEMS.forEach((item) => {
            expect(typeof item.question).toBe('string');
            expect(item.question.trim().length).toBeGreaterThan(0);
            expect(typeof item.answer).toBe('string');
            expect(typeof item.answer === 'string' ? item.answer.trim().length : 0).toBeGreaterThan(0);
            expect(item.answer).toBe(item.structuredDataAnswer);
        });
    });

    it('has no duplicate questions in FAQ_ITEMS', () => {
        const questions = FAQ_ITEMS.map((item) => item.question.trim().toLowerCase());
        expect(new Set(questions).size).toBe(questions.length);
    });

    it('renders the intro section with lead description', () => {
        document.body.innerHTML = '<div id="test-intro"></div>';
        const root = document.getElementById('test-intro');

        render(<TextAnalyzerIntro />, root!);

        const heading = root!.querySelector('#text-analyzer-intro-heading');
        expect(heading).not.toBeNull();
        expect(heading!.textContent).toBe('About This Tool');

        const lead = root!.querySelector('.c-tool-article__lead');
        expect(lead).not.toBeNull();
        expect(lead!.textContent).toContain('CodeSamplez Text Analyzer');
    });

    it('renders the article with structured guide sections and FAQs', () => {
        document.body.innerHTML = '<div id="test-article"></div>';
        const root = document.getElementById('test-article');

        render(<TextAnalyzerArticle />, root!);

        expect(root!.querySelector('#what-is-text-analyzer')).not.toBeNull();
        expect(root!.querySelector('#text-analyzer-features')).not.toBeNull();
        expect(root!.querySelector('#how-to-use-text-analyzer')).not.toBeNull();
        expect(root!.querySelector('#text-analyzer-limitations')).not.toBeNull();
        expect(root!.querySelector('#text-analyzer-privacy')).not.toBeNull();
        expect(root!.querySelector('#text-analyzer-faqs')).not.toBeNull();

        const renderedFaqQuestions = root!.querySelectorAll('.c-tool-faq__item');
        expect(renderedFaqQuestions.length).toBe(FAQ_ITEMS.length);
    });
});
