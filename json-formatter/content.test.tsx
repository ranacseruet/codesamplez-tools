import { render } from 'preact';
import { FAQ_ITEMS, JsonFormatterIntro } from './content';

describe('json-formatter content', () => {
    it('expands the FAQ set into the 10-12 question-query range required for AEO', () => {
        expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(10);
        expect(FAQ_ITEMS.length).toBeLessThanOrEqual(12);
    });

    it('keeps every FAQ answer self-contained and in parity with its structured-data answer', () => {
        FAQ_ITEMS.forEach((item) => {
            expect(typeof item.question).toBe('string');
            expect(item.question.length).toBeGreaterThan(0);
            expect(item.answer).toBe(item.structuredDataAnswer);
            expect(String(item.answer).length).toBeGreaterThan(0);
        });
    });

    it('covers the question-query targets called out in the issue', () => {
        const questions = FAQ_ITEMS.map((item) => item.question);

        expect(questions).toEqual(expect.arrayContaining([
            expect.stringContaining('Unexpected token'),
            expect.stringContaining('JSON5'),
            expect.stringContaining('API keys or secrets'),
            expect.stringContaining('VS Code'),
            expect.stringContaining('minify'),
            expect.stringContaining('trailing comma')
        ]));
    });

    it('has no duplicate questions', () => {
        const questions = FAQ_ITEMS.map((item) => item.question);
        expect(new Set(questions).size).toBe(questions.length);
    });

    it('renders an answer capsule with a direct definition at the top of the intro', () => {
        document.body.innerHTML = '<div id="test-root"></div>';
        const root = document.getElementById('test-root');

        render(<JsonFormatterIntro />, root);

        const leadParagraphs = root.querySelectorAll('.c-tool-article__lead');
        expect(leadParagraphs.length).toBeGreaterThanOrEqual(1);
        expect(leadParagraphs[0].textContent).toContain('A JSON formatter is a tool that');
        expect(leadParagraphs[0].textContent).toContain('Use one whenever you need to');
    });
});
