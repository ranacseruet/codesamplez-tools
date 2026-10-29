import fs from 'node:fs';
import path from 'node:path';
import { render } from 'preact';
import { SITE_BASE_URL } from '../common/siteBaseUrl';
import { JWT_BEST_PRACTICES, JWT_CRASH_COURSE } from '../common/tool-article/tutorial-links';
import {
    FAQ_ITEMS,
    JwtBuilderIntro,
    JwtBuilderArticle,
    NODE_JWT_SNIPPET,
    PHP_JWT_SNIPPET,
    PYTHON_JWT_SNIPPET,
    WORKED_EXAMPLE_HEADER_JSON,
    WORKED_EXAMPLE_PAYLOAD,
    WORKED_EXAMPLE_SECRET,
    WORKED_EXAMPLE_TOKEN
} from './content';

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
        expect(lead!.textContent).toContain('Tool input is processed locally and is not uploaded.');
    });

    it('renders the article with structured guide sections, links, claims, and FAQs', () => {
        document.body.innerHTML = '<div id="test-article"></div>';
        const root = document.getElementById('test-article');

        render(<JwtBuilderArticle />, root!);

        expect(root!.querySelector('#jwt-builder-what-is-it')).not.toBeNull();
        expect(root!.querySelector('#jwt-builder-supported-features')).not.toBeNull();
        expect(root!.querySelector('#jwt-builder-how-to-use')).not.toBeNull();
        expect(root!.querySelector('#jwt-builder-worked-example')).not.toBeNull();
        expect(root!.querySelector('#jwt-builder-code-snippets')).not.toBeNull();
        expect(root!.querySelector('#jwt-builder-choosing-claims')).not.toBeNull();
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

        const articleText = root!.textContent || '';
        expect(articleText).toContain(WORKED_EXAMPLE_TOKEN);
        expect(articleText).toContain(WORKED_EXAMPLE_HEADER_JSON);
        expect(articleText).toContain(JSON.stringify(WORKED_EXAMPLE_PAYLOAD));
        expect(articleText).toContain(NODE_JWT_SNIPPET);
        expect(articleText).toContain(PYTHON_JWT_SNIPPET);
        expect(articleText).toContain(PHP_JWT_SNIPPET);
        expect(articleText).toContain(WORKED_EXAMPLE_SECRET);

        const crashCourseLink = root!.querySelector(`a[href="${JWT_CRASH_COURSE.href}"]`);
        const bestPracticesLink = root!.querySelector(`a[href="${JWT_BEST_PRACTICES.href}"]`);
        expect(crashCourseLink).not.toBeNull();
        expect(crashCourseLink!.textContent).toBe(JWT_CRASH_COURSE.anchor);
        expect(bestPracticesLink).not.toBeNull();
        expect(bestPracticesLink!.textContent).toBe(JWT_BEST_PRACTICES.anchor);

        const source = fs.readFileSync(path.join(__dirname, 'content.tsx'), 'utf8');
        expect(source).not.toContain(JWT_CRASH_COURSE.path);
        expect(source).not.toContain(JWT_BEST_PRACTICES.path);

        const questions = Array.from(root!.querySelectorAll('.c-tool-faq__question')).map((node) => node.textContent);
        expect(questions).toEqual(expect.arrayContaining([
            'How do I create a JWT token online?',
            'Is it safe to generate a JWT in the browser?',
            'What shared-secret length should I use for HS256?',
            'How do I set an expiration when I create a JWT token?'
        ]));
    });
});
