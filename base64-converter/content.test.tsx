import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { render } from 'preact';
import Base64Codec from '../common/Base64Codec';
import { buildSiteHref } from '../common/siteBaseUrl';
import { BASE64_EXPLAINED } from '../common/tool-article/tutorial-links';
import {
    BROWSER_BASE64_SNIPPET,
    CLI_BASE64_SNIPPET,
    FAQ_ITEMS,
    NODE_BASE64_SNIPPET,
    PYTHON_BASE64_SNIPPET,
    WINDOWS_CERTUTIL_SNIPPET,
    WORKED_EXAMPLE_ASCII,
    WORKED_EXAMPLE_ASCII_ENCODED,
    WORKED_EXAMPLE_URL_SAFE,
    WORKED_EXAMPLE_URL_STANDARD,
    WORKED_EXAMPLE_URL_TEXT,
    WORKED_EXAMPLE_UTF8,
    WORKED_EXAMPLE_UTF8_ASCII_ENCODING,
    WORKED_EXAMPLE_UTF8_ENCODED,
    Base64ConverterArticle,
    Base64ConverterIntro
} from './content';

/**
 * Locked to the strings Base64Codec returns today for the worked-example
 * inputs. These are the Output values the converter writes; do not edit
 * them to match a hand-written encoding.
 */
const LOCKED_ASCII = 'SGVsbG8=';
const LOCKED_UTF8 = 'SGVsbG8g8J+MjQ==';
const LOCKED_UTF8_ASCII_OPTION = 'SGVsbG8gPw==';
const LOCKED_URL_STANDARD = 'SGVsbG9+fg==';
const LOCKED_URL_SAFE = 'SGVsbG9-fg';

describe('base64-converter content', () => {
    const codec = new Base64Codec();

    it('locks the worked example to the string the converter writes', () => {
        expect(codec.isBase64(WORKED_EXAMPLE_ASCII)).toBe(false);
        expect(codec.encodeText(WORKED_EXAMPLE_ASCII, 'utf8')).toBe(LOCKED_ASCII);
        expect(codec.decodeText(LOCKED_ASCII, 'utf8')).toBe(WORKED_EXAMPLE_ASCII);
        expect(WORKED_EXAMPLE_ASCII_ENCODED).toBe(LOCKED_ASCII);

        expect(codec.isBase64(WORKED_EXAMPLE_UTF8)).toBe(false);
        expect(codec.encodeText(WORKED_EXAMPLE_UTF8, 'utf8')).toBe(LOCKED_UTF8);
        expect(codec.decodeText(LOCKED_UTF8, 'utf8')).toBe(WORKED_EXAMPLE_UTF8);
        expect(WORKED_EXAMPLE_UTF8_ENCODED).toBe(LOCKED_UTF8);
        expect(() => btoa(WORKED_EXAMPLE_UTF8)).toThrow(expect.objectContaining({
            name: 'InvalidCharacterError'
        }));

        expect(codec.encodeText(WORKED_EXAMPLE_UTF8, 'ascii')).toBe(LOCKED_UTF8_ASCII_OPTION);
        expect(codec.decodeText(LOCKED_UTF8_ASCII_OPTION, 'utf8')).toBe('Hello ?');
        expect(WORKED_EXAMPLE_UTF8_ASCII_ENCODING).toBe(LOCKED_UTF8_ASCII_OPTION);

        expect(codec.isBase64(WORKED_EXAMPLE_URL_TEXT)).toBe(false);
        expect(codec.encodeText(WORKED_EXAMPLE_URL_TEXT, 'utf8')).toBe(LOCKED_URL_STANDARD);
        expect(codec.base64ToBase64Url(LOCKED_URL_STANDARD)).toBe(LOCKED_URL_SAFE);
        expect(codec.isBase64(LOCKED_URL_SAFE)).toBe(true);
        expect(codec.decodeText(LOCKED_URL_SAFE, 'utf8')).toBe(WORKED_EXAMPLE_URL_TEXT);
        expect(codec.decodeText(LOCKED_URL_STANDARD, 'utf8')).toBe(WORKED_EXAMPLE_URL_TEXT);
        expect(WORKED_EXAMPLE_URL_STANDARD).toBe(LOCKED_URL_STANDARD);
        expect(WORKED_EXAMPLE_URL_SAFE).toBe(LOCKED_URL_SAFE);
    });

    it('runs the published encode and decode snippets on the worked example', () => {
        const browser = new Function(
            'btoa',
            'atob',
            'TextEncoder',
            'TextDecoder',
            'Uint8Array',
            `${BROWSER_BASE64_SNIPPET}\nreturn { encodeUtf8, decodeUtf8 };`
        )(btoa, atob, TextEncoder, TextDecoder, Uint8Array) as {
            encodeUtf8: (text: string) => string;
            decodeUtf8: (payload: string) => string;
        };
        expect(browser.encodeUtf8(WORKED_EXAMPLE_ASCII)).toBe(LOCKED_ASCII);
        expect(browser.decodeUtf8(LOCKED_ASCII)).toBe(WORKED_EXAMPLE_ASCII);
        expect(browser.encodeUtf8(WORKED_EXAMPLE_UTF8)).toBe(LOCKED_UTF8);
        expect(browser.decodeUtf8(LOCKED_UTF8)).toBe(WORKED_EXAMPLE_UTF8);

        const nodeApi = new Function(
            'Buffer',
            `${NODE_BASE64_SNIPPET}\nreturn { encodeUtf8, decodeUtf8 };`
        )(Buffer) as {
            encodeUtf8: (text: string) => string;
            decodeUtf8: (payload: string) => string;
        };
        expect(nodeApi.encodeUtf8(WORKED_EXAMPLE_ASCII)).toBe(LOCKED_ASCII);
        expect(nodeApi.decodeUtf8(LOCKED_ASCII)).toBe(WORKED_EXAMPLE_ASCII);
        expect(nodeApi.encodeUtf8(WORKED_EXAMPLE_UTF8)).toBe(LOCKED_UTF8);
        expect(nodeApi.decodeUtf8(LOCKED_UTF8)).toBe(WORKED_EXAMPLE_UTF8);

        const python = spawnSync('python3', ['-c', `
import json
${PYTHON_BASE64_SNIPPET}
ascii_text = ${JSON.stringify(WORKED_EXAMPLE_ASCII)}
utf8_text = ${JSON.stringify(WORKED_EXAMPLE_UTF8)}
print(json.dumps({
    "ascii": encode_utf8(ascii_text),
    "ascii_back": decode_utf8(encode_utf8(ascii_text)),
    "utf8": encode_utf8(utf8_text),
    "utf8_back": decode_utf8(encode_utf8(utf8_text))
}))
`], { encoding: 'utf8' });
        expect(python.status).toBe(0);
        expect(JSON.parse(python.stdout)).toEqual({
            ascii: LOCKED_ASCII,
            ascii_back: WORKED_EXAMPLE_ASCII,
            utf8: LOCKED_UTF8,
            utf8_back: WORKED_EXAMPLE_UTF8
        });

        const cli = spawnSync('bash', ['-lc', CLI_BASE64_SNIPPET], { encoding: 'utf8' });
        expect(cli.status).toBe(0);
        expect(cli.stdout).toBe(`${LOCKED_ASCII}\n${LOCKED_UTF8}\n${WORKED_EXAMPLE_ASCII}`);
    });

    it('keeps every FAQ answer self-contained and in parity with its structured-data answer', () => {
        expect(FAQ_ITEMS).toHaveLength(7);
        expect(FAQ_ITEMS.map((item) => item.question)).toEqual(expect.arrayContaining([
            'How do I decode Base64 online?',
            'Why does my decoded text look garbled?',
            'Is Base64 encryption?',
            'How do I convert an image to Base64?'
        ]));

        FAQ_ITEMS.forEach((item) => {
            expect(typeof item.question).toBe('string');
            expect(item.question.trim().length).toBeGreaterThan(0);
            expect(typeof item.structuredDataAnswer).toBe('string');
            expect(item.structuredDataAnswer.trim().length).toBeGreaterThan(0);
            expect(item.answer).toBe(item.structuredDataAnswer);
        });

        const questions = FAQ_ITEMS.map((item) => item.question.trim().toLowerCase());
        expect(new Set(questions).size).toBe(questions.length);
    });

    it('renders the worked example, code snippets, Base64URL, and data URI sections', () => {
        document.body.innerHTML = '<div id="test-article"></div>';
        const root = document.getElementById('test-article');
        render(<Base64ConverterIntro />, root!);
        expect(root!.querySelector('#base64-converter-intro-heading')!.textContent).toBe('About This Tool');

        document.body.innerHTML = '<div id="test-article"></div>';
        const articleRoot = document.getElementById('test-article');
        render(<Base64ConverterArticle />, articleRoot!);

        const example = articleRoot!.querySelector('#base64-converter-worked-example')!.closest('section')!;
        const codes = example.querySelectorAll('pre code');
        expect(codes[0].textContent).toBe(WORKED_EXAMPLE_ASCII);
        expect(codes[1].textContent).toBe(LOCKED_ASCII);
        expect(codes[2].textContent).toBe(WORKED_EXAMPLE_UTF8);
        expect(codes[3].textContent).toBe(LOCKED_UTF8);
        expect(example.textContent).toContain(LOCKED_UTF8_ASCII_OPTION);
        expect(example.textContent).toContain('Hello ?');
        expect(example.textContent).toContain('InvalidCharacterError');

        const inCode = articleRoot!.querySelector('#base64-converter-in-code')!.closest('section')!;
        expect(inCode.textContent).toContain(BROWSER_BASE64_SNIPPET);
        expect(inCode.textContent).toContain(NODE_BASE64_SNIPPET);
        expect(inCode.textContent).toContain(PYTHON_BASE64_SNIPPET);
        expect(inCode.textContent).toContain(CLI_BASE64_SNIPPET);
        expect(inCode.textContent).toContain(WINDOWS_CERTUTIL_SNIPPET);
        expect(inCode.textContent).toContain('base64 -d');
        expect(inCode.textContent).toContain('certutil -encode');
        expect(inCode.textContent).toContain('-----BEGIN CERTIFICATE-----');

        const urlSection = articleRoot!.querySelector('#base64-converter-base64url')!.closest('section')!;
        expect(urlSection.textContent).toContain(LOCKED_URL_STANDARD);
        expect(urlSection.textContent).toContain(LOCKED_URL_SAFE);
        expect(urlSection.textContent).toContain(WORKED_EXAMPLE_URL_TEXT);
        const jwtLink = urlSection.querySelector('a[href*="/jwt-decoder/"]');
        expect(jwtLink).not.toBeNull();
        expect(jwtLink!.textContent).toBe('JWT Decoder');
        expect(jwtLink!.getAttribute('href')).toBe(buildSiteHref('/jwt-decoder/'));
        const tutorialLink = urlSection.querySelector(`a[href="${BASE64_EXPLAINED.href}"]`);
        expect(tutorialLink).not.toBeNull();
        expect(tutorialLink!.textContent).toBe(BASE64_EXPLAINED.anchor);

        const dataUri = articleRoot!.querySelector('#base64-converter-data-uri')!.closest('section')!;
        expect(dataUri.textContent).toContain('data:image/png;base64,');
        expect(dataUri.textContent).toContain('[File: name uploaded and encoded to output]');
        expect(dataUri.textContent).toContain('Preview skipped: file is larger than 15 MB.');
        expect(dataUri.textContent).toContain('limit 25 MB');
        expect(dataUri.textContent).toContain('output.png');
        expect(dataUri.textContent).toContain('SVG is never previewed');
        expect(dataUri.textContent).toContain('Image preview unavailable. Use Download button.');

        const renderedFaqs = articleRoot!.querySelectorAll('.c-tool-faq__item');
        expect(renderedFaqs.length).toBe(FAQ_ITEMS.length);

        const source = fs.readFileSync(path.join(__dirname, 'content.tsx'), 'utf8');
        expect(source).not.toContain(BASE64_EXPLAINED.path);
        expect(source).not.toContain('https://codesamplez.com/programming/base64-explained');
    });
});
