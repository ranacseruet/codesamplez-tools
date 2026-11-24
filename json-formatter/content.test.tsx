import { render } from 'preact';
import { autoFixJSON, formatJson, locateJsonError } from './json-format-core';
import {
    FAQ_ITEMS,
    FEATURE_LIST,
    HOWTO_STEPS,
    JsonFormatterArticle,
    JsonFormatterIntro,
    VALIDATE_JSON_EXAMPLE_COLUMN,
    VALIDATE_JSON_EXAMPLE_ERROR_MESSAGE,
    VALIDATE_JSON_EXAMPLE_GO_TO_ERROR,
    VALIDATE_JSON_EXAMPLE_INPUT,
    VALIDATE_JSON_EXAMPLE_LINE,
    VALIDATE_JSON_EXAMPLE_OUTPUT,
    VALIDATE_JSON_EXAMPLE_STATUS
} from './content';

/**
 * Locked to what locateJsonError and formatJson return for the trailing-comma
 * snippet today. Do not edit these to match a hand-written error string.
 */
const LOCKED_VALIDATE_INPUT = '{\n  "name": "Ada",\n}';
const LOCKED_VALIDATE_MESSAGE = 'Expected double-quoted property name in JSON at position 19 (line 3 column 1)';
const LOCKED_VALIDATE_LINE = 3;
const LOCKED_VALIDATE_COLUMN = 1;
const LOCKED_VALIDATE_STATUS = `Invalid JSON: ${LOCKED_VALIDATE_MESSAGE}`;
const LOCKED_VALIDATE_GO_TO_ERROR = 'Go to error (line 3, col 1)';
/** autoFixJSON eats the comma and the whitespace before the brace. Pretty-print restores the newline. */
const LOCKED_VALIDATE_AUTO_FIXED = '{\n  "name": "Ada"}';
const LOCKED_VALIDATE_OUTPUT = '{\n  "name": "Ada"\n}';

describe('json-formatter content', () => {
    it('expands the FAQ set into the 10-12 question-query range required for AEO', () => {
        expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(10);
        expect(FAQ_ITEMS.length).toBeLessThanOrEqual(12);
    });

    it('keeps every FAQ answer self-contained and in parity with its structured-data answer', () => {
        const safetyAnswer = FAQ_ITEMS.find((item) => item.question === 'Is an online JSON formatter safe to use?');
        expect(safetyAnswer?.answer).toBe(
            'Yes. JSON you paste into this formatter is processed locally in the browser and is not uploaded.'
        );

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
            expect.stringContaining('trailing comma'),
            'How do I check if JSON is valid?'
        ]));
    });

    it('locks the Validate JSON online example to the formatter', () => {
        expect(VALIDATE_JSON_EXAMPLE_INPUT).toBe(LOCKED_VALIDATE_INPUT);
        const located = locateJsonError(VALIDATE_JSON_EXAMPLE_INPUT, false);
        expect(located).toEqual({
            message: LOCKED_VALIDATE_MESSAGE,
            index: 19,
            line: LOCKED_VALIDATE_LINE,
            column: LOCKED_VALIDATE_COLUMN
        });
        expect(VALIDATE_JSON_EXAMPLE_INPUT[located!.index]).toBe('}');
        expect(VALIDATE_JSON_EXAMPLE_ERROR_MESSAGE).toBe(LOCKED_VALIDATE_MESSAGE);
        expect(VALIDATE_JSON_EXAMPLE_LINE).toBe(LOCKED_VALIDATE_LINE);
        expect(VALIDATE_JSON_EXAMPLE_COLUMN).toBe(LOCKED_VALIDATE_COLUMN);
        expect(VALIDATE_JSON_EXAMPLE_STATUS).toBe(LOCKED_VALIDATE_STATUS);
        expect(VALIDATE_JSON_EXAMPLE_GO_TO_ERROR).toBe(LOCKED_VALIDATE_GO_TO_ERROR);
        expect(locateJsonError(VALIDATE_JSON_EXAMPLE_INPUT, true)).toBeNull();
        expect(autoFixJSON(VALIDATE_JSON_EXAMPLE_INPUT)).toBe(LOCKED_VALIDATE_AUTO_FIXED);
        expect(() => formatJson({
            input: VALIDATE_JSON_EXAMPLE_INPUT,
            autoFix: false,
            sortKeys: true,
            indent: 2
        })).toThrow(LOCKED_VALIDATE_MESSAGE);

        const repaired = formatJson({
            input: VALIDATE_JSON_EXAMPLE_INPUT,
            autoFix: true,
            sortKeys: true,
            indent: 2
        });
        expect(repaired.formattedString).toBe(LOCKED_VALIDATE_OUTPUT);
        expect(VALIDATE_JSON_EXAMPLE_OUTPUT).toBe(LOCKED_VALIDATE_OUTPUT);
        expect(formatJson({
            input: VALIDATE_JSON_EXAMPLE_INPUT,
            autoFix: true,
            sortKeys: false,
            indent: 2
        }).formattedString).toBe(LOCKED_VALIDATE_OUTPUT);
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

    it('exposes non-empty HowTo steps and feature list for structured data', () => {
        expect(HOWTO_STEPS.length).toBeGreaterThan(0);
        HOWTO_STEPS.forEach((step) => {
            expect(step.name.length).toBeGreaterThan(0);
            expect(step.text.length).toBeGreaterThan(0);
        });

        expect(FEATURE_LIST.length).toBeGreaterThan(0);
        FEATURE_LIST.forEach((feature) => {
            expect(typeof feature).toBe('string');
            expect(feature.length).toBeGreaterThan(0);
        });
    });

    it('renders the step-by-step how-to section from HOWTO_STEPS', () => {
        document.body.innerHTML = '<div id="test-root"></div>';
        const root = document.getElementById('test-root');

        render(<JsonFormatterArticle />, root);

        const howToSection = root.querySelector('#json-formatter-how-to-use').closest('section');
        const stepHeadings = Array.from(howToSection.querySelectorAll('li strong'))
            .map((node) => node.textContent);
        expect(stepHeadings).toEqual(HOWTO_STEPS.map((step) => step.name));
    });

    it('renders the Validate JSON online section from the locked example', () => {
        document.body.innerHTML = '<div id="test-root"></div>';
        const root = document.getElementById('test-root');

        render(<JsonFormatterArticle />, root);

        const section = root.querySelector('#json-formatter-validate').closest('section');
        expect(section.querySelector('h2').textContent).toBe('Validate JSON online');
        const codes = Array.from(section.querySelectorAll('pre code')).map((node) => node.textContent);
        expect(codes).toEqual([
            LOCKED_VALIDATE_INPUT,
            LOCKED_VALIDATE_STATUS,
            LOCKED_VALIDATE_GO_TO_ERROR,
            LOCKED_VALIDATE_OUTPUT
        ]);
        expect(section.textContent).toContain(`line ${LOCKED_VALIDATE_LINE}`);
        expect(section.textContent).toContain(`column ${LOCKED_VALIDATE_COLUMN}`);
        expect(section.textContent).toContain('closing brace');
        expect(section.textContent).toContain('Auto fix starts checked');
        expect(section.textContent).toContain('removes that trailing comma');
        expect(section.textContent).toContain('does not reorder this one-key object');
        expect(section.textContent).toContain('single-quoted strings');
        expect(section.textContent).toContain('unquoted keys');
        expect(section.textContent).toContain('does not repair every syntax error');
        expect(section.textContent).toContain('Draft 7 or Draft 2020-12');
        expect(section.textContent).toContain('Format & Validate');
        expect(section.textContent).toContain('original text as strict JSON');
        expect(section.textContent).toContain('not run until the source is valid JSON');
        expect(section.textContent).toContain('Go to error stays hidden when the message has no position');

        const questions = Array.from(root.querySelectorAll('.c-tool-faq__item')).map((node) => node.textContent);
        expect(questions.some((text) => text.includes('How do I check if JSON is valid?'))).toBe(true);
        expect(new Set(FAQ_ITEMS.map((item) => item.question)).size).toBe(FAQ_ITEMS.length);
    });
});
