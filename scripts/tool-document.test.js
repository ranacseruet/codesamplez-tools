/** @jest-environment node */

const { generateToolDocument, joinUrl, renderToolDocument } = require('./tool-document.js');
const { getToolById } = require('./tool-manifest');

describe('tool document generation', () => {
    it('joins urls without dropping nested paths', () => {
        expect(joinUrl('https://tools.codesamplez.com', '/json-formatter-tool/'))
            .toBe('https://tools.codesamplez.com/json-formatter-tool/');
        expect(joinUrl('https://tools.codesamplez.com/', 'text-analyzer-tool/images/featured.png'))
            .toBe('https://tools.codesamplez.com/text-analyzer-tool/images/featured.png');
    });

    it('renders a module tool document with metadata and shell placeholders', () => {
        const tool = getToolById('diff-checker-tool');
        const html = renderToolDocument(tool, '<section>SSR payload</section>', '<section class="c-related-tools">Related</section>');

        expect(html).toContain('<title>Diff Checker</title>');
        expect(html).toContain('<meta name="description" content="Compare two texts or code snippets and highlight the differences between them.">');
        expect(html).toContain('<link rel="canonical" href="https://tools.codesamplez.com/diff-checker-tool/">');
        expect(html).toContain('<meta property="og:image" content="https://tools.codesamplez.com/diff-checker-tool/images/featured.png">');
        expect(html).toContain('<div id="app-shell-header"></div>');
        expect(html).toContain('<div id="diff-checker-app"><section>SSR payload</section></div>');
        expect(html).toContain('<section class="c-related-tools">Related</section>');
        expect(html).toContain('<script src="bundle.main.js" type="module"></script>');
    });

    it('renders a classic-script document for qr-code-generator', () => {
        const html = generateToolDocument('qr-code-generator');

        expect(html).toContain('<title>QR Code Generator</title>');
        expect(html).toContain('<div id="qr-code-generator-app">');
        expect(html).toContain('<script src="bundle.main.js"></script>');
        expect(html).not.toContain('<script src="bundle.main.js" type="module"></script>');
    });

    it('renders prerendered markup for a representative module tool', () => {
        const html = generateToolDocument('base64-converter-tool');

        expect(html).toContain('id="base64converter-mode"');
        expect(html).toContain('id="base64converter-convert"');
        expect(html).toContain('id="related-tools-heading"');
        expect(html).toContain('Related tools');
        expect(html).toContain('href="/jwt-decoder-tool/"');
        expect(html).toContain('https://tools.codesamplez.com/base64-converter-tool/images/featured.png');
    });
});
