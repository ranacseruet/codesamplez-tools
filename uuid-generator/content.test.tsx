import { render } from 'preact';
import {
    COLLISION_ODDS,
    FAQ_ITEMS,
    JAVASCRIPT_UUID_SNIPPET,
    PYTHON_UUID_SNIPPET,
    SQL_UUID_SNIPPET,
    WORKED_EXAMPLE_V4,
    WORKED_EXAMPLE_V4_CANONICAL_FROM_PLAIN,
    WORKED_EXAMPLE_V4_UPPER_PLAIN,
    WORKED_EXAMPLE_V4_VARIANT,
    WORKED_EXAMPLE_V4_VERSION,
    WORKED_EXAMPLE_V7,
    WORKED_EXAMPLE_V7_TIMESTAMP_ISO,
    WORKED_EXAMPLE_V7_TIMESTAMP_MS,
    WORKED_EXAMPLE_V7_VARIANT,
    WORKED_EXAMPLE_V7_VERSION,
    UuidGeneratorArticle,
    UuidGeneratorIntro
} from './content';
import { describeV4CollisionOdds, parseUuid } from './uuid';

const LOCKED_V4 = '123e4567-89ab-4cde-8f01-23456789abcd';
const LOCKED_V4_UPPER_PLAIN = '123E456789AB4CDE8F0123456789ABCD';
const LOCKED_V7 = '01a20e25-f3d0-7abc-9122-334455667788';

describe('uuid generator content', () => {
    it('locks the worked example to the generator and the parser', () => {
        expect(WORKED_EXAMPLE_V4).toBe(LOCKED_V4);
        expect(WORKED_EXAMPLE_V4_UPPER_PLAIN).toBe(LOCKED_V4_UPPER_PLAIN);
        expect(WORKED_EXAMPLE_V7).toBe(LOCKED_V7);
        expect(WORKED_EXAMPLE_V4_VERSION).toBe('4 (random)');
        expect(WORKED_EXAMPLE_V4_VARIANT).toBe('RFC 4122');
        expect(WORKED_EXAMPLE_V7_VERSION).toBe('7 (time-ordered)');
        expect(WORKED_EXAMPLE_V7_VARIANT).toBe('RFC 4122');
        expect(WORKED_EXAMPLE_V7_TIMESTAMP_MS).toBe(Date.UTC(2026, 10, 24, 15, 21, 38));
        expect(WORKED_EXAMPLE_V7_TIMESTAMP_ISO).toBe('2026-11-24T15:21:38.000Z');
        expect(WORKED_EXAMPLE_V4_CANONICAL_FROM_PLAIN).toBe(LOCKED_V4);

        const parsedV7 = parseUuid(WORKED_EXAMPLE_V7);
        expect(parsedV7.valid && parsedV7.timestampIso).toBe(WORKED_EXAMPLE_V7_TIMESTAMP_ISO);
        expect(COLLISION_ODDS).toBe(describeV4CollisionOdds());
        expect(JAVASCRIPT_UUID_SNIPPET).toContain('crypto.randomUUID()');
        expect(JAVASCRIPT_UUID_SNIPPET).toContain('crypto.getRandomValues(bytes)');
        expect(JAVASCRIPT_UUID_SNIPPET).toContain('| 0x70');
        expect(JAVASCRIPT_UUID_SNIPPET).not.toContain('randomUUID() // version 7');
        expect(PYTHON_UUID_SNIPPET).toContain('uuid.uuid4()');
        expect(PYTHON_UUID_SNIPPET).toContain('uuid.uuid7()');
        expect(SQL_UUID_SNIPPET).toContain('gen_random_uuid()');
        expect(SQL_UUID_SNIPPET).toContain('uuidv7()');
    });

    it('keeps every FAQ answer self-contained', () => {
        expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(7);
        expect(FAQ_ITEMS.map((item) => item.question)).toEqual(expect.arrayContaining([
            'What is the difference between UUID v4 and v7?',
            'How likely is a UUID collision?',
            'Does this page upload the UUIDs I generate or paste?',
            'How many UUIDs can I generate at once?'
        ]));

        FAQ_ITEMS.forEach((item) => {
            expect(item.question.trim().length).toBeGreaterThan(0);
            expect(item.structuredDataAnswer.trim().length).toBeGreaterThan(0);
            expect(item.structuredDataAnswer).toContain(item.question.includes('collision') ? '122 random bits' : '');
            if (typeof item.answer === 'string') {
                expect(item.answer).toBe(item.structuredDataAnswer);
            }
        });

        const questions = FAQ_ITEMS.map((item) => item.question.trim().toLowerCase());
        expect(new Set(questions).size).toBe(questions.length);
        const collision = FAQ_ITEMS.find((item) => item.question === 'How likely is a UUID collision?');
        expect(collision?.structuredDataAnswer).toBe(COLLISION_ODDS);
        const bulk = FAQ_ITEMS.find((item) => item.question === 'How many UUIDs can I generate at once?');
        expect(bulk?.structuredDataAnswer).toContain('1 to 100');
    });

    it('renders the intro and the guide, including the worked UUIDs and no Learn more block', () => {
        document.body.innerHTML = '<div id="intro"></div><div id="article"></div>';
        render(<UuidGeneratorIntro />, document.getElementById('intro')!);
        render(<UuidGeneratorArticle />, document.getElementById('article')!);

        expect(document.querySelector('#uuid-generator-intro-heading')!.textContent).toBe('About This Tool');
        expect(document.querySelector('.c-tool-article__lead')!.textContent).toContain('version 4 or version 7');

        const article = document.getElementById('article')!;
        expect(article.querySelector('#uuid-generator-what-is')).not.toBeNull();
        expect(article.querySelector('#uuid-generator-v4-vs-v7')).not.toBeNull();
        expect(article.querySelector('#uuid-generator-example')).not.toBeNull();
        expect(article.querySelector('#uuid-generator-how-to')).not.toBeNull();
        expect(article.querySelector('#uuid-generator-in-code')).not.toBeNull();
        expect(article.querySelector('#uuid-generator-collisions')).not.toBeNull();
        expect(article.querySelector('#uuid-generator-related')).not.toBeNull();
        expect(article.querySelector('#uuid-generator-faqs')).not.toBeNull();
        expect(article.textContent).toContain(LOCKED_V4);
        expect(article.textContent).toContain(LOCKED_V4_UPPER_PLAIN);
        expect(article.textContent).toContain(LOCKED_V7);
        expect(article.textContent).toContain('2026-11-24T15:21:38.000Z');
        expect(article.textContent).toContain(COLLISION_ODDS);
        expect(article.textContent).toContain('crypto.randomUUID()');
        expect(article.textContent).toContain('uuid.uuid7()');
        expect(article.textContent).toContain('uuidv7()');
        expect(article.querySelector('.c-tool-tutorial__link')).toBeNull();

        const related = article.querySelector('#uuid-generator-related')!.closest('section')!;
        const hrefs = [...related.querySelectorAll('a')].map((link) => link.getAttribute('href'));
        expect(hrefs.some((href) => href && href.includes('/jwt-builder/'))).toBe(true);
        expect(hrefs.some((href) => href && href.includes('/base64-converter/'))).toBe(true);

        const renderedFaqs = article.querySelectorAll('.c-tool-faq__item');
        expect(renderedFaqs.length).toBe(FAQ_ITEMS.length);
        expect(article.textContent).toContain('UUID Generator FAQs');
    });
});
