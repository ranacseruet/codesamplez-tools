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
        expect(getPrerenderConfig('json-formatter-tool')).toBeNull();
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
        const htmlTemplate = '<html><body><div id="json-formatter-tool-app"></div></body></html>';

        const injected = injectToolPrerender('json-formatter-tool', htmlTemplate);

        expect(injected).toBe(htmlTemplate);
    });

    it('throws when attempting to render a tool without prerender config', () => {
        expect(() => renderToolPrerenderMarkup('json-formatter-tool'))
            .toThrow('No prerender config found for tool: json-formatter-tool');
    });
});
