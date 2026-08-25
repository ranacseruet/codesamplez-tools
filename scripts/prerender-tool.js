// @ts-check

const path = require('path');
const { getRelatedTools, getToolById } = require('./tool-manifest');
const { ensureBabelRegister } = require('./register-node-transforms');
const { renderInlineIcon } = require('./lucide-icons');
const { getGroupCategorySlug } = require('./tool-categories');
const { getRelatedToolReason } = require('./related-tools-metadata');

/**
 * @typedef {import('../common/tooling-contracts').ToolPrerenderConfig} ToolPrerenderConfig
 * @typedef {import('../common/tooling-contracts').ToolPrerenderRegistry} ToolPrerenderRegistry
 */

/**
 * Every tool ships its long-form copy as exactly one `*Intro` and one `*Article`
 * export from `<sourceRoot>/content.tsx`, and since issue #327 all of them are
 * prerendered outside the app root so the hydrated bundle never carries the
 * static tree. The wiring is therefore identical per tool and lives here once
 * rather than in ten near-identical closures — otherwise changing the contract
 * (wrapping the fragment, lazy-loading it, adding a guard) means ten identical
 * edits, and missing one silently ships a page with no About/FAQ copy.
 *
 * Exports are resolved by suffix rather than named per tool because the names
 * are not uniform (`JSMinifierIntro`, `JsonFormatterIntro`, `QRCodeGeneratorIntro`).
 * Resolution is strict: preact-render-to-string renders `h(undefined)` as a
 * literal `<undefined></undefined>` instead of throwing, so a renamed or removed
 * export would otherwise reach production as silently broken markup.
 *
 * @param {string} toolId
 * @returns {() => import('preact').VNode}
 */
function createArticleAfterAppNode(toolId) {
    return () => {
        const { Fragment, h } = require('preact');
        const tool = getToolById(toolId);
        if (!tool) {
            throw new Error(`Unknown tool id: ${toolId}`);
        }

        const content = require(path.resolve(__dirname, `../${tool.sourceRoot}/content`));
        const Intro = resolveContentExport(content, 'Intro', toolId);
        const Article = resolveContentExport(content, 'Article', toolId);

        return h(Fragment, null, h(Intro, {}), h(Article, {}));
    };
}

/**
 * @param {Record<string, unknown>} content
 * @param {string} suffix
 * @param {string} toolId
 * @returns {import('preact').ComponentType<{}>}
 */
function resolveContentExport(content, suffix, toolId) {
    const matches = Object.keys(content).filter(
        (name) => name.endsWith(suffix) && typeof content[name] === 'function'
    );

    if (matches.length !== 1) {
        throw new Error(
            `Expected exactly one *${suffix} export from ${toolId}'s content module, found ${matches.length}` +
            (matches.length ? `: ${matches.join(', ')}` : '')
        );
    }

    return /** @type {import('preact').ComponentType<{}>} */ (content[matches[0]]);
}

/** @type {ToolPrerenderRegistry} */
const TOOL_PRERENDER_REGISTRY = {
    'base64-converter-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { Base64ConverterApp } = require(path.resolve(__dirname, '../base64-converter/script'));
            return h(Base64ConverterApp, {});
        },
        createAfterAppNode: createArticleAfterAppNode('base64-converter-tool')
    },
    'data-format-converter': {
        createAppNode: () => {
            const { h } = require('preact');
            const { DataFormatConverter } = require(path.resolve(__dirname, '../data-format-converter/DataFormatConverter'));
            const { DataFormatConverterApp } = require(path.resolve(__dirname, '../data-format-converter/script'));

            return h(DataFormatConverterApp, {
                converter: new DataFormatConverter()
            });
        },
        createAfterAppNode: createArticleAfterAppNode('data-format-converter')
    },
    'css-minifier-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { CssMinifierApp } = require(path.resolve(__dirname, '../css-minifier/script'));
            return h(CssMinifierApp, {});
        },
        createAfterAppNode: createArticleAfterAppNode('css-minifier-tool')
    },
    'diff-checker-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { DiffCheckerApp } = require(path.resolve(__dirname, '../diff-checker/script'));
            return h(DiffCheckerApp, {});
        },
        createAfterAppNode: createArticleAfterAppNode('diff-checker-tool')
    },
    'json-formatter-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { JsonFormatterApp } = require(path.resolve(__dirname, '../json-formatter/script'));
            return h(JsonFormatterApp, {});
        },
        createAfterAppNode: createArticleAfterAppNode('json-formatter-tool')
    },
    'js-minifier-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { JSMinifierApp } = require(path.resolve(__dirname, '../js-minifier/script'));
            return h(JSMinifierApp, {});
        },
        createAfterAppNode: createArticleAfterAppNode('js-minifier-tool')
    },
    'jwt-builder-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { JwtBuilderApp } = require(path.resolve(__dirname, '../jwt-builder/script'));
            return h(JwtBuilderApp, {});
        },
        createAfterAppNode: createArticleAfterAppNode('jwt-builder-tool')
    },
    'jwt-decoder-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { JwtDecoderApp } = require(path.resolve(__dirname, '../jwt-decoder/script'));
            return h(JwtDecoderApp, {});
        },
        createAfterAppNode: createArticleAfterAppNode('jwt-decoder-tool')
    },
    'text-analyzer-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { TextAnalyzerApp } = require(path.resolve(__dirname, '../text-analyzer/script'));
            return h(TextAnalyzerApp, {});
        },
        createAfterAppNode: createArticleAfterAppNode('text-analyzer-tool')
    },
    'qr-code-generator': {
        createAppNode: () => {
            const { h } = require('preact');
            const { QRCodeGeneratorApp } = require(path.resolve(__dirname, '../qr-code-generator/script'));
            return h(QRCodeGeneratorApp, {});
        },
        createAfterAppNode: createArticleAfterAppNode('qr-code-generator')
    }
};

function getPrerenderConfig(toolName) {
    return TOOL_PRERENDER_REGISTRY[toolName] || null;
}

/**
 * @param {() => import('preact').VNode | null} createNode
 * @returns {string}
 */
function renderNodeToMarkup(createNode) {
    ensureBabelRegister();

    const renderToString = /** @type {(node: import('preact').VNode) => string} */ (
        /** @type {unknown} */ (require('preact-render-to-string'))
    );
    const node = createNode();
    return node ? renderToString(node) : '';
}

/**
 * @param {string} toolName
 * @returns {string}
 */
function renderToolPrerenderMarkup(toolName) {
    const config = getPrerenderConfig(toolName);
    if (!config) {
        throw new Error(`No prerender config found for tool: ${toolName}`);
    }

    return renderNodeToMarkup(() => config.createAppNode());
}

/**
 * @param {string} toolName
 * @returns {string}
 */
function renderToolBeforeAppPrerenderMarkup(toolName) {
    const config = getPrerenderConfig(toolName);
    if (!config) {
        throw new Error(`No prerender config found for tool: ${toolName}`);
    }

    return renderNodeToMarkup(() => config.createBeforeAppNode?.() || null);
}

/**
 * @param {string} toolName
 * @returns {string}
 */
function renderToolAfterAppPrerenderMarkup(toolName) {
    const config = getPrerenderConfig(toolName);
    if (!config) {
        throw new Error(`No prerender config found for tool: ${toolName}`);
    }

    return renderNodeToMarkup(() => config.createAfterAppNode?.() || null);
}

/**
 * @param {string} toolName
 * @returns {string}
 */
function renderRelatedToolsPrerenderMarkup(toolName) {
    // getRelatedTools throws `Unknown tool id` for an unregistered tool, so by
    // this point the lookup cannot miss. The cast records that invariant rather
    // than adding an unreachable guard that duplicates the same error.
    const relatedTools = getRelatedTools(toolName);
    const sourceTool = /** @type {import('./tool-manifest').ToolDefinition} */ (getToolById(toolName));

    return renderNodeToMarkup(() => {
        const { h } = require('preact');
        const { RelatedToolsSection } = require(path.resolve(__dirname, '../common/related-tools/RelatedTools'));

        return h(RelatedToolsSection, {
            sourceToolTitle: sourceTool.title,
            tools: relatedTools.map((tool) => ({
                id: tool.id,
                title: tool.title,
                // Pair-specific handoff copy, not the target's SEO meta
                // description — see scripts/related-tools-metadata.js.
                reason: getRelatedToolReason(toolName, tool.id),
                publicPath: tool.publicPath,
                iconSvg: renderInlineIcon(tool.icon || 'wrench'),
                categorySlug: getGroupCategorySlug(tool.catalogGroupId)
            }))
        });
    });
}

/**
 * @returns {string[]}
 */
function getPrerenderToolNames() {
    return Object.keys(TOOL_PRERENDER_REGISTRY);
}

module.exports = {
    TOOL_PRERENDER_REGISTRY,
    // Exported for tests: both throw paths guard against silently-broken markup,
    // so they are worth exercising directly rather than only through a full render.
    createArticleAfterAppNode,
    resolveContentExport,
    getPrerenderConfig,
    getPrerenderToolNames,
    renderRelatedToolsPrerenderMarkup,
    renderToolAfterAppPrerenderMarkup,
    renderToolBeforeAppPrerenderMarkup,
    renderToolPrerenderMarkup
};
