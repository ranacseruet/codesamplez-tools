import { render } from 'preact';
import { FAQ_ITEMS, JwtBuilderIntro, JwtBuilderArticle } from './content';
import { SITE_BASE_URL } from '../common/siteBaseUrl';

describe('jwt-builder content', () => {
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

        render(<JwtBuilderIntro />, root!);

        const heading = root!.querySelector('#jwt-builder-intro-heading');
        expect(heading).not.toBeNull();
        expect(heading!.textContent).toBe('About This Tool');

        const lead = root!.querySelector('.c-tool-article__lead');
        expect(lead).not.toBeNull();
        expect(lead!.textContent).toContain('JWT Generator is a free browser-based tool');
    });

    it('renders the article with structured guide sections, links, claims, and FAQs', () => {
        document.body.innerHTML = '<div id="test-article"></div>';
        const root = document.getElementById('test-article');

        render(<JwtBuilderArticle />, root!);

        expect(root!.querySelector('#jwt-builder-what-is-it')).not.toBeNull();
        expect(root!.querySelector('#jwt-builder-supported-features')).not.toBeNull();
        expect(root!.querySelector('#jwt-builder-how-to-use')).not.toBeNull();
        expect(root!.querySelector('#jwt-builder-standard-claims')).not.toBeNull();
        expect(root!.querySelector('#jwt-builder-error-handling')).not.toBeNull();
        expect(root!.querySelector('#jwt-builder-security')).not.toBeNull();
        expect(root!.querySelector('#jwt-builder-browser-compatibility')).not.toBeNull();
        expect(root!.querySelector('#jwt-builder-technical-details')).not.toBeNull();
        expect(root!.querySelector('#jwt-builder-feedback')).not.toBeNull();
        expect(root!.querySelector('#jwt-builder-faqs')).not.toBeNull();

        // CTA link
        const ctaLink = root!.querySelector('.c-tool-article__cta-row a');
        expect(ctaLink).not.toBeNull();
        expect(ctaLink!.getAttribute('href')).toBe(SITE_BASE_URL);

        // JWT decoder link
        const decoderLink = root!.querySelector('section[aria-labelledby="jwt-builder-what-is-it"] a[href*="jwt-decoder"]');
        expect(decoderLink).not.toBeNull();

        // Feedback link
        const feedbackLink = root!.querySelector('section[aria-labelledby="jwt-builder-feedback"] a');
        expect(feedbackLink).not.toBeNull();
        expect(feedbackLink!.getAttribute('href')).toContain('contact');

        // Rendered FAQs count
        const renderedFaqQuestions = root!.querySelectorAll('.c-tool-faq__item');
        expect(renderedFaqQuestions.length).toBe(FAQ_ITEMS.length);
    });
});
