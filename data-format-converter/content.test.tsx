import { render } from 'preact';
import { FAQ_ITEMS, DataFormatConverterIntro, DataFormatConverterArticle } from './content';
import { SITE_BASE_URL } from '../common/siteBaseUrl';

describe('data-format-converter content', () => {
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

        render(<DataFormatConverterIntro />, root!);

        const heading = root!.querySelector('#data-format-converter-intro-heading');
        expect(heading).not.toBeNull();
        expect(heading!.textContent).toBe('About This Tool');

        const lead = root!.querySelector('.c-tool-article__lead');
        expect(lead).not.toBeNull();
        expect(lead!.textContent).toContain('Online Data Format Converter Tool');
    });

    it('renders the article with structured guide sections, links, and FAQs', () => {
        document.body.innerHTML = '<div id="test-article"></div>';
        const root = document.getElementById('test-article');

        render(<DataFormatConverterArticle />, root!);

        expect(root!.querySelector('#data-format-converter-features')).not.toBeNull();
        expect(root!.querySelector('#data-format-converter-usage')).not.toBeNull();
        expect(root!.querySelector('#data-format-converter-technology')).not.toBeNull();
        expect(root!.querySelector('#data-format-converter-limitations')).not.toBeNull();
        expect(root!.querySelector('#data-format-converter-future')).not.toBeNull();
        expect(root!.querySelector('#data-format-converter-privacy')).not.toBeNull();
        expect(root!.querySelector('#data-format-converter-troubleshooting')).not.toBeNull();
        expect(root!.querySelector('#data-format-converter-feedback')).not.toBeNull();
        expect(root!.querySelector('#data-format-converter-faqs')).not.toBeNull();

        const brandLinks = root!.querySelectorAll(`a[href="${SITE_BASE_URL}"]`);
        expect(brandLinks.length).toBeGreaterThan(0);

        const renderedFaqQuestions = root!.querySelectorAll('.c-tool-faq__item');
        expect(renderedFaqQuestions.length).toBe(FAQ_ITEMS.length);
    });
});
