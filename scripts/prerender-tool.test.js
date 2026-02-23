/** @jest-environment node */

const {
    getPrerenderConfig,
    getPrerenderToolNames,
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
        expect(getPrerenderConfig('diff-checker-tool')).toBeNull();
    });

    it('renders converter app markup to string for server-side prerender', () => {
        const markup = renderToolPrerenderMarkup('data-format-converter');

        expect(markup).toContain('class="tool-container"');
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

    it('leaves html unchanged when configured root placeholder is missing', () => {
        const htmlTemplate = '<html><body><div id="different-root"></div></body></html>';

        const injected = injectToolPrerender('data-format-converter', htmlTemplate);

        expect(injected).toBe(htmlTemplate);
    });

    it('leaves html unchanged for tools without prerender support', () => {
        const htmlTemplate = '<html><body><div id="diff-checker-tool-app"></div></body></html>';

        const injected = injectToolPrerender('diff-checker-tool', htmlTemplate);

        expect(injected).toBe(htmlTemplate);
    });

    it('throws when attempting to render a tool without prerender config', () => {
        expect(() => renderToolPrerenderMarkup('diff-checker-tool'))
            .toThrow('No prerender config found for tool: diff-checker-tool');
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
});
