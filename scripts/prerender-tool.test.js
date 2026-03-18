/** @jest-environment node */

const {
    getPrerenderConfig,
    getPrerenderToolNames,
    renderRelatedToolsPrerenderMarkup,
    renderToolPrerenderMarkup
} = require('./prerender-tool.js');

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

    it('renders related-tools markup for a representative tool', () => {
        const markup = renderRelatedToolsPrerenderMarkup('jwt-decoder-tool');

        expect(markup).toContain('id="related-tools-heading"');
        expect(markup).toContain('JWT Builder');
        expect(markup).toContain('Base64 Converter');
        expect(markup).toContain('href="/jwt-builder/"');
        expect(markup).toContain('href="/base64-converter/"');
        expect(markup).toContain('Open tool');
    });
});
