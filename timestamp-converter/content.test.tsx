import { spawnSync } from 'node:child_process';
import { render } from 'preact';
import {
    FAQ_ITEMS,
    JAVASCRIPT_TIMESTAMP_SNIPPET,
    PYTHON_TIMESTAMP_SNIPPET,
    SHELL_TIMESTAMP_SNIPPET,
    SQL_TIMESTAMP_SNIPPET,
    TimestampConverterArticle,
    TimestampConverterIntro,
    WORKED_EXAMPLE,
    WORKED_EXAMPLE_EPOCH,
    WORKED_EXAMPLE_FROM_DATE,
    WORKED_EXAMPLE_MS,
    WORKED_EXAMPLE_NS,
    WORKED_EXAMPLE_REPORT
} from './content';

describe('timestamp converter content', () => {
    it('locks the worked example to the converter', () => {
        expect(WORKED_EXAMPLE.iso8601).toBe('2023-11-14T22:13:20.000Z');
        expect(WORKED_EXAMPLE.rfc2822).toBe('Tue, 14 Nov 2023 22:13:20 GMT');
        expect(WORKED_EXAMPLE.utc).toBe('2023-11-14 22:13:20.000 UTC+00:00');
        expect(WORKED_EXAMPLE.zoned).toBe('2023-11-14 17:13:20.000 UTC-05:00');
        expect(WORKED_EXAMPLE.local).toBe('2023-11-14 16:13:20.000 UTC-06:00');
        expect(WORKED_EXAMPLE.relative).toBe('2 hours ago');
        expect(WORKED_EXAMPLE_MS.iso8601).toBe('2023-11-14T22:13:20.123Z');
        expect(WORKED_EXAMPLE_NS.iso8601).toBe('2023-11-14T22:13:20.123456789Z');
        expect(WORKED_EXAMPLE_FROM_DATE.unixSeconds).toBe(WORKED_EXAMPLE_EPOCH);
        expect(WORKED_EXAMPLE_REPORT).toContain('Detected unit: seconds');
        expect(JAVASCRIPT_TIMESTAMP_SNIPPET).toContain('new Date(seconds * 1000).toISOString()');
        expect(JAVASCRIPT_TIMESTAMP_SNIPPET).toContain(WORKED_EXAMPLE_EPOCH);
        expect(PYTHON_TIMESTAMP_SNIPPET).toContain('datetime.fromtimestamp');
        expect(PYTHON_TIMESTAMP_SNIPPET).toContain('timezone.utc');
        expect(SQL_TIMESTAMP_SNIPPET).toContain('to_timestamp(1700000000)');
        expect(SQL_TIMESTAMP_SNIPPET).toContain('EXTRACT(EPOCH FROM');
        expect(SHELL_TIMESTAMP_SNIPPET).toContain('date -u -d @1700000000');
        expect(SHELL_TIMESTAMP_SNIPPET).toContain('date -u -r 1700000000');
    });

    it('runs the JavaScript, Python, and GNU date snippets on the worked example', () => {
        const javascript = new Function(
            `${JAVASCRIPT_TIMESTAMP_SNIPPET}\nreturn { iso, epoch };`
        )() as { iso: string, epoch: number };
        expect(javascript.iso).toBe(WORKED_EXAMPLE.iso8601);
        expect(javascript.epoch).toBe(Number(WORKED_EXAMPLE_EPOCH));

        const python = spawnSync('python3', ['-c', PYTHON_TIMESTAMP_SNIPPET], { encoding: 'utf8' });
        expect(python.status).toBe(0);
        expect(python.stdout).toBe('2023-11-14T22:13:20+00:00\n1700000000\n');

        const shell = spawnSync('bash', ['-c', SHELL_TIMESTAMP_SNIPPET], { encoding: 'utf8' });
        expect(shell.status).toBe(0);
        expect(shell.stdout).toBe('2023-11-14T22:13:20Z\n1700000000\n');
    });

    it('keeps every FAQ answer self-contained', () => {
        expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(7);
        expect(FAQ_ITEMS.map((item) => item.question)).toEqual(expect.arrayContaining([
            'How does this page choose seconds, milliseconds, microseconds, or nanoseconds?',
            'How do JWT exp, iat, and nbf relate to Unix time?',
            'Does this page upload the timestamp I paste?',
            'What happens during daylight saving time?'
        ]));

        FAQ_ITEMS.forEach((item) => {
            expect(item.question.trim().length).toBeGreaterThan(0);
            expect(item.structuredDataAnswer.trim().length).toBeGreaterThan(0);
            if (typeof item.answer === 'string') {
                expect(item.answer).toBe(item.structuredDataAnswer);
            }
        });

        const questions = FAQ_ITEMS.map((item) => item.question.trim().toLowerCase());
        expect(new Set(questions).size).toBe(questions.length);
        const upload = FAQ_ITEMS.find((item) => item.question === 'Does this page upload the timestamp I paste?');
        expect(upload?.structuredDataAnswer).toContain('tool_used');
        expect(upload?.structuredDataAnswer).not.toContain('1700000000');
        const units = FAQ_ITEMS.find((item) => item.question.startsWith('How does this page choose'));
        expect(units?.structuredDataAnswer).toContain('1 to 10 digits are seconds');
        expect(units?.structuredDataAnswer).toContain('17 to 19 are nanoseconds');
    });

    it('renders the intro and the guide, including the worked timestamp and no Learn more block', () => {
        document.body.innerHTML = '<div id="intro"></div><div id="article"></div>';
        render(<TimestampConverterIntro />, document.getElementById('intro')!);
        render(<TimestampConverterArticle />, document.getElementById('article')!);

        expect(document.querySelector('#timestamp-converter-intro-heading')!.textContent).toBe('About This Tool');
        expect(document.querySelector('.c-tool-article__lead')!.textContent).toContain('Unix timestamp');

        const article = document.getElementById('article')!;
        expect(article.querySelector('#timestamp-converter-what-is')).not.toBeNull();
        expect(article.querySelector('#timestamp-converter-example')).not.toBeNull();
        expect(article.querySelector('#timestamp-converter-how-to')).not.toBeNull();
        expect(article.querySelector('#timestamp-converter-in-code')).not.toBeNull();
        expect(article.querySelector('#timestamp-converter-zones')).not.toBeNull();
        expect(article.querySelector('#timestamp-converter-related')).not.toBeNull();
        expect(article.querySelector('#timestamp-converter-faqs')).not.toBeNull();
        expect(article.textContent).toContain(WORKED_EXAMPLE_EPOCH);
        expect(article.textContent).toContain('2023-11-14T22:13:20.000Z');
        expect(article.textContent).toContain('2023-11-14T22:13:20.123456789Z');
        expect(article.textContent).toContain('date -u -d @1700000000');
        expect(article.textContent).toContain('to_timestamp(1700000000)');
        expect(article.querySelector('.c-tool-tutorial__link')).toBeNull();

        const related = article.querySelector('#timestamp-converter-related')!.closest('section')!;
        const hrefs = [...related.querySelectorAll('a')].map((link) => link.getAttribute('href'));
        expect(hrefs.some((href) => href && href.includes('/jwt-decoder/'))).toBe(true);
        expect(hrefs.some((href) => href && href.includes('/jwt-builder/'))).toBe(true);
        expect(hrefs.some((href) => href && href.includes('/uuid-generator/'))).toBe(true);

        const renderedFaqs = article.querySelectorAll('.c-tool-faq__item');
        expect(renderedFaqs.length).toBe(FAQ_ITEMS.length);
        expect(article.textContent).toContain('Unix Timestamp Converter FAQs');
        expect(article.querySelector('.c-tool-faq__answer a[href*="/jwt-decoder/"]')).not.toBeNull();
    });
});
