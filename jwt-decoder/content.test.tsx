import { render } from 'preact';
import { FAQ_ITEMS, JwtDecoderIntro, JwtDecoderArticle } from './content';
import { SITE_BASE_URL } from '../common/siteBaseUrl';

describe('jwt-decoder content', () => {
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

        render(<JwtDecoderIntro />, root!);

        const heading = root!.querySelector('#jwt-decoder-intro-heading');
        expect(heading).not.toBeNull();
        expect(heading!.textContent).toBe('About This Tool');

        const lead = root!.querySelector('.c-tool-article__lead');
        expect(lead).not.toBeNull();
        expect(lead!.textContent).toContain('Need to decode a JWT token quickly?');
    });

    it('renders the article with structured guide sections, links, features, and FAQs', () => {
        document.body.innerHTML = '<div id="test-article"></div>';
        const root = document.getElementById('test-article');

        render(<JwtDecoderArticle />, root!);

        expect(root!.querySelector('#jwt-decoder-what-is-jwt')).not.toBeNull();
        expect(root!.querySelector('#jwt-decoder-features')).not.toBeNull();
        expect(root!.querySelector('#jwt-decoder-how-to-decode')).not.toBeNull();
        expect(root!.querySelector('#jwt-decoder-how-to-verify')).not.toBeNull();
        expect(root!.querySelector('#jwt-decoder-technical-details')).not.toBeNull();
        expect(root!.querySelector('#jwt-decoder-browser-compatibility')).not.toBeNull();
        expect(root!.querySelector('#jwt-decoder-security')).not.toBeNull();
        expect(root!.querySelector('#jwt-decoder-feedback')).not.toBeNull();
        expect(root!.querySelector('#jwt-decoder-faqs')).not.toBeNull();

        // CTA link
        const ctaLink = root!.querySelector('.c-tool-article__cta-row a');
        expect(ctaLink).not.toBeNull();
        expect(ctaLink!.getAttribute('href')).toBe(SITE_BASE_URL);

        // Crash course link
        const courseLink = root!.querySelector('section[aria-labelledby="jwt-decoder-what-is-jwt"] a[href*="crash-course"]');
        expect(courseLink).not.toBeNull();

        // JWT builder link
        const builderLink = root!.querySelector('section[aria-labelledby="jwt-decoder-how-to-verify"] a[href*="jwt-builder"]');
        expect(builderLink).not.toBeNull();

        // Feedback link
        const feedbackLink = root!.querySelector('section[aria-labelledby="jwt-decoder-feedback"] a');
        expect(feedbackLink).not.toBeNull();
        expect(feedbackLink!.getAttribute('href')).toContain('contact');

        // Rendered FAQs count
        const renderedFaqQuestions = root!.querySelectorAll('.c-tool-faq__item');
        expect(renderedFaqQuestions.length).toBe(FAQ_ITEMS.length);
    });
});
