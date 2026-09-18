import { render } from 'preact';
import { FAQ_ITEMS, DiffCheckerIntro, DiffCheckerArticle } from './content';
import { SITE_BASE_URL } from '../common/siteBaseUrl';

describe('diff-checker content', () => {
    it('keeps every FAQ answer self-contained and in parity with its structured-data answer', () => {
        expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(7);

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

        render(<DiffCheckerIntro />, root!);

        const heading = root!.querySelector('#diff-checker-intro-heading');
        expect(heading).not.toBeNull();
        expect(heading!.textContent).toBe('About This Tool');

        const lead = root!.querySelector('.c-tool-article__lead');
        expect(lead).not.toBeNull();
        expect(lead!.textContent).toContain('The Diff Checker Tool is a lightweight, web-based utility');
    });

    it('renders the article with structured guide sections, links, code examples, and FAQs', () => {
        document.body.innerHTML = '<div id="test-article"></div>';
        const root = document.getElementById('test-article');

        render(<DiffCheckerArticle />, root!);

        expect(root!.querySelector('#diff-checker-what-is')).not.toBeNull();
        expect(root!.querySelector('#diff-checker-features')).not.toBeNull();
        expect(root!.querySelector('#diff-checker-usage')).not.toBeNull();
        expect(root!.querySelector('#diff-checker-limitations')).not.toBeNull();
        expect(root!.querySelector('#diff-checker-privacy')).not.toBeNull();
        expect(root!.querySelector('#diff-checker-feedback')).not.toBeNull();
        expect(root!.querySelector('#diff-checker-faqs')).not.toBeNull();

        // CTA link
        const ctaLink = root!.querySelector('.c-tool-article__cta-row a');
        expect(ctaLink).not.toBeNull();
        expect(ctaLink!.getAttribute('href')).toBe(SITE_BASE_URL);

        // Diff algorithm package link
        const diffPkgLink = root!.querySelector('section[aria-labelledby="diff-checker-features"] a[href*="npmjs.com/package/diff"]');
        expect(diffPkgLink).not.toBeNull();

        // Feedback link
        const feedbackLink = root!.querySelector('section[aria-labelledby="diff-checker-feedback"] a');
        expect(feedbackLink).not.toBeNull();
        expect(feedbackLink!.getAttribute('href')).toContain('contact');

        // Screenshot figure
        const figureImg = root!.querySelector('figure.c-tool-article__figure img');
        expect(figureImg).not.toBeNull();
        expect(figureImg!.getAttribute('src')).toContain('diff-result-view-example.webp');

        // Rendered FAQs count
        const renderedFaqQuestions = root!.querySelectorAll('.c-tool-faq__item');
        expect(renderedFaqQuestions.length).toBe(FAQ_ITEMS.length);
    });
});
