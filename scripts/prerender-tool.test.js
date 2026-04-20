/** @jest-environment node */

const {
    getPrerenderConfig,
    getPrerenderToolNames,
    renderRelatedToolsPrerenderMarkup,
    renderToolAfterAppPrerenderMarkup,
    renderToolBeforeAppPrerenderMarkup,
    renderToolPrerenderMarkup
} = require('./prerender-tool.js');
const { SITE_BASE_URL, buildSiteHref } = require('../common/siteBaseUrl');

describe('generic tool prerender helpers', () => {
    it('contains data-format-converter in prerender registry', () => {
        const toolNames = getPrerenderToolNames();
        expect(toolNames).toContain('data-format-converter');

        const config = getPrerenderConfig('data-format-converter');
        expect(config).not.toBeNull();
        expect(typeof config.createAppNode).toBe('function');
    });

    it('returns null for tools without prerender config', () => {
        expect(getPrerenderConfig('non-existent-tool')).toBeNull();
    });

    it('renders converter app markup to string for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('data-format-converter');

        expect(markup).toMatch(/class="[^"]*\btool-container\b[^"]*"/);
        expect(markup).toContain('id="inputText"');
        expect(markup).toContain('id="outputText"');
        expect(markup).toContain('Convert Data');
        expect(markup).toContain('The Online Data Format Converter Tool is a web-based utility that converts between JSON, XML, Properties and YAML data formats.');
        expect(markup).toContain('Data Format Converter Usage Example');
        expect(markup).toContain('Data Format Converter FAQs');
        expect(markup).toContain(`href="${SITE_BASE_URL}"`);
    });

    it('throws when attempting to render a tool without prerender config', () => {
        expect(() => renderToolPrerenderMarkup('non-existent-tool'))
            .toThrow('No prerender config found for tool: non-existent-tool');
    });

    it('renders base64-converter app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('base64-converter-tool');

        expect(markup).toContain('id="base64converter-mode"');
        expect(markup).toContain('id="base64converter-input"');
        expect(markup).toContain('id="base64converter-convert"');
        expect(markup).toContain('Base64 Converter is a free online tool to quickly encode or decode text and files in Base64 format.');
        expect(markup).toContain('What is Base64 encoding and why use it?');
        expect(markup).toContain('Base64 Converter FAQs (Frequently Asked Questions)');
        expect(markup).toContain(`href="${SITE_BASE_URL}"`);
        expect(markup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders json-formatter app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('json-formatter-tool');

        expect(markup).toContain('id="formatJsonBtn"');
        expect(markup).toContain('id="jsonErrorStatus"');
        expect(markup).toContain('id="treeView"');
        expect(markup).toContain('Struggling to read messy JSON? Our free Online JSON Formatter beautifies raw JSON instantly');
        expect(markup).toContain('Why Use A JSON Formatter Tool?');
        expect(markup).toContain('JSON Formatter FAQs');
        expect(markup).toContain(`href="${SITE_BASE_URL}"`);
        expect(markup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders js-minifier app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('js-minifier-tool');

        expect(markup).toContain('id="js-minifier-minify-btn"');
        expect(markup).toContain('id="js-minifier-input"');
        expect(markup).toContain('id="js-minifier-remove-comments"');
        expect(markup).toContain('Minify your JavaScript code online to dramatically reduce file size and improve web performance.');
        expect(markup).toContain('Why Minify JavaScript?');
        expect(markup).toContain('JavaScript Minifier FAQs');
        expect(markup).toContain(`href="${SITE_BASE_URL}"`);
        expect(markup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders jwt-decoder app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('jwt-decoder-tool');

        expect(markup).toContain('id="jwtInputToken"');
        expect(markup).toContain('id="jwt-decoder-validate-btn"');
        expect(markup).toContain('id="jwtSignatureStatus"');
        expect(markup).toContain('This free online JWT Decoder lets you paste any JSON Web Token to instantly see its header and payload');
        expect(markup).toContain('What is a JSON Web Token (JWT)?');
        expect(markup).toContain('JWT Decoder FAQs (Frequently Asked Questions)');
        expect(markup).toContain(`href="${SITE_BASE_URL}"`);
        expect(markup).toContain(`href="${buildSiteHref('/jwt-builder/')}"`);
        expect(markup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders jwt-builder app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('jwt-builder-tool');

        expect(markup).toContain('id="jwtForm"');
        expect(markup).toContain('id="buildJwtBtn"');
        expect(markup).toContain('id="customClaims"');
        expect(markup).toContain('JWT Generator is a free browser-based tool to quickly create signed JSON Web Tokens.');
        expect(markup).toContain('What is a JWT Generator?');
        expect(markup).toContain('JWT Generator FAQs (Frequently Asked Questions)');
        expect(markup).toContain(`href="${SITE_BASE_URL}"`);
        expect(markup).toContain(`href="${buildSiteHref('/jwt-decoder/')}"`);
        expect(markup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders diff-checker app markup for server-side prerender', () => {
        const appMarkup = renderToolPrerenderMarkup('diff-checker-tool');
        const beforeMarkup = renderToolBeforeAppPrerenderMarkup('diff-checker-tool');
        const afterMarkup = renderToolAfterAppPrerenderMarkup('diff-checker-tool');

        expect(appMarkup).toContain('id="text1"');
        expect(appMarkup).toContain('id="text2"');
        expect(appMarkup).toContain('id="compare-button"');
        expect(appMarkup).toContain('id="diff-result"');
        expect(beforeMarkup).toContain('The Diff Checker Tool is a lightweight, web-based utility designed to compare two blocks of text');
        expect(afterMarkup).toContain('Diff Checker Tool Features:');
        expect(afterMarkup).toContain('Diff Checker FAQs');
        expect(afterMarkup).toContain('Example diff checker result output:');
        expect(afterMarkup).toContain('src="https://tools.codesamplez.com/diff-checker/images/diff-result-view-example.webp"');
        expect(afterMarkup).toContain(`href="${SITE_BASE_URL}"`);
        expect(afterMarkup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders css-minifier app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('css-minifier-tool');

        expect(markup).toContain('id="css-minifier-input"');
        expect(markup).toContain('id="css-minifier-output"');
        expect(markup).toContain('id="minify-btn"');
        expect(markup).toContain('CSS Minification is the process of removing unnecessary characters such as spaces, line breaks, and comments from CSS code.');
        expect(markup).toContain('What is a CSS Minifier?');
        expect(markup).toContain('CSS Minifier FAQs');
        expect(markup).toContain(`href="${SITE_BASE_URL}"`);
        expect(markup).toContain(`href="${buildSiteHref('/js-minifier/')}"`);
    });

    it('renders text-analyzer app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('text-analyzer-tool');

        expect(markup).toContain('id="textInput"');
        expect(markup).toContain('id="wordFrequencyChart"');
        expect(markup).toContain('id="load-sample"');
        expect(markup).toContain('The CodeSamplez Text Analyzer is a <strong>free online text analysis tool</strong>');
        expect(markup).toContain('What is a Text Analyzer?');
        expect(markup).toContain('Text Analyzer FAQs:');
        expect(markup).toContain(`href="${SITE_BASE_URL}"`);
        expect(markup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders qr-code-generator app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('qr-code-generator');

        expect(markup).toContain('id="qr-text"');
        expect(markup).toContain('id="qr-canvas"');
        expect(markup).toContain('id="download-btn"');
        expect(markup).toContain('The CodeSamplez QR Code Generator is a <strong>free online QR code creator</strong>');
        expect(markup).toContain('How To Generate QR Code With This Tool:');
        expect(markup).toContain('Frequently Asked Questions (FAQs)');
        expect(markup).toContain(`href="${SITE_BASE_URL}"`);
        expect(markup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders related-tools markup for a representative tool', () => {
        const markup = renderRelatedToolsPrerenderMarkup('jwt-decoder-tool');

        expect(markup).toContain('id="related-tools-heading"');
        expect(markup).toContain('JWT Builder');
        expect(markup).toContain('Base64 Converter');
        expect(markup).toContain(`href="${buildSiteHref('/jwt-builder/')}"`);
        expect(markup).toContain(`href="${buildSiteHref('/base64-converter/')}"`);
        expect(markup).toContain('Open tool');
    });
});
