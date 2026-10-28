/** @jest-environment node */

const { generateToolDocument } = require('./tool-document');
const { getTutorialLinksForTool } = require('../common/tool-article/tutorial-links');

const MAPPED_TOOLS = [
    {
        manifestId: 'jwt-decoder-tool',
        slug: 'jwt-decoder',
        faqQuestion: 'Is it safe to decode JWTs using an online tool?'
    },
    {
        manifestId: 'jwt-builder-tool',
        slug: 'jwt-builder',
        faqQuestion: 'Is this JWT generator free to use?'
    },
    {
        manifestId: 'json-formatter-tool',
        slug: 'json-formatter',
        faqQuestion: 'What is a JSON Formatter?'
    },
    {
        manifestId: 'json-editor-tool',
        slug: 'json-editor',
        faqQuestion: 'What is a JSON Editor?',
        faqInStructuredData: false
    },
    {
        manifestId: 'data-format-converter',
        slug: 'data-format-converter',
        faqQuestion: 'What file formats can your tool convert between?'
    },
    {
        manifestId: 'base64-converter-tool',
        slug: 'base64-converter',
        faqQuestion: 'Is Base64 encoding secure?'
    },
    {
        manifestId: 'diff-checker-tool',
        slug: 'diff-checker',
        faqQuestion: 'How do I compare two code files online?'
    }
];

const UNMAPPED_MANIFEST_IDS = [
    'qr-code-generator',
    'text-analyzer-tool',
    'image-editor',
    'css-minifier-tool',
    'js-minifier-tool'
];

function tutorialAnchors(html) {
    return [...html.matchAll(/<a\b([^>]*)class="c-tool-tutorial__link"([^>]*)>([^<]*)<\/a>/g)].map((match) => {
        const attributes = `${match[1]} ${match[2]}`;
        const href = /href="([^"]*)"/.exec(attributes);
        const path = /data-tutorial-path="([^"]*)"/.exec(attributes);
        const target = /\btarget=/.exec(attributes);
        const rel = /\brel=/.exec(attributes);
        const nofollow = /nofollow/.exec(attributes);

        return {
            href: href ? href[1] : null,
            path: path ? path[1] : null,
            anchor: match[3],
            target,
            rel,
            nofollow
        };
    });
}

describe('prerendered tutorial links', () => {
    it('puts each mapped tool\'s Learn more links in the HTML and keeps its FAQs in structured data', () => {
        MAPPED_TOOLS.forEach((tool) => {
            const html = generateToolDocument(tool.manifestId);
            const links = tutorialAnchors(html);
            const expected = getTutorialLinksForTool(tool.slug);

            expect(html).toContain(`id="${tool.slug}-tutorials"`);
            expect(html).toContain('Learn more');
            expect(links.map((link) => link.href)).toEqual(expected.map((link) => link.href));
            expect(links.map((link) => link.path)).toEqual(expected.map((link) => link.path));
            expect(links.map((link) => link.anchor)).toEqual(expected.map((link) => link.anchor));
            links.forEach((link) => {
                expect(link.target).toBeNull();
                expect(link.rel).toBeNull();
                expect(link.nofollow).toBeNull();
            });

            expect(html).toContain(tool.faqQuestion);

            if (tool.faqInStructuredData === false) {
                expect(html).not.toContain('"@type":"FAQPage"');
            } else {
                expect(html).toContain('"@type":"FAQPage"');
                expect(html).toContain(`"name":"${tool.faqQuestion}"`);
            }
        });
    });

    it('omits the Learn more block on tools with no tutorial match', () => {
        UNMAPPED_MANIFEST_IDS.forEach((manifestId) => {
            const html = generateToolDocument(manifestId);
            expect(html).not.toContain('c-tool-tutorial__link');
            expect(html).toContain('"@type":"FAQPage"');
        });
    });

    it('points the existing Base64 guide sentence at the canonical tutorial, not the AMP URL', () => {
        const html = generateToolDocument('base64-converter-tool');
        expect(html).toContain('href="https://codesamplez.com/programming/base64-explained"');
        expect(html).not.toContain('base64-explained/amp');
    });
});
