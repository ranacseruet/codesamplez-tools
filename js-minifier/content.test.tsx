import { render } from 'preact';
import { FAQ_ITEMS, JS_MINIFY_EXAMPLE, JS_MINIFY_EXAMPLE_INPUT, JSMinifierIntro, JSMinifierArticle } from './content';
import { SITE_BASE_URL, buildSiteHref } from '../common/siteBaseUrl';
import { formatBytes } from '../common/format-utils';
import { JSMinifier } from './minifier';

/** Locked to the string JSMinifier.minify returns for JS_MINIFY_EXAMPLE_INPUT today. */
const LOCKED_MINIFIED_JS = 'function calculateSum(a){let b=0;for(let c=0;c<a.length;c++){b=b+a[c]}return b}const myNumbers=[1,2,3,4,5];const result=calculateSum(myNumbers);console.log("The sum is: "+result);';

const LOCKED_PROPERTY_MANGLE = 'const user={a:"John",b:"Doe"};console.log(user.a+" "+user.b);';

describe('js-minifier content', () => {
    it('keeps every FAQ answer self-contained and in parity with its structured-data answer', () => {
        expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(8);
        expect(FAQ_ITEMS.map((item) => item.question)).toEqual(expect.arrayContaining([
            'How much can JS minification reduce file size?',
            'Is minifying JavaScript the same as gzip compression?',
            'Can I use this as a general code minifier for CSS or JSON?'
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
        expect(root!.querySelector('#js-minifier-how-to-test')).not.toBeNull();
        expect(root!.querySelector('#js-minifier-minify-vs-compress')).not.toBeNull();
        expect(root!.querySelector('#js-minifier-advanced-options')).not.toBeNull();
        expect(root!.querySelector('.c-tool-tutorial__link')).toBeNull();
        expect(root!.querySelector('#js-minifier-limitations')).not.toBeNull();
        expect(root!.querySelector('#js-minifier-best-practices')).not.toBeNull();
        expect(root!.querySelector('#js-minifier-privacy')).not.toBeNull();
        expect(root!.querySelector('#js-minifier-feedback')).not.toBeNull();
        expect(root!.querySelector('#js-minifier-faqs')).not.toBeNull();

        // CTA link points to site root / developer tools
        const ctaLink = root!.querySelector('section[aria-labelledby="js-minifier-why"] .c-tool-article__cta-row a');
        expect(ctaLink).not.toBeNull();
        expect(ctaLink!.getAttribute('href')).toBe(SITE_BASE_URL);

        // Feedback link points to contact page
        const feedbackLink = root!.querySelector('section[aria-labelledby="js-minifier-feedback"] a');
        expect(feedbackLink).not.toBeNull();
        expect(feedbackLink!.getAttribute('href')).toContain('contact');

        // All FAQ items are rendered
        const renderedFaqQuestions = root!.querySelectorAll('.c-tool-faq__item');
        expect(renderedFaqQuestions.length).toBe(FAQ_ITEMS.length);
        renderedFaqQuestions.forEach((item, index) => {
            expect(item.querySelector('.c-tool-faq__question')!.textContent).toBe(FAQ_ITEMS[index].question);
            expect(item.querySelector('.c-tool-faq__answer')!.textContent).toBe(FAQ_ITEMS[index].structuredDataAnswer);
        });

        const faqSection = root!.querySelector('#js-minifier-faqs')!.closest('section')!;
        const cssMinifierFaqLink = faqSection.querySelector('a[href*="/css-minifier/"]');
        const jsonFormatterFaqLink = faqSection.querySelector('a[href*="/json-formatter/"]');
        expect(cssMinifierFaqLink).not.toBeNull();
        expect(cssMinifierFaqLink!.textContent).toBe('CSS Minifier');
        expect(cssMinifierFaqLink!.getAttribute('href')).toBe(buildSiteHref('/css-minifier/'));
        expect(jsonFormatterFaqLink).not.toBeNull();
        expect(jsonFormatterFaqLink!.textContent).toBe('JSON Formatter');
        expect(jsonFormatterFaqLink!.getAttribute('href')).toBe(buildSiteHref('/json-formatter/'));
    });

    it('locks the before-and-after example to the string the minifier returns', () => {
        const output = new JSMinifier({
            removeComments: true,
            removeWhitespace: true,
            shortenVariables: true,
            mangleProperties: false
        }).minify(JS_MINIFY_EXAMPLE_INPUT);
        const propertyOutput = new JSMinifier({
            removeComments: true,
            removeWhitespace: true,
            shortenVariables: false,
            mangleProperties: true
        }).minify(`const user = { firstName: "John", lastName: "Doe" };
console.log(user.firstName + " " + user.lastName);`);
        const originalBytes = new Blob([JS_MINIFY_EXAMPLE_INPUT]).size;
        const minifiedBytes = new Blob([output]).size;

        expect(output).toBe(LOCKED_MINIFIED_JS);
        expect(propertyOutput).toBe(LOCKED_PROPERTY_MANGLE);
        expect(JS_MINIFY_EXAMPLE.output).toBe(LOCKED_MINIFIED_JS);
        expect(JS_MINIFY_EXAMPLE.input).toBe(JS_MINIFY_EXAMPLE_INPUT);
        expect(originalBytes).toBe(412);
        expect(minifiedBytes).toBe(179);
        expect(JS_MINIFY_EXAMPLE.originalBytes).toBe(412);
        expect(JS_MINIFY_EXAMPLE.minifiedBytes).toBe(179);
        expect(JS_MINIFY_EXAMPLE.originalSizeLabel).toBe(formatBytes(412));
        expect(JS_MINIFY_EXAMPLE.minifiedSizeLabel).toBe(formatBytes(179));
        expect(JS_MINIFY_EXAMPLE.originalSizeLabel).toBe('412 B');
        expect(JS_MINIFY_EXAMPLE.minifiedSizeLabel).toBe('179 B');
        expect(JS_MINIFY_EXAMPLE.ratioLabel).toBe('56.55%');
        expect(output).toContain('function calculateSum(a)');
        expect(output).toContain('const myNumbers=');
        expect(output).toContain('const result=');

        document.body.innerHTML = '<div id="test-example"></div>';
        const root = document.getElementById('test-example');
        render(<JSMinifierArticle />, root!);

        const example = root!.querySelector('#js-minifier-example')!.closest('section')!;
        const codes = example.querySelectorAll('pre code');
        expect(example.textContent).toContain('JavaScript Minification Example');
        expect(codes[0].textContent).toBe(JS_MINIFY_EXAMPLE_INPUT);
        expect(codes[1].textContent).toBe(LOCKED_MINIFIED_JS);
        expect(example.textContent).toContain('412 B');
        expect(example.textContent).toContain('179 B');
        expect(example.textContent).toContain('56.55%');
        expect(example.textContent).toContain('412 bytes');
        expect(example.textContent).toContain('179 bytes');

        const howToTest = root!.querySelector('#js-minifier-how-to-test')!.closest('section')!;
        expect(howToTest.textContent).toContain('How to Test Your Minified JavaScript');
        expect(howToTest.textContent).toContain('Compare the file size');
        expect(howToTest.textContent).toContain('Run the project tests, or a quick smoke test');
        expect(howToTest.textContent).toContain('Check the browser console');
        expect(howToTest.textContent).toContain('Invalid JavaScript syntax:');
        expect(howToTest.textContent).toContain('Watch what the options change');
        expect(howToTest.textContent).toContain('Shorten variable names');
        expect(howToTest.textContent).toContain('Mangle properties');
        expect(howToTest.textContent).toContain('top-level await');
        expect(howToTest.textContent).toContain('does not produce a source map');

        const compare = root!.querySelector('#js-minifier-minify-vs-compress')!.closest('section')!;
        expect(compare.textContent).toContain('Minify vs. Compress (gzip/Brotli) vs. Obfuscate');
        expect(compare.textContent).toContain('gzip');
        expect(compare.textContent).toContain('Brotli');
        expect(compare.textContent).toContain('not obfuscation');
        expect(compare.textContent).toContain('56.55%');

        const advanced = root!.querySelector('#js-minifier-advanced-options')!.closest('section')!;
        expect(advanced.textContent).toContain(LOCKED_PROPERTY_MANGLE);
    });
});
