import { render } from 'preact';
import { FAQ_ITEMS, CssMinifierIntro, CssMinifierArticle } from './content';

describe('css-minifier content', () => {
    it('keeps every FAQ answer self-contained and in parity with its structured-data answer', () => {
        expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(4);

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

        render(<CssMinifierIntro />, root!);

        const heading = root!.querySelector('#css-minifier-intro-heading');
        expect(heading).not.toBeNull();
        expect(heading!.textContent).toBe('About This Tool');

        const lead = root!.querySelector('.c-tool-article__lead');
        expect(lead).not.toBeNull();
        expect(lead!.textContent).toContain('CSS Minification is the process of removing unnecessary characters');
    });

    it('renders the article with structured guide sections, links, and FAQs', () => {
        document.body.innerHTML = '<div id="test-article"></div>';
        const root = document.getElementById('test-article');

        render(<CssMinifierArticle />, root!);

        expect(root!.querySelector('#css-minifier-what-is')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-why')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-how-to-use')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-features')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-error-handling')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-security')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-browser-compatibility')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-limitations')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-related-tool')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-faqs')).not.toBeNull();

        const relatedLink = root!.querySelector('section[aria-labelledby="css-minifier-related-tool"] a');
        expect(relatedLink).not.toBeNull();
        expect(relatedLink!.getAttribute('href')).toContain('/js-minifier/');

        const renderedFaqQuestions = root!.querySelectorAll('.c-tool-faq__item');
        expect(renderedFaqQuestions.length).toBe(FAQ_ITEMS.length);
    });
});
