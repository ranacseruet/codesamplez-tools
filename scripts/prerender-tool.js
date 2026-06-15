// @ts-check

const path = require('path');
const { getRelatedTools } = require('./tool-manifest');
const { ensureBabelRegister } = require('./register-node-transforms');

/**
 * @typedef {import('../common/tooling-contracts').ToolPrerenderConfig} ToolPrerenderConfig
 * @typedef {import('../common/tooling-contracts').ToolPrerenderRegistry} ToolPrerenderRegistry
 */

/** @type {ToolPrerenderRegistry} */
const TOOL_PRERENDER_REGISTRY = {
    'base64-converter-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { Base64ConverterApp } = require(path.resolve(__dirname, '../base64-converter/script'));
            return h(Base64ConverterApp, {});
        }
    },
    'data-format-converter': {
        createAppNode: () => {
            const { h } = require('preact');
            const { DataFormatConverter } = require(path.resolve(__dirname, '../data-format-converter/DataFormatConverter'));
            const { DataFormatConverterApp } = require(path.resolve(__dirname, '../data-format-converter/script'));

            return h(DataFormatConverterApp, {
                converter: new DataFormatConverter()
            });
        }
    },
    'css-minifier-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { CssMinifierApp } = require(path.resolve(__dirname, '../css-minifier/script'));
            return h(CssMinifierApp, {});
        }
    },
    'diff-checker-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { DiffCheckerApp } = require(path.resolve(__dirname, '../diff-checker/script'));
            return h(DiffCheckerApp, {});
        },
        // Tool-first ordering: the About intro renders after the tool (alongside the
        // guide article) rather than above it. Both stay prerendered, so the
        // keyword-rich copy remains crawlable.
        createAfterAppNode: () => {
            const { Fragment, h } = require('preact');
            const { DiffCheckerArticle, DiffCheckerIntro } = require(path.resolve(__dirname, '../diff-checker/content'));
            return h(Fragment, null, h(DiffCheckerIntro, {}), h(DiffCheckerArticle, {}));
        }
    },
    'json-formatter-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { JsonFormatterApp } = require(path.resolve(__dirname, '../json-formatter/script'));
            return h(JsonFormatterApp, {});
        }
    },
    'js-minifier-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { JSMinifierApp } = require(path.resolve(__dirname, '../js-minifier/script'));
            return h(JSMinifierApp, {});
        }
    },
    'jwt-builder-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { JwtBuilderApp } = require(path.resolve(__dirname, '../jwt-builder/script'));
            return h(JwtBuilderApp, {});
        }
    },
    'jwt-decoder-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { JwtDecoderApp } = require(path.resolve(__dirname, '../jwt-decoder/script'));
            return h(JwtDecoderApp, {});
        }
    },
    'text-analyzer-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { TextAnalyzerApp } = require(path.resolve(__dirname, '../text-analyzer/script'));
            return h(TextAnalyzerApp, {});
        }
    },
    'qr-code-generator': {
        createAppNode: () => {
            const { h } = require('preact');
            const { QRCodeGeneratorApp } = require(path.resolve(__dirname, '../qr-code-generator/script'));
            return h(QRCodeGeneratorApp, {});
        }
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
    const relatedTools = getRelatedTools(toolName);

    return renderNodeToMarkup(() => {
        const { h } = require('preact');
        const { RelatedToolsSection } = require(path.resolve(__dirname, '../common/related-tools/RelatedTools'));

        return h(RelatedToolsSection, {
            tools: relatedTools.map((tool) => ({
                id: tool.id,
                title: tool.title,
                description: tool.description,
                publicPath: tool.publicPath
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
    getPrerenderConfig,
    getPrerenderToolNames,
    renderRelatedToolsPrerenderMarkup,
    renderToolAfterAppPrerenderMarkup,
    renderToolBeforeAppPrerenderMarkup,
    renderToolPrerenderMarkup
};
