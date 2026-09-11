import { render } from 'preact';
import { FAQ_ITEMS, JSMinifierIntro, JSMinifierArticle } from './content';
import { SITE_BASE_URL } from '../common/siteBaseUrl';

describe('js-minifier content', () => {
    it('keeps every FAQ answer self-contained and in parity with its structured-data answer', () => {
        expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(6);

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

    it('renders the intro section with eyebrow heading and lead description', () => {
        document.body.innerHTML = '<div id="test-intro"></div>';
        const root = document.getElementById('test-intro');

        render(<JSMinifierIntro />, root!);

        const heading = root!.querySelector('#js-minifier-intro-heading');
        expect(heading).not.toBeNull();
        expect(heading!.textContent).toBe('About This Tool');

        const lead = root!.querySelector('.c-tool-article__lead');
        expect(lead).not.toBeNull();
        expect(lead!.textContent).toContain('Minify your JavaScript code online to dramatically reduce file size');
    });

    it('renders the article with structured guide sections, code samples, links, and FAQs', () => {
        document.body.innerHTML = '<div id="test-article"></div>';
        const root = document.getElementById('test-article');

        render(<JSMinifierArticle />, root!);

        expect(root!.querySelector('#js-minifier-why')).not.toBeNull();
        expect(root!.querySelector('#js-minifier-how-to-use')).not.toBeNull();
        expect(root!.querySelector('#js-minifier-features')).not.toBeNull();
        expect(root!.querySelector('#js-minifier-example')).not.toBeNull();
        expect(root!.querySelector('#js-minifier-advanced-options')).not.toBeNull();
        expect(root!.querySelector('#js-minifier-limitations')).not.toBeNull();
        expect(root!.querySelector('#js-minifier-best-practices')).not.toBeNull();
        expect(root!.querySelector('#js-minifier-privacy')).not.toBeNull();
        expect(root!.querySelector('#js-minifier-feedback')).not.toBeNull();
        expect(root!.querySelector('#js-minifier-faqs')).not.toBeNull();

        // CTA link points to site root / developer tools
        const ctaLink = root!.querySelector('section[aria-labelledby="js-minifier-why"] a');
        expect(ctaLink).not.toBeNull();
        expect(ctaLink!.getAttribute('href')).toBe(SITE_BASE_URL);

        // Feedback link points to contact page
        const feedbackLink = root!.querySelector('section[aria-labelledby="js-minifier-feedback"] a');
        expect(feedbackLink).not.toBeNull();
        expect(feedbackLink!.getAttribute('href')).toContain('contact');

        // All FAQ items are rendered
        const renderedFaqQuestions = root!.querySelectorAll('.c-tool-faq__item');
        expect(renderedFaqQuestions.length).toBe(FAQ_ITEMS.length);
    });
});
