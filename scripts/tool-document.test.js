/** @jest-environment node */

const { generateToolDocument, joinUrl, renderToolDocument } = require('./tool-document.js');
const { getToolById } = require('./tool-manifest');

function withEnv(overrides, run) {
    const originalEnv = { ...process.env };

    Object.keys(overrides).forEach((key) => {
        const value = overrides[key];
        if (typeof value === 'undefined') {
            delete process.env[key];
            return;
        }

        process.env[key] = value;
    });

    try {
        return run();
    } finally {
        process.env = originalEnv;
    }
}

describe('tool document generation', () => {
    it('joins urls without dropping nested paths', () => {
        expect(joinUrl('https://codesamplez.com/tools', '/json-formatter/'))
            .toBe('https://codesamplez.com/tools/json-formatter/');
        expect(joinUrl('https://codesamplez.com/tools/', 'text-analyzer/images/featured.png'))
            .toBe('https://codesamplez.com/tools/text-analyzer/images/featured.png');
    });

    it('renders a module tool document with metadata and shell placeholders', () => {
        const tool = getToolById('diff-checker-tool');
        const html = renderToolDocument(tool, '<section>SSR payload</section>', '<section class="c-related-tools">Related</section>');

        expect(html).toContain('<title>Diff Checker</title>');
        expect(html).toContain('<meta name="description" content="Compare two texts or code snippets and highlight the differences between them.">');
        expect(html).toContain('<link rel="canonical" href="https://codesamplez.com/tools/diff-checker/">');
        expect(html).toContain('<meta property="og:image" content="https://codesamplez.com/tools/diff-checker/images/featured.png">');
        expect(html).toContain('<script type="application/ld+json">');
        expect(html).toContain('"@type":"WebPage"');
        expect(html).toContain('"@type":"WebApplication"');
        expect(html).not.toContain('"@type":"BreadcrumbList"');
        expect(html).not.toContain('"breadcrumb"');
        expect(html).toContain('"operatingSystem":"Any"');
        expect(html).toContain('"price":"0"');
        expect(html).toContain('"priceCurrency":"USD"');
        expect(html).toContain('"url":"https://codesamplez.com/tools/diff-checker/"');
        expect(html).toContain('"image":"https://codesamplez.com/tools/diff-checker/images/featured.png"');
        expect(html).not.toContain('"@type":"FAQPage"');
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

    it('renders FAQPage structured data for qr-code-generator', () => {
        const html = generateToolDocument('qr-code-generator');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"What is a QR code?"');
        expect(html).toContain('"name":"Can I customize my QR code with this tool?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"A QR code, short for Quick Response code, is a two-dimensional barcode');
        expect(html).toContain('"isPartOf":{"@id":"https://codesamplez.com/tools/qr-code-generator/#webpage"}');
    });

    it('renders FAQPage structured data for data-format-converter', () => {
        const html = generateToolDocument('data-format-converter');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"Does the tool support batch conversion?"');
        expect(html).toContain('"name":"How secure is the online converter?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"Currently, our data format conversion tool focuses on single-file conversions');
        expect(html).toContain('"isPartOf":{"@id":"https://codesamplez.com/tools/data-format-converter/#webpage"}');
    });

    it('renders FAQPage structured data for js-minifier', () => {
        const html = generateToolDocument('js-minifier-tool');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"What is JavaScript minification and why is it important?"');
        expect(html).toContain('"name":"Is minification the same as obfuscation?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"JavaScript minification is the process of compressing code by removing unnecessary characters like spaces, line breaks, and comments');
        expect(html).toContain('"isPartOf":{"@id":"https://codesamplez.com/tools/js-minifier/#webpage"}');
    });

    it('renders FAQPage structured data for css-minifier', () => {
        const html = generateToolDocument('css-minifier-tool');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"Does minifying CSS affect how my styles work?"');
        expect(html).toContain('"name":"Can I unminify (beautify) the CSS again later?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"No. Minification does not change the CSS functionality - it only removes characters that are unnecessary for the browser');
        expect(html).toContain('"isPartOf":{"@id":"https://codesamplez.com/tools/css-minifier/#webpage"}');
    });

    it('renders FAQPage structured data for jwt-builder', () => {
        const html = generateToolDocument('jwt-builder-tool');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"Is this JWT generator free to use?"');
        expect(html).toContain('"name":"Is using an online JWT generator safe?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"Yes. The CodeSamplez JWT Generator is completely free to use and runs directly in your browser.');
        expect(html).toContain('"isPartOf":{"@id":"https://codesamplez.com/tools/jwt-builder/#webpage"}');
    });

    it('renders FAQPage structured data for jwt-decoder', () => {
        const html = generateToolDocument('jwt-decoder-tool');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"Is it safe to decode JWTs using an online tool?"');
        expect(html).toContain('"name":"Can this tool create JWTs or just decode?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"Yes. This tool doesn’t store anything, neither sends to any server for processing.');
        expect(html).toContain('"isPartOf":{"@id":"https://codesamplez.com/tools/jwt-decoder/#webpage"}');
    });

    it('renders prerendered markup for a representative module tool', () => {
        const html = generateToolDocument('base64-converter-tool');

        expect(html).toContain('id="base64converter-mode"');
        expect(html).toContain('id="base64converter-convert"');
        expect(html).toContain('id="related-tools-heading"');
        expect(html).toContain('Related tools');
        expect(html).toContain('href="/tools/jwt-decoder/"');
        expect(html).toContain('https://codesamplez.com/tools/base64-converter/images/featured.png');
        expect(html).toContain('"@type":"WebSite"');
        expect(html).toContain('"name":"Base64 Converter"');
        expect(html).toContain('"keywords":"base64, encode, decode, text, files"');
    });

    it('renders FAQPage structured data for text-analyzer', () => {
        const html = generateToolDocument('text-analyzer-tool');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"Is the Text Analyzer tool free to use?"');
        expect(html).toContain('"name":"What\'s the difference between a text analyzer and a word counter?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"Yes. The CodeSamplez Text Analyzer is completely free to use.');
        expect(html).toContain('"isPartOf":{"@id":"https://codesamplez.com/tools/text-analyzer/#webpage"}');
    });

    it('uses localhost metadata and root-relative internal links in development mode', () => {
        const html = withEnv({
            NODE_ENV: 'development',
            PORT: '8081',
            CST_SITE_BASE_URL: undefined
        }, () => {
            let isolatedHtml = '';
            const previousCatalog = global.__CST_APP_SHELL_CATALOG__;

            try {
                jest.isolateModules(() => {
                    const { getAppShellCatalogDefinition } = require('./app-shell-catalog');
                    global.__CST_APP_SHELL_CATALOG__ = getAppShellCatalogDefinition();
                    const { generateToolDocument: generateIsolatedToolDocument } = require('./tool-document.js');
                    isolatedHtml = generateIsolatedToolDocument('jwt-decoder-tool');
                });
            } finally {
                global.__CST_APP_SHELL_CATALOG__ = previousCatalog;
            }

            return isolatedHtml;
        });

        expect(html).toContain('<link rel="canonical" href="http://localhost:8081/jwt-decoder/">');
        expect(html).toContain('"url":"http://localhost:8081/jwt-decoder/"');
        expect(html).toContain('href="/jwt-builder/"');
        expect(html).not.toContain('href="/tools/jwt-builder/"');
    });
});
