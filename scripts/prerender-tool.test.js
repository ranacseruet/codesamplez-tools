/** @jest-environment node */

const {
    createArticleAfterAppNode,
    resolveContentExport,
    getPrerenderConfig,
    getPrerenderToolNames,
    renderRelatedToolsPrerenderMarkup,
    renderToolAfterAppPrerenderMarkup,
    renderToolBeforeAppPrerenderMarkup,
    renderToolPrerenderMarkup
} = require('./prerender-tool.js');
const { SITE_BASE_URL, buildSiteAssetUri, buildSiteHref } = require('../common/siteBaseUrl');

describe('generic tool prerender helpers', () => {
    // Registry-wide invariant. The per-tool tests below are hand-written, so a
    // newly registered tool has none — it would ship with no intro/article/FAQ
    // copy and fully green CI. This also catches a misspelled content export:
    // preact-render-to-string renders `h(undefined)` as literal
    // `<undefined></undefined>` rather than throwing.
    it.each(getPrerenderToolNames())('renders non-empty after-app article markup for %s', (toolName) => {
        const afterMarkup = renderToolAfterAppPrerenderMarkup(toolName);

        expect(afterMarkup.length).toBeGreaterThan(0);
        expect(afterMarkup).toContain('c-tool-article');
        expect(afterMarkup).not.toContain('<undefined>');
    });

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
        const appMarkup = renderToolPrerenderMarkup('data-format-converter');
        const afterMarkup = renderToolAfterAppPrerenderMarkup('data-format-converter');

        expect(appMarkup).toContain('id="inputText"');
        expect(appMarkup).toContain('id="outputText"');
        expect(appMarkup).toMatch(/class="[^"]*\btool-container\b[^"]*"/);
        // Interactive control label, not article copy — stays in the app markup.
        expect(appMarkup).toContain('Convert Data');
        // Article content is prerendered outside the app root (#327),
        // so the interactive bundle no longer carries the static tree.
        expect(afterMarkup).toContain('The Online Data Format Converter Tool is a web-based utility that converts between JSON, XML, Properties and YAML data formats.');
        // The invariant this migration exists for: the article tree must NOT
        // be in the hydrated app markup. Without this, re-adding <Intro/> to a
        // component passes every positive assertion.
        expect(appMarkup).not.toContain('The Online Data Format Converter Tool is a web-based utility that converts between JSON, XML, Properties and YAML data formats.');
        expect(afterMarkup).toContain('Data Format Converter Usage Example');
        expect(afterMarkup).toContain('Data Format Converter FAQs');
        expect(afterMarkup).toContain(`href="${SITE_BASE_URL}"`);
    });

    it('throws when attempting to render a tool without prerender config', () => {
        expect(() => renderToolPrerenderMarkup('non-existent-tool'))
            .toThrow('No prerender config found for tool: non-existent-tool');
    });

    it('renders base64-converter app markup for server-side prerender', () => {
        const appMarkup = renderToolPrerenderMarkup('base64-converter-tool');
        const afterMarkup = renderToolAfterAppPrerenderMarkup('base64-converter-tool');

        expect(appMarkup).toContain('id="base64converter-mode"');
        expect(appMarkup).toContain('id="base64converter-input"');
        expect(appMarkup).toContain('id="base64converter-convert"');
        expect(appMarkup).toContain('id="base64converter-image-preview"');
        expect(appMarkup).toContain('id="base64converter-swap"');
        // Article content is prerendered outside the app root (#327),
        // so the interactive bundle no longer carries the static tree.
        expect(afterMarkup).toContain('Base64 Converter is a free online tool to quickly encode or decode text and files in Base64 format.');
        // The invariant this migration exists for: the article tree must NOT
        // be in the hydrated app markup. Without this, re-adding <Intro/> to a
        // component passes every positive assertion.
        expect(appMarkup).not.toContain('Base64 Converter is a free online tool to quickly encode or decode text and files in Base64 format.');
        expect(afterMarkup).toContain('What is Base64 encoding and why use it?');
        expect(afterMarkup).toContain('Base64 Converter FAQs (Frequently Asked Questions)');
        expect(afterMarkup).toContain(`href="${SITE_BASE_URL}"`);
        expect(afterMarkup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders json-formatter app markup for server-side prerender', () => {
        const appMarkup = renderToolPrerenderMarkup('json-formatter-tool');
        const afterMarkup = renderToolAfterAppPrerenderMarkup('json-formatter-tool');

        expect(appMarkup).toContain('id="formatJsonBtn"');
        expect(appMarkup).toContain('id="jsonErrorStatus"');
        expect(appMarkup).toContain('id="treeView"');
        expect(appMarkup).toContain('class="jsonf-schema-disclosure"');
        expect(appMarkup).toContain('id="jsonSchemaInput"');
        expect(appMarkup).toContain('id="jsonSchemaDraft"');
        // Article content is prerendered outside the app root (#327),
        // so the interactive bundle no longer carries the static tree.
        expect(afterMarkup).toContain('A JSON formatter is a tool that takes raw or minified JSON and rewrites it with indentation');
        // The invariant this migration exists for: the article tree must NOT
        // be in the hydrated app markup. Without this, re-adding <Intro/> to a
        // component passes every positive assertion.
        expect(appMarkup).not.toContain('A JSON formatter is a tool that takes raw or minified JSON and rewrites it with indentation');
        expect(afterMarkup).toContain('Why Use A JSON Formatter Tool?');
        expect(afterMarkup).toContain('JSON Formatter FAQs');
        expect(afterMarkup).toContain(`href="${SITE_BASE_URL}"`);
        expect(afterMarkup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders json-editor app markup for server-side prerender', () => {
        const appMarkup = renderToolPrerenderMarkup('json-editor-tool');
        const afterMarkup = renderToolAfterAppPrerenderMarkup('json-editor-tool');

        expect(appMarkup).toContain('id="json-editor-import-input"');
        expect(appMarkup).toContain('id="json-editor-preview"');
        expect(appMarkup).toContain('Visual builder');
        // Article content is prerendered outside the app root, so the
        // hydrated bundle contains only the interactive editor surface.
        expect(afterMarkup).toContain('Use this free online JSON editor to build and edit JSON objects and arrays.');
        expect(appMarkup).not.toContain('Use this free online JSON editor to build and edit JSON objects and arrays.');
        expect(afterMarkup).toContain('How to Build JSON (Step-by-Step)');
        expect(afterMarkup).toContain('JSON Editor FAQs');
        expect(afterMarkup).toContain(`href="${SITE_BASE_URL}"`);
    });

    it('renders js-minifier app markup for server-side prerender', () => {
        const appMarkup = renderToolPrerenderMarkup('js-minifier-tool');
        const afterMarkup = renderToolAfterAppPrerenderMarkup('js-minifier-tool');

        expect(appMarkup).toContain('id="js-minifier-minify-btn"');
        expect(appMarkup).toContain('id="js-minifier-input"');
        expect(appMarkup).toContain('id="js-minifier-remove-comments"');
        // Article content is prerendered outside the app root (#327),
        // so the interactive bundle no longer carries the static tree.
        expect(afterMarkup).toContain('Minify your JavaScript code online to dramatically reduce file size and improve web performance.');
        // The invariant this migration exists for: the article tree must NOT
        // be in the hydrated app markup. Without this, re-adding <Intro/> to a
        // component passes every positive assertion.
        expect(appMarkup).not.toContain('Minify your JavaScript code online to dramatically reduce file size and improve web performance.');
        expect(afterMarkup).toContain('Why Minify JavaScript?');
        expect(afterMarkup).toContain('JavaScript Minifier FAQs');
        expect(afterMarkup).toContain(`href="${SITE_BASE_URL}"`);
        expect(afterMarkup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders jwt-decoder app markup for server-side prerender', () => {
        const appMarkup = renderToolPrerenderMarkup('jwt-decoder-tool');
        const afterMarkup = renderToolAfterAppPrerenderMarkup('jwt-decoder-tool');

        expect(appMarkup).toContain('id="jwtInputToken"');
        expect(appMarkup).toContain('id="jwt-decoder-validate-btn"');
        expect(appMarkup).toContain('id="jwtSignatureStatus"');
        // Article content is prerendered outside the app root (#327),
        // so the interactive bundle no longer carries the static tree.
        expect(afterMarkup).toContain('This free online JWT Decoder lets you paste any JSON Web Token to instantly see its header and payload');
        // The invariant this migration exists for: the article tree must NOT
        // be in the hydrated app markup. Without this, re-adding <Intro/> to a
        // component passes every positive assertion.
        expect(appMarkup).not.toContain('This free online JWT Decoder lets you paste any JSON Web Token to instantly see its header and payload');
        expect(afterMarkup).toContain('What is a JSON Web Token (JWT)?');
        expect(afterMarkup).toContain('JWT Decoder FAQs (Frequently Asked Questions)');
        expect(afterMarkup).toContain(`href="${SITE_BASE_URL}"`);
        expect(afterMarkup).toContain(`href="${buildSiteHref('/jwt-builder/')}"`);
        expect(afterMarkup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders jwt-builder app markup for server-side prerender', () => {
        const appMarkup = renderToolPrerenderMarkup('jwt-builder-tool');
        const afterMarkup = renderToolAfterAppPrerenderMarkup('jwt-builder-tool');

        expect(appMarkup).toContain('id="jwtForm"');
        expect(appMarkup).toContain('id="buildJwtBtn"');
        expect(appMarkup).toContain('id="customClaims"');
        expect(appMarkup).toContain('id="jwt-algorithm"');
        expect(appMarkup).toContain('value="HS256"');
        expect(appMarkup).toContain('value="RS256"');
        expect(appMarkup).toContain('id="jwt-builder-hs256-key-panel"');
        expect(appMarkup).toContain('id="jwt-builder-rs256-key-panel"');
        expect(appMarkup).toContain('id="rsa-private-key"');
        expect(appMarkup).toContain('aria-describedby="jwt-builder-rs256-key-help jwt-builder-error-status"');
        // Article content is prerendered outside the app root (#327),
        // so the interactive bundle no longer carries the static tree.
        expect(afterMarkup).toContain('JWT Generator is a free browser-based tool to quickly create signed JSON Web Tokens.');
        // The invariant this migration exists for: the article tree must NOT
        // be in the hydrated app markup. Without this, re-adding <Intro/> to a
        // component passes every positive assertion.
        expect(appMarkup).not.toContain('JWT Generator is a free browser-based tool to quickly create signed JSON Web Tokens.');
        expect(afterMarkup).toContain('What is a JWT Generator?');
        expect(afterMarkup).toContain('JWT Generator FAQs (Frequently Asked Questions)');
        expect(afterMarkup).toContain(`href="${SITE_BASE_URL}"`);
        expect(afterMarkup).toContain(`href="${buildSiteHref('/jwt-decoder/')}"`);
        expect(afterMarkup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders diff-checker app markup for server-side prerender', () => {
        const appMarkup = renderToolPrerenderMarkup('diff-checker-tool');
        const beforeMarkup = renderToolBeforeAppPrerenderMarkup('diff-checker-tool');
        const afterMarkup = renderToolAfterAppPrerenderMarkup('diff-checker-tool');

        expect(appMarkup).toContain('id="text1"');
        expect(appMarkup).toContain('id="text2"');
        expect(appMarkup).toContain('id="compare-button"');
        expect(appMarkup).toContain('id="download-patch-button"');
        expect(appMarkup).toContain('Download .patch');
        expect(appMarkup).toContain('id="diff-result"');
        // Tool-first ordering: the intro no longer renders above the tool; it now
        // renders after the tool, ahead of the guide article, within afterMarkup.
        expect(beforeMarkup).toBe('');
        const introCopy = 'The Diff Checker Tool is a lightweight, web-based utility designed to compare two blocks of text';
        expect(afterMarkup).toContain(introCopy);
        expect(afterMarkup).toContain('Diff Checker Tool Features:');
        expect(afterMarkup).toContain('Unified patch export');
        expect(afterMarkup.indexOf(introCopy)).toBeLessThan(afterMarkup.indexOf('Diff Checker Tool Features:'));
        expect(afterMarkup).toContain('Diff Checker FAQs');
        expect(afterMarkup).toContain('Example diff checker result output:');
        expect(afterMarkup).toContain(`src="${buildSiteAssetUri('/diff-checker/images/diff-result-view-example.webp')}"`);
        expect(afterMarkup).toContain(`href="${SITE_BASE_URL}"`);
        expect(afterMarkup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders css-minifier app markup for server-side prerender', () => {
        const appMarkup = renderToolPrerenderMarkup('css-minifier-tool');
        const afterMarkup = renderToolAfterAppPrerenderMarkup('css-minifier-tool');

        expect(appMarkup).toContain('id="css-minifier-input"');
        expect(appMarkup).toContain('id="css-minifier-output"');
        expect(appMarkup).toContain('id="minify-btn"');
        // Article content is prerendered outside the app root (#327),
        // so the interactive bundle no longer carries the static tree.
        expect(afterMarkup).toContain('CSS Minification is the process of removing unnecessary characters such as spaces, line breaks, and comments from CSS code.');
        // The invariant this migration exists for: the article tree must NOT
        // be in the hydrated app markup. Without this, re-adding <Intro/> to a
        // component passes every positive assertion.
        expect(appMarkup).not.toContain('CSS Minification is the process of removing unnecessary characters such as spaces, line breaks, and comments from CSS code.');
        expect(afterMarkup).toContain('What is a CSS Minifier?');
        expect(afterMarkup).toContain('CSS Minifier FAQs');
        expect(afterMarkup).toContain(`href="${SITE_BASE_URL}"`);
        expect(afterMarkup).toContain(`href="${buildSiteHref('/js-minifier/')}"`);
    });

    it('renders text-analyzer app markup for server-side prerender', () => {
        const appMarkup = renderToolPrerenderMarkup('text-analyzer-tool');
        const afterMarkup = renderToolAfterAppPrerenderMarkup('text-analyzer-tool');

        expect(appMarkup).toContain('id="textInput"');
        expect(appMarkup).toContain('id="wordFrequencyChart"');
        expect(appMarkup).toContain('id="load-sample"');
        // Article content is prerendered outside the app root (#327),
        // so the interactive bundle no longer carries the static tree.
        expect(afterMarkup).toContain('The CodeSamplez Text Analyzer is a <strong>free online text analysis tool</strong>');
        // The invariant this migration exists for: the article tree must NOT
        // be in the hydrated app markup. Without this, re-adding <Intro/> to a
        // component passes every positive assertion.
        expect(appMarkup).not.toContain('The CodeSamplez Text Analyzer is a <strong>free online text analysis tool</strong>');
        expect(afterMarkup).toContain('What is a Text Analyzer?');
        expect(afterMarkup).toContain('Text Analyzer FAQs:');
        expect(afterMarkup).toContain(`href="${SITE_BASE_URL}"`);
        expect(afterMarkup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders qr-code-generator app markup for server-side prerender', () => {
        const appMarkup = renderToolPrerenderMarkup('qr-code-generator');
        const afterMarkup = renderToolAfterAppPrerenderMarkup('qr-code-generator');

        expect(appMarkup).toContain('id="qr-text"');
        expect(appMarkup).toContain('id="qr-canvas"');
        expect(appMarkup).toContain('id="download-btn"');
        // Article content is prerendered outside the app root (#327),
        // so the interactive bundle no longer carries the static tree.
        expect(afterMarkup).toContain('The CodeSamplez QR Code Generator is a <strong>free online QR code creator</strong>');
        // The invariant this migration exists for: the article tree must NOT
        // be in the hydrated app markup. Without this, re-adding <Intro/> to a
        // component passes every positive assertion.
        expect(appMarkup).not.toContain('The CodeSamplez QR Code Generator is a <strong>free online QR code creator</strong>');
        expect(afterMarkup).toContain('How To Generate QR Code With This Tool:');
        expect(afterMarkup).toContain('Frequently Asked Questions (FAQs)');
        expect(afterMarkup).toContain(`href="${SITE_BASE_URL}"`);
        expect(afterMarkup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders image-editor app markup for server-side prerender', () => {
        const appMarkup = renderToolPrerenderMarkup('image-editor');
        const afterMarkup = renderToolAfterAppPrerenderMarkup('image-editor');

        expect(appMarkup).toContain('id="image-editor-stage"');
        expect(appMarkup).toContain('id="image-editor-export"');
        expect(appMarkup).toContain('id="image-editor-load-sample"');
        // Article content is prerendered outside the app root (#327),
        // so the interactive bundle no longer carries the static tree.
        expect(afterMarkup).toContain('A browser based image editor is a tool that modifies pictures without desktop software or uploads.');
        // The invariant this migration exists for: the article tree must NOT
        // be in the hydrated app markup. Without this, re-adding <Intro/> to a
        // component passes every positive assertion.
        expect(appMarkup).not.toContain('A browser based image editor is a tool that modifies pictures without desktop software or uploads.');
        expect(afterMarkup).toContain('How To Edit Images With This Tool:');
        expect(afterMarkup).toContain('Frequently Asked Questions (FAQs)');
        expect(afterMarkup).toContain(`href="${SITE_BASE_URL}"`);
        expect(afterMarkup).toContain('href="https://codesamplez.com/contact"');
    });

    it('renders image-editor related-tools markup with pair-specific copy', () => {
        const markup = renderRelatedToolsPrerenderMarkup('image-editor');

        expect(markup).toContain('id="related-tools-heading"');
        expect(markup).toContain('Base64 Converter');
        expect(markup).toContain('QR Code Generator');
        expect(markup).toContain('Encode the edited image as Base64');
        expect(markup).toContain(`href="${buildSiteHref('/base64-converter/')}"`);
        expect(markup).toContain(`href="${buildSiteHref('/qr-code-generator/')}"`);
    });

    it('renders related-tools markup for a representative tool', () => {
        const markup = renderRelatedToolsPrerenderMarkup('jwt-decoder-tool');

        expect(markup).toContain('id="related-tools-heading"');
        expect(markup).toContain('JWT Builder');
        expect(markup).toContain('Base64 Converter');
        expect(markup).toContain(`href="${buildSiteHref('/jwt-builder/')}"`);
        expect(markup).toContain(`href="${buildSiteHref('/base64-converter/')}"`);

        // Framed from the tool the visitor is on, with pair-specific copy
        // rather than each target's SEO meta description.
        expect(markup).toContain('Common follow-ons after using the JWT Decoder &amp; Validator.');
        expect(markup).toContain('Build a new token from these claims');
        expect(markup).toContain('Decode the raw segments yourself');

        // One anchor per card keeps the section a single tab stop per tool.
        expect(markup.match(/<a /g)).toHaveLength(3);
        expect(markup).toContain('c-related-tools__card--encoders');
        expect(markup).toContain('<svg class="cst-icon"');
    });

    it('throws for a tool that is not in the manifest', () => {
        expect(() => renderRelatedToolsPrerenderMarkup('not-a-real-tool'))
            .toThrow('Unknown tool id: not-a-real-tool');
    });

    describe('article content resolution', () => {
        // Both paths exist because preact-render-to-string renders `h(undefined)`
        // as a literal `<undefined></undefined>` instead of throwing, so a
        // renamed or removed export would otherwise ship as broken markup.
        it('throws for a tool that is not in the manifest', () => {
            expect(() => createArticleAfterAppNode('not-a-real-tool')())
                .toThrow('Unknown tool id: not-a-real-tool');
        });

        it('throws when the content module exports no matching component', () => {
            expect(() => resolveContentExport({ SomethingElse: () => null }, 'Intro', 'demo-tool'))
                .toThrow("Expected exactly one *Intro export from demo-tool's content module, found 0");
        });

        it('throws, and names them, when the content module exports several', () => {
            const content = { FirstIntro: () => null, SecondIntro: () => null };

            expect(() => resolveContentExport(content, 'Intro', 'demo-tool'))
                .toThrow("found 2: FirstIntro, SecondIntro");
        });

        it('ignores non-function exports that happen to match the suffix', () => {
            const Component = () => null;
            const content = { ARTICLE_INTRO_ID: 'intro', RealIntro: Component };

            expect(resolveContentExport(content, 'Intro', 'demo-tool')).toBe(Component);
        });
    });


});
