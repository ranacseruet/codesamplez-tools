/** @jest-environment node */

const {
    getPrerenderConfig,
    getPrerenderToolNames,
    injectToolFeaturedImageMetadata,
    injectToolPrerender,
    renderToolPrerenderMarkup
} = require('./prerender-tool.js');

describe('generic tool prerender helpers', () => {
    it('contains data-format-converter in prerender registry', () => {
        const toolNames = getPrerenderToolNames();
        expect(toolNames).toContain('data-format-converter');

        const config = getPrerenderConfig('data-format-converter');
        expect(config).not.toBeNull();
        expect(config.rootId).toBe('data-format-converter-app');
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
    });

    it('injects prerendered markup into configured app root placeholder', () => {
        const htmlTemplate = '<html><body><div id="data-format-converter-app"></div></body></html>';

        const injected = injectToolPrerender('data-format-converter', htmlTemplate);

        expect(injected).toContain('<div id="data-format-converter-app">');
        expect(injected).toContain('id="convertBtn"');
        expect(injected).not.toContain('<div id="data-format-converter-app"></div>');
    });

    it('injects shared featured-image metadata into tool pages with a head tag', () => {
        const htmlTemplate = [
            '<html>',
            '<head>',
            '<title>Data Format Converter</title>',
            '</head>',
            '<body></body>',
            '</html>'
        ].join('');

        const injected = injectToolFeaturedImageMetadata('data-format-converter', htmlTemplate);

        expect(injected).toContain('<meta property="og:image" content="images/featured.png">');
        expect(injected).toContain('<meta name="twitter:image" content="images/featured.png">');
        expect(injected).toContain('<meta property="og:title" content="Data Format Converter">');
        expect(injected).toContain('<link rel="image_src" href="images/featured.png">');
    });

    it('does not duplicate shared featured-image metadata when og:image is already present', () => {
        const htmlTemplate = [
            '<html>',
            '<head>',
            '<title>Diff Checker</title>',
            '<meta property="og:image" content="images/featured.png">',
            '</head>',
            '<body></body>',
            '</html>'
        ].join('');

        const injected = injectToolFeaturedImageMetadata('diff-checker-tool', htmlTemplate);

        expect(injected).toBe(htmlTemplate);
    });

    it('injectToolPrerender adds featured-image metadata alongside prerendered markup', () => {
        const htmlTemplate = [
            '<html>',
            '<head>',
            '<title>Base64 Converter</title>',
            '</head>',
            '<body><div id="base64converter-app"></div></body>',
            '</html>'
        ].join('');

        const injected = injectToolPrerender('base64-converter-tool', htmlTemplate);

        expect(injected).toContain('<meta property="og:image" content="images/featured.png">');
        expect(injected).toContain('id="base64converter-convert"');
    });

    it('leaves html unchanged when configured root placeholder is missing', () => {
        const htmlTemplate = '<html><body><div id="different-root"></div></body></html>';

        const injected = injectToolPrerender('data-format-converter', htmlTemplate);

        expect(injected).toBe(htmlTemplate);
    });

    it('leaves html unchanged for tools without prerender support', () => {
        const htmlTemplate = '<html><body><div id="unknown-tool-app"></div></body></html>';

        const injected = injectToolPrerender('non-existent-tool', htmlTemplate);

        expect(injected).toBe(htmlTemplate);
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
    });

    it('renders json-formatter app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('json-formatter-tool');

        expect(markup).toContain('id="formatJsonBtn"');
        expect(markup).toContain('id="jsonErrorStatus"');
        expect(markup).toContain('id="treeView"');
    });

    it('renders js-minifier app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('js-minifier-tool');

        expect(markup).toContain('id="js-minifier-minify-btn"');
        expect(markup).toContain('id="js-minifier-input"');
        expect(markup).toContain('id="js-minifier-remove-comments"');
    });

    it('renders jwt-decoder app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('jwt-decoder-tool');

        expect(markup).toContain('id="jwtInputToken"');
        expect(markup).toContain('id="jwt-decoder-validate-btn"');
        expect(markup).toContain('id="jwtSignatureStatus"');
    });

    it('renders jwt-builder app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('jwt-builder-tool');

        expect(markup).toContain('id="jwtForm"');
        expect(markup).toContain('id="buildJwtBtn"');
        expect(markup).toContain('id="customClaims"');
    });

    it('renders diff-checker app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('diff-checker-tool');

        expect(markup).toContain('id="text1"');
        expect(markup).toContain('id="text2"');
        expect(markup).toContain('id="compare-button"');
        expect(markup).toContain('id="diff-result"');
    });

    it('renders css-minifier app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('css-minifier-tool');

        expect(markup).toContain('id="css-minifier-input"');
        expect(markup).toContain('id="css-minifier-output"');
        expect(markup).toContain('id="minify-btn"');
    });

    it('renders text-analyzer app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('text-analyzer-tool');

        expect(markup).toContain('id="textInput"');
        expect(markup).toContain('id="wordFrequencyChart"');
        expect(markup).toContain('id="load-sample"');
    });

    it('renders qr-code-generator app markup for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('qr-code-generator');

        expect(markup).toContain('id="qr-text"');
        expect(markup).toContain('id="qr-canvas"');
        expect(markup).toContain('id="download-btn"');
    });
});
