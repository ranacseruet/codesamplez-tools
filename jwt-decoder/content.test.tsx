import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { render } from 'preact';
import { SITE_BASE_URL } from '../common/siteBaseUrl';
import { JWT_BEST_PRACTICES, JWT_CRASH_COURSE } from '../common/tool-article/tutorial-links';
import {
    BROWSER_DECODE_SNIPPET,
    FAQ_ITEMS,
    JwtDecoderIntro,
    JwtDecoderArticle,
    NODE_DECODE_SNIPPET,
    PYTHON_DECODE_SNIPPET,
    WORKED_EXAMPLE_DECODED_JSON,
    WORKED_EXAMPLE_EXP_UTC,
    WORKED_EXAMPLE_HEADER,
    WORKED_EXAMPLE_IAT_UTC,
    WORKED_EXAMPLE_NBF_UTC,
    WORKED_EXAMPLE_PAYLOAD,
    WORKED_EXAMPLE_SECRET,
    WORKED_EXAMPLE_TOKEN,
    WORKED_EXAMPLE_VALIDITY_BEFORE_NBF
} from './content';

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
        expect(root!.querySelector('#jwt-decoder-worked-example')).not.toBeNull();
        expect(root!.querySelector('#jwt-decoder-decode-in-code')).not.toBeNull();
        expect(root!.querySelector('#jwt-decoder-claims')).not.toBeNull();
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

        const articleText = root!.textContent || '';
        expect(articleText).toContain(WORKED_EXAMPLE_TOKEN);
        expect(articleText).toContain(WORKED_EXAMPLE_DECODED_JSON);
        expect(articleText).toContain(WORKED_EXAMPLE_SECRET);
        expect(articleText).toContain(WORKED_EXAMPLE_EXP_UTC);
        expect(articleText).toContain(WORKED_EXAMPLE_IAT_UTC);
        expect(articleText).toContain(WORKED_EXAMPLE_NBF_UTC);
        expect(articleText).toContain(WORKED_EXAMPLE_VALIDITY_BEFORE_NBF);
        expect(articleText).toContain(BROWSER_DECODE_SNIPPET);
        expect(articleText).toContain(NODE_DECODE_SNIPPET);
        expect(articleText).toContain(PYTHON_DECODE_SNIPPET);
        expect(articleText).toContain('This reads the JSON with atob and TextDecoder. It does not verify the signature.');
        expect(articleText).toContain('Buffer reads the JSON. It does not verify the signature.');
        expect(articleText).toContain('This reads the claims with base64 and padding. It does not verify the signature.');
        expect(articleText).toContain('⚠️ Decoded successfully. Signature verification is only supported for HS256 (token uses RS256).');
        expect(articleText).toContain('⚠️ Decoded successfully. Signature verification is only supported for HS256 (token uses ES256).');
        expect(articleText).toContain('This page does not verify RS256 or ES256.');
        expect(articleText).not.toContain('Base64-encoded secret');

        const workedExampleLink = root!.querySelector('section[aria-labelledby="jwt-decoder-worked-example"] a[href*="jwt-builder"]');
        expect(workedExampleLink).not.toBeNull();

        const crashCourseLinks = root!.querySelectorAll(`a[href="${JWT_CRASH_COURSE.href}"]`);
        const bestPracticesLink = root!.querySelector(`a[href="${JWT_BEST_PRACTICES.href}"]`);
        expect(crashCourseLinks.length).toBeGreaterThan(0);
        expect(bestPracticesLink).not.toBeNull();
        expect(bestPracticesLink!.textContent).toBe(JWT_BEST_PRACTICES.anchor);

        const source = fs.readFileSync(path.join(__dirname, 'content.tsx'), 'utf8');
        expect(source).not.toContain(JWT_CRASH_COURSE.path);
        expect(source).not.toContain(JWT_BEST_PRACTICES.path);

        const questions = Array.from(root!.querySelectorAll('.c-tool-faq__question')).map((node) => node.textContent);
        expect(questions).toEqual(expect.arrayContaining([
            'Is it safe to paste my JWT here?',
            'Why does my token decode but fail verification?',
            'How do I decode a JWT without a library?'
        ]));
    });

    it('runs the published decode snippets on the worked example', () => {
        const browser = new Function(
            'token',
            'atob',
            'TextDecoder',
            'Uint8Array',
            `${BROWSER_DECODE_SNIPPET}\nreturn { header, payload };`
        )(WORKED_EXAMPLE_TOKEN, atob, TextDecoder, Uint8Array) as {
            header: typeof WORKED_EXAMPLE_HEADER;
            payload: typeof WORKED_EXAMPLE_PAYLOAD;
        };
        expect(browser.header).toEqual(WORKED_EXAMPLE_HEADER);
        expect(browser.payload).toEqual(WORKED_EXAMPLE_PAYLOAD);

        const nodeResult = new Function(
            'token',
            'Buffer',
            `${NODE_DECODE_SNIPPET}\nreturn { header, payload };`
        )(WORKED_EXAMPLE_TOKEN, Buffer) as {
            header: typeof WORKED_EXAMPLE_HEADER;
            payload: typeof WORKED_EXAMPLE_PAYLOAD;
        };
        expect(nodeResult).toEqual(browser);

        const python = spawnSync('python3', ['-c', `
import json
token = ${JSON.stringify(WORKED_EXAMPLE_TOKEN)}
${PYTHON_DECODE_SNIPPET}
print(json.dumps({"header": header, "payload": payload}, separators=(",", ":")))
`], { encoding: 'utf8' });
        expect(python.status).toBe(0);
        expect(JSON.parse(python.stdout)).toEqual({
            header: WORKED_EXAMPLE_HEADER,
            payload: WORKED_EXAMPLE_PAYLOAD
        });
    });
});
