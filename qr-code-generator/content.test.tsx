import { render } from 'preact';
import { FAQ_ITEMS, QRCodeGeneratorIntro, QRCodeGeneratorArticle } from './content';

describe('qr-code-generator content', () => {
    it('keeps every FAQ answer self-contained and in parity with its structured-data answer', () => {
        expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(8);

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

        render(<QRCodeGeneratorIntro />, root!);

        const heading = root!.querySelector('#qr-code-generator-intro-heading');
        expect(heading).not.toBeNull();
        expect(heading!.textContent).toBe('About This Tool');

        const lead = root!.querySelector('.c-tool-article__lead');
        expect(lead).not.toBeNull();
        expect(lead!.textContent).toContain('CodeSamplez QR Code Generator');
    });

    it('renders the article with structured guide sections and FAQs', () => {
        document.body.innerHTML = '<div id="test-article"></div>';
        const root = document.getElementById('test-article');

        render(<QRCodeGeneratorArticle />, root!);

        expect(root!.querySelector('#how-to-generate-qr-code')).not.toBeNull();
        expect(root!.querySelector('#qr-code-generator-features')).not.toBeNull();
        expect(root!.querySelector('#qr-code-generator-privacy')).not.toBeNull();
        expect(root!.querySelector('#qr-code-generator-faqs')).not.toBeNull();

        const renderedFaqQuestions = root!.querySelectorAll('.c-tool-faq__item');
        expect(renderedFaqQuestions.length).toBe(FAQ_ITEMS.length);
    });
});
