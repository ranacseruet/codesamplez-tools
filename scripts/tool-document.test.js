/** @jest-environment node */

const { generateToolDocument, joinUrl, renderToolDocument } = require('./tool-document.js');
const { getToolById, getToolDefinitions } = require('./tool-manifest');
const { SITE_BASE_URL, SITE_STATIC_ROOT_URI, buildSiteAssetUri, buildSiteHref } = require('../common/siteBaseUrl');

function getHeadingMatches(html, level) {
    return [...html.matchAll(new RegExp(`<h${level}\\b[^>]*>`, 'g'))];
}

function getElementMatches(html, tagName) {
    return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'g'))];
}

function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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
        expect(joinUrl(SITE_BASE_URL.replace(/\/$/, ''), '/json-formatter/'))
            .toBe(buildSiteHref('/json-formatter/'));
        expect(joinUrl(SITE_STATIC_ROOT_URI, 'text-analyzer/images/featured.png'))
            .toBe(buildSiteAssetUri('/text-analyzer/images/featured.png'));
    });

    it('renders a module tool document with metadata and shell placeholders', () => {
        const tool = getToolById('diff-checker-tool');
        const html = renderToolDocument(
            tool,
            '<section>SSR payload</section>',
            '<section class="c-related-tools">Related</section>',
            '<section>Before payload</section>',
            '<section>After payload</section>'
        );

        expect(html).toContain('<title>Diff Checker - Compare Text &amp; Code Instantly | Free Online Dev Tools by CodeSamplez</title>');
        expect(html).toContain('<meta name="description" content="Free online diff checker to quickly compare code or text differences. Perfect for developers, writers, and editors seeking instant results.">');
        expect(html).toContain('<meta name="theme-color" content="#0b0b11">');
        expect(html).toContain('<html lang="en" data-theme="dark">');
        expect(html).toContain("localStorage.getItem('cst-standalone-theme-mode')");
        expect(html).toContain(`<link rel="icon" href="${buildSiteAssetUri('/favicon.ico')}" sizes="any">`);
        expect(html).toContain(`<link rel="icon" type="image/svg+xml" href="${buildSiteAssetUri('/favicon.svg')}">`);
        expect(html).toContain(`<link rel="apple-touch-icon" href="${buildSiteAssetUri('/apple-touch-icon.png')}">`);
        expect(html).toContain(`<link rel="preload" href="${buildSiteAssetUri('/fonts/Geist-Variable.woff2')}" as="font" type="font/woff2" crossorigin>`);
        expect(html).not.toContain('fonts.googleapis.com');
        expect(html).not.toContain('unpkg.com');
        expect(html).toContain(`<link rel="canonical" href="${buildSiteHref('/diff-checker/')}">`);
        expect(html).toContain(`<link rel="stylesheet" href="${buildSiteAssetUri('/diff-checker/styles.main.css')}">`);
        expect(html).toContain('<meta property="og:site_name" content="CodeSamplez Tools">');
        expect(html).toContain(`<meta property="og:image" content="${buildSiteAssetUri('/diff-checker/images/featured.png')}">`);
        expect(html).toContain('<meta property="og:image:width" content="1200">');
        expect(html).toContain('<meta property="og:image:height" content="630">');
        expect(html).toContain('<script type="application/ld+json">');
        expect(html).toContain('"@type":"Organization"');
        expect(html).toContain('"publisher":{"@id":"');
        expect(html).toContain('"@type":"WebPage"');
        expect(html).toContain('"@type":["WebApplication","SoftwareApplication"]');
        expect(html).toContain('"@type":"BreadcrumbList"');
        expect(html).toContain(`"breadcrumb":{"@id":"${buildSiteHref('/diff-checker/')}#breadcrumb"}`);
        expect(html).toContain('"position":1,"name":"Home"');
        expect(html).toContain('"position":2,"name":"Diff Checker"');
        // The JSON-LD trail must mirror the visible breadcrumb in the prerendered header.
        expect(html).toContain('<nav class="cst-shell__breadcrumb" aria-label="Breadcrumb">');
        expect(html).toContain(`<a class="cst-shell__breadcrumb-link" href="${SITE_BASE_URL}">Home</a>`);
        expect(html).toContain('<span class="cst-shell__breadcrumb-current" aria-current="page">Diff Checker</span>');
        expect(html).toContain('"operatingSystem":"Any"');
        expect(html).toContain('"price":"0"');
        expect(html).toContain('"priceCurrency":"USD"');
        expect(html).toContain(`"url":"${buildSiteHref('/diff-checker/')}"`);
        expect(html).toContain(`"image":"${buildSiteAssetUri('/diff-checker/images/featured.png')}"`);
        expect(html).toContain('<div id="app-shell-header"><header class="cst-shell__header">');
        // The shortcuts button is client-only: it needs the lazy overlay chunk
        // behind it, so it must not appear in server markup.
        expect(html).not.toContain('cst-shell__shortcut-help-button');
        expect(html).toContain('<div id="app-shell-share"><nav class="cst-share" aria-label="Share this tool">');
        expect(html).toContain(`href="https://twitter.com/intent/tweet?text=${encodeURIComponent('Diff Checker')}&amp;url=${encodeURIComponent(buildSiteHref('/diff-checker/'))}"`);
        expect(html).toContain(`href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(buildSiteHref('/diff-checker/'))}"`);
        expect(html).toContain('<button type="button" class="cst-share__btn cst-share__btn--copy" aria-label="Copy link"');
        expect(html).toContain('<div id="app-shell-footer"><footer class="cst-shell__footer">');
        expect(html).toContain('<a href="https://codesamplez.com" class="cst-shell__footer-link">CodeSamplez.com</a>');
        expect(html).toContain('<h1 class="cst-shell__title">Diff Checker</h1>');
        expect(html).toContain('<p class="cst-shell__description">Free online diff checker to quickly compare code or text differences. Perfect for developers, writers, and editors seeking instant results.</p>');
        expect(html).toContain('<main class="c-tool-page-main" aria-labelledby="diff-checker-app-workspace-heading">');
        expect(html).toContain('<h2 id="diff-checker-app-workspace-heading" class="u-visually-hidden">Diff Checker workspace</h2>');
        expect(html).toContain('<div class="c-tool-static-shell c-tool-static-shell--before"><section>Before payload</section></div>');
        expect(html).toContain('<div id="diff-checker-app"><section>SSR payload</section></div>');
        expect(html).toContain('<div class="c-tool-static-shell c-tool-static-shell--after"><section>After payload</section></div>');
        expect(html).toContain('<section class="c-related-tools">Related</section>');
        expect(html).toContain(`<link rel="image_src" href="${buildSiteAssetUri('/diff-checker/images/featured.png')}">`);
        expect(html).toContain(`<script src="${buildSiteAssetUri('/diff-checker/bundle.main.js')}" type="module"></script>`);
    });

    it('renders exactly one visible h1 for every generated tool document', () => {
        getToolDefinitions().forEach((tool) => {
            const html = generateToolDocument(tool.id);

            expect(getHeadingMatches(html, 1)).toHaveLength(1);
            expect(html).toContain(`<h1 class="cst-shell__title">${escapeHtml(tool.title)}</h1>`);
            expect(html).not.toContain('c-tool-page-heading');
        });
    });

    it('renders exactly one main landmark and a workspace h2 for every generated tool document', () => {
        getToolDefinitions().forEach((tool) => {
            const html = generateToolDocument(tool.id);

            expect(getElementMatches(html, 'main')).toHaveLength(1);
            expect(html).toContain(`<main class="c-tool-page-main" aria-labelledby="${tool.appRootId}-workspace-heading">`);
            expect(html).toContain(`<h2 id="${tool.appRootId}-workspace-heading" class="u-visually-hidden">${escapeHtml(tool.title)} workspace</h2>`);
        });
    });

    it('renders FAQPage structured data for diff-checker', () => {
        const html = generateToolDocument('diff-checker-tool');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"Does the tool work offline?"');
        expect(html).toContain('"name":"Is the diff checker free to use?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"Yes! Once the page loads, all comparisons happen locally in your browser, so you can use it without an internet connection.');
        expect(html).toContain(`"isPartOf":{"@id":"${buildSiteHref('/diff-checker/')}#webpage"}`);
        expect(html).toContain(`src="${buildSiteAssetUri('/diff-checker/images/diff-result-view-example.webp')}"`);
    });

    it('renders a classic-script document for qr-code-generator', () => {
        const html = generateToolDocument('qr-code-generator');

        expect(html).toContain('<title>QR Code Generator | Free Online Dev Tools by CodeSamplez</title>');
        expect(html).toContain('<div id="qr-code-generator-app">');
        expect(html).toContain(`<script src="${buildSiteAssetUri('/qr-code-generator/bundle.main.js')}"></script>`);
        expect(html).not.toContain(`<script src="${buildSiteAssetUri('/qr-code-generator/bundle.main.js')}" type="module"></script>`);
    });

    it('renders FAQPage structured data for qr-code-generator', () => {
        const html = generateToolDocument('qr-code-generator');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"What is a QR code?"');
        expect(html).toContain('"name":"Can I customize my QR code with this tool?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"A QR code, short for Quick Response code, is a two-dimensional barcode');
        expect(html).toContain(`"isPartOf":{"@id":"${buildSiteHref('/qr-code-generator/')}#webpage"}`);
    });

    it('renders FAQPage structured data for data-format-converter', () => {
        const html = generateToolDocument('data-format-converter');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"Does the tool support batch conversion?"');
        expect(html).toContain('"name":"How secure is the online converter?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"Currently, our data format conversion tool focuses on single-file conversions');
        expect(html).toContain(`"isPartOf":{"@id":"${buildSiteHref('/data-format-converter/')}#webpage"}`);
    });

    it('renders FAQPage structured data for js-minifier', () => {
        const html = generateToolDocument('js-minifier-tool');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"What is JavaScript minification and why is it important?"');
        expect(html).toContain('"name":"Is minification the same as obfuscation?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"JavaScript minification is the process of compressing code by removing unnecessary characters like spaces, line breaks, and comments');
        expect(html).toContain(`"isPartOf":{"@id":"${buildSiteHref('/js-minifier/')}#webpage"}`);
    });

    it('renders FAQPage structured data for json-formatter', () => {
        const html = generateToolDocument('json-formatter-tool');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"What is a JSON Formatter?"');
        expect(html).toContain('"name":"Can a JSON Formatter also validate JSON?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"A JSON Formatter is an online tool that takes unformatted or minified JSON data and beautifies it by adding proper indentation and line breaks.');
        expect(html).toContain(`"isPartOf":{"@id":"${buildSiteHref('/json-formatter/')}#webpage"}`);
    });

    it('renders HowTo and SoftwareApplication structured data for json-formatter', () => {
        const html = generateToolDocument('json-formatter-tool');

        expect(html).toContain('"@type":"HowTo"');
        expect(html).toContain('"name":"How to Use JSON Formatter"');
        expect(html).toContain('"@type":"HowToStep","position":1,"name":"Enter JSON Data"');
        expect(html).toContain(`"isPartOf":{"@id":"${buildSiteHref('/json-formatter/')}#webpage"}`);
        expect(html).toContain('"@type":["WebApplication","SoftwareApplication"]');
        expect(html).toContain('"featureList":["Pretty-print with selectable indentation"');
    });

    it('renders FAQPage structured data for css-minifier', () => {
        const html = generateToolDocument('css-minifier-tool');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"Does minifying CSS affect how my styles work?"');
        expect(html).toContain('"name":"Can I unminify (beautify) the CSS again later?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"No. Minification does not change the CSS functionality - it only removes characters that are unnecessary for the browser');
        expect(html).toContain(`"isPartOf":{"@id":"${buildSiteHref('/css-minifier/')}#webpage"}`);
    });

    it('renders FAQPage structured data for jwt-builder', () => {
        const html = generateToolDocument('jwt-builder-tool');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"Is this JWT generator free to use?"');
        expect(html).toContain('"name":"Is using an online JWT generator safe?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"Yes. The CodeSamplez JWT Generator is completely free to use and runs directly in your browser.');
        expect(html).toContain(`"isPartOf":{"@id":"${buildSiteHref('/jwt-builder/')}#webpage"}`);
    });

    it('renders FAQPage structured data for jwt-decoder', () => {
        const html = generateToolDocument('jwt-decoder-tool');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"Is it safe to decode JWTs using an online tool?"');
        expect(html).toContain('"name":"Can this tool create JWTs or just decode?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"Yes. This tool doesn’t store anything, neither sends to any server for processing.');
        expect(html).toContain(`"isPartOf":{"@id":"${buildSiteHref('/jwt-decoder/')}#webpage"}`);
    });

    it('renders FAQPage structured data for base64-converter', () => {
        const html = generateToolDocument('base64-converter-tool');

        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"name":"Is Base64 encoding secure?"');
        expect(html).toContain('"name":"Does this tool send my data to a server?"');
        expect(html).toContain('"acceptedAnswer":{"@type":"Answer","text":"No. Base64 is not encryption. It is an encoding scheme for data representation, not meant for security.');
        expect(html).toContain(`"isPartOf":{"@id":"${buildSiteHref('/base64-converter/')}#webpage"}`);
    });

    it('renders prerendered markup for a representative module tool', () => {
        const html = generateToolDocument('base64-converter-tool');

        expect(html).toContain('id="base64converter-mode"');
        expect(html).toContain('id="base64converter-convert"');
        expect(html).toContain('id="related-tools-heading"');
        expect(html).toContain('Related tools');
        expect(html).toContain(`href="${buildSiteHref('/jwt-decoder/')}"`);
        expect(html).toContain(buildSiteAssetUri('/base64-converter/images/featured.png'));
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
        expect(html).toContain(`"isPartOf":{"@id":"${buildSiteHref('/text-analyzer/')}#webpage"}`);
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
        expect(html).toContain('href="http://localhost:8081/jwt-builder/"');
        expect(html).not.toContain('href="/jwt-builder/"');
    });

    it('injects GA4 and AdSense head scripts when analytics ids are configured', () => {
        const html = withEnv({
            CST_GA_MEASUREMENT_ID: 'G-TOOLPAGE1',
            CST_ADSENSE_CLIENT_ID: 'ca-pub-1234567890123456'
        }, () => renderToolDocument(getToolById('diff-checker-tool'), '<section>SSR</section>'));

        expect(html).toContain('https://www.googletagmanager.com/gtag/js?id=G-TOOLPAGE1');
        expect(html).toContain("gtag('config','G-TOOLPAGE1')");
        expect(html).toContain('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456');
        // AdSense loader is deferred (no render-blocking async <script src>) and the
        // ad origins are pre-connected in the head.
        expect(html).not.toContain('<script async src="https://pagead2.googlesyndication.com');
        expect(html).toContain('<link rel="preconnect" href="https://pagead2.googlesyndication.com" crossorigin>');
        expect(html).toContain('<link rel="preconnect" href="https://googleads.g.doubleclick.net" crossorigin>');
    });

    it('injects the configured GA4 and AdSense ids from tooling-root config', () => {
        const html = renderToolDocument(getToolById('diff-checker-tool'), '<section>SSR</section>');

        expect(html).toContain('https://www.googletagmanager.com/gtag/js?id=G-75J9GJXH5K');
        expect(html).toContain('client=ca-pub-3520433969377647');
    });

    it('omits analytics head scripts in development even when ids are present', () => {
        const html = withEnv({
            NODE_ENV: 'development',
            CST_GA_MEASUREMENT_ID: 'G-TOOLPAGE1',
            CST_ADSENSE_CLIENT_ID: 'ca-pub-1234567890123456'
        }, () => renderToolDocument(getToolById('diff-checker-tool'), '<section>SSR</section>'));

        expect(html).not.toContain('googletagmanager.com');
        expect(html).not.toContain('googlesyndication.com');
    });
});
