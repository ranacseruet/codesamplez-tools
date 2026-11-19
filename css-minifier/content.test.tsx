import { render } from 'preact';
import { FAQ_ITEMS, CSS_MINIFY_EXAMPLE, CSS_MINIFY_EXAMPLE_INPUT, CssMinifierIntro, CssMinifierArticle } from './content';
import { minifyCSS } from './minifier';
import { formatBytes } from '../common/format-utils';

/** Locked to the string minifyCSS returns for CSS_MINIFY_EXAMPLE_INPUT today. */
const LOCKED_MINIFIED_CSS = '.card{margin:0;padding:16px;color:#fff;width:calc(100% - 24px)}@media (max-width:600px){.card{padding:12px}}';

describe('css-minifier content', () => {
    it('keeps every FAQ answer self-contained and in parity with its structured-data answer', () => {
        expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(7);
        expect(FAQ_ITEMS.map((item) => item.question)).toEqual(expect.arrayContaining([
            'How much does CSS minification reduce file size?',
            'Can minifying CSS break my site?',
            'Should I minify CSS and JS together?'
        ]));

        FAQ_ITEMS.forEach((item) => {
            expect(typeof item.question).toBe('string');
            expect(item.question.trim().length).toBeGreaterThan(0);
            expect(typeof item.structuredDataAnswer).toBe('string');
            expect(item.structuredDataAnswer.trim().length).toBeGreaterThan(0);
            if (typeof item.answer === 'string') {
                expect(item.answer).toBe(item.structuredDataAnswer);
            }
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
        expect(root!.querySelector('#css-minifier-example')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-how-to-test')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-features')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-error-handling')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-security')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-browser-compatibility')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-limitations')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-related-tool')).not.toBeNull();
        expect(root!.querySelector('#css-minifier-faqs')).not.toBeNull();
        expect(root!.querySelector('.c-tool-tutorial__link')).toBeNull();

        const relatedLink = root!.querySelector('section[aria-labelledby="css-minifier-related-tool"] a');
        expect(relatedLink).not.toBeNull();
        expect(relatedLink!.getAttribute('href')).toContain('/js-minifier/');

        const renderedFaqQuestions = root!.querySelectorAll('.c-tool-faq__item');
        expect(renderedFaqQuestions.length).toBe(FAQ_ITEMS.length);
        renderedFaqQuestions.forEach((item, index) => {
            expect(item.querySelector('.c-tool-faq__question')!.textContent).toBe(FAQ_ITEMS[index].question);
            expect(item.querySelector('.c-tool-faq__answer')!.textContent).toBe(FAQ_ITEMS[index].structuredDataAnswer);
        });

        const faqSection = root!.querySelector('#css-minifier-faqs')!.closest('section')!;
        const jsMinifierFaqLink = faqSection.querySelector('a[href*="/js-minifier/"]');
        expect(jsMinifierFaqLink).not.toBeNull();
        expect(jsMinifierFaqLink!.textContent).toBe('JavaScript Minifier');
    });

    it('locks the before-and-after example to the string the minifier returns', () => {
        const source = CSS_MINIFY_EXAMPLE_INPUT.trim();
        const output = minifyCSS(source);
        const originalBytes = new Blob([source]).size;
        const minifiedBytes = new Blob([output]).size;

        expect(output).toBe(LOCKED_MINIFIED_CSS);
        expect(CSS_MINIFY_EXAMPLE.output).toBe(LOCKED_MINIFIED_CSS);
        expect(CSS_MINIFY_EXAMPLE.input).toBe(CSS_MINIFY_EXAMPLE_INPUT);
        expect(originalBytes).toBe(178);
        expect(minifiedBytes).toBe(108);
        expect(CSS_MINIFY_EXAMPLE.originalBytes).toBe(178);
        expect(CSS_MINIFY_EXAMPLE.minifiedBytes).toBe(108);
        expect(CSS_MINIFY_EXAMPLE.originalSizeLabel).toBe(formatBytes(178));
        expect(CSS_MINIFY_EXAMPLE.minifiedSizeLabel).toBe(formatBytes(108));
        expect(CSS_MINIFY_EXAMPLE.originalSizeLabel).toBe('178 B');
        expect(CSS_MINIFY_EXAMPLE.minifiedSizeLabel).toBe('108 B');
        expect(CSS_MINIFY_EXAMPLE.savingsLabel).toBe('39.3%');
        expect(output.indexOf('.card{margin:0;')).toBeLessThan(output.indexOf('@media'));
        expect(output).toContain('calc(100% - 24px)');

        document.body.innerHTML = '<div id="test-example"></div>';
        const root = document.getElementById('test-example');
        render(<CssMinifierArticle />, root!);

        const example = root!.querySelector('#css-minifier-example')!.closest('section')!;
        const codes = example.querySelectorAll('pre code');
        expect(example.textContent).toContain('CSS Minification Example (Before and After)');
        expect(codes[0].textContent).toBe(CSS_MINIFY_EXAMPLE_INPUT);
        expect(codes[1].textContent).toBe(LOCKED_MINIFIED_CSS);
        expect(example.textContent).toContain('178 B');
        expect(example.textContent).toContain('108 B');
        expect(example.textContent).toContain('39.3%');
        expect(example.textContent).toContain('178 bytes');
        expect(example.textContent).toContain('108 bytes');

        const howToTest = root!.querySelector('#css-minifier-how-to-test')!.closest('section')!;
        expect(howToTest.textContent).toContain('How to Test Your Minified CSS');
        expect(howToTest.textContent).toContain('Compare the file size');
        expect(howToTest.textContent).toContain('Run the output through validation');
        expect(howToTest.textContent).toContain('Invalid CSS input. Please check your CSS syntax.');
        expect(howToTest.textContent).toContain('Check that the page renders the same');
        expect(howToTest.textContent).toContain('Watch the edge cases this tool keeps');
        expect(howToTest.textContent).toContain('calc(100% - 24px)');
        expect(howToTest.textContent).toContain('@media');
    });
});
