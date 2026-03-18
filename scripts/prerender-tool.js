// @ts-check

const path = require('path');

/**
 * @typedef {import('../common/tooling-contracts').ToolPrerenderConfig} ToolPrerenderConfig
 * @typedef {import('../common/tooling-contracts').ToolPrerenderRegistry} ToolPrerenderRegistry
 */

let babelRegistered = false;
const FEATURED_IMAGE_RELATIVE_PATH = 'images/featured.png';

/**
 * @returns {void}
 */
function ensureBabelRegister() {
    if (babelRegistered) {
        return;
    }

    require('@babel/register')({
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        ignore: [/node_modules/],
        babelrc: false,
        configFile: false,
        presets: [
            ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
            ['@babel/preset-react', { runtime: 'automatic', importSource: 'preact' }],
            ['@babel/preset-typescript', { allowDeclareFields: true }]
        ]
    });

    babelRegistered = true;
}

/** @type {ToolPrerenderRegistry} */
const TOOL_PRERENDER_REGISTRY = {
    'base64-converter-tool': {
        rootId: 'base64converter-app',
        createAppNode: () => {
            const { h } = require('preact');
            const { Base64ConverterApp } = require(path.resolve(__dirname, '../base64-converter-tool/script'));
            return h(Base64ConverterApp, {});
        }
    },
    'data-format-converter': {
        rootId: 'data-format-converter-app',
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
        rootId: 'css-minifier-app',
        createAppNode: () => {
            const { h } = require('preact');
            const { CssMinifierApp } = require(path.resolve(__dirname, '../css-minifier-tool/script'));
            return h(CssMinifierApp, {});
        }
    },
    'diff-checker-tool': {
        rootId: 'diff-checker-app',
        createAppNode: () => {
            const { h } = require('preact');
            const { DiffCheckerApp } = require(path.resolve(__dirname, '../diff-checker-tool/script'));
            return h(DiffCheckerApp, {});
        }
    },
    'json-formatter-tool': {
        rootId: 'json-formatter-app',
        createAppNode: () => {
            const { h } = require('preact');
            const { JsonFormatterApp } = require(path.resolve(__dirname, '../json-formatter-tool/script'));
            return h(JsonFormatterApp, {});
        }
    },
    'js-minifier-tool': {
        rootId: 'js-minifier-app',
        createAppNode: () => {
            const { h } = require('preact');
            const { JSMinifierApp } = require(path.resolve(__dirname, '../js-minifier-tool/script'));
            return h(JSMinifierApp, {});
        }
    },
    'jwt-builder-tool': {
        rootId: 'jwt-builder-app',
        createAppNode: () => {
            const { h } = require('preact');
            const { JwtBuilderApp } = require(path.resolve(__dirname, '../jwt-builder-tool/script'));
            return h(JwtBuilderApp, {});
        }
    },
    'jwt-decoder-tool': {
        rootId: 'jwt-decoder-app',
        createAppNode: () => {
            const { h } = require('preact');
            const { JwtDecoderApp } = require(path.resolve(__dirname, '../jwt-decoder-tool/script'));
            return h(JwtDecoderApp, {});
        }
    },
    'text-analyzer-tool': {
        rootId: 'text-analyzer-app',
        createAppNode: () => {
            const { h } = require('preact');
            const { TextAnalyzerApp } = require(path.resolve(__dirname, '../text-analyzer-tool/script'));
            return h(TextAnalyzerApp, {});
        }
    },
    'qr-code-generator': {
        rootId: 'qr-code-generator-app',
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
 * @param {string} toolName
 * @returns {string}
 */
function renderToolPrerenderMarkup(toolName) {
    const config = getPrerenderConfig(toolName);
    if (!config) {
        throw new Error(`No prerender config found for tool: ${toolName}`);
    }

    ensureBabelRegister();

    const renderToString = /** @type {(node: import('preact').VNode) => string} */ (
        /** @type {unknown} */ (require('preact-render-to-string'))
    );
    return renderToString(config.createAppNode());
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtmlAttribute(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * @param {string} toolName
 * @param {string} html
 * @returns {string}
 */
function injectToolFeaturedImageMetadata(toolName, html) {
    if (!/<\/head>/i.test(html)) {
        return html;
    }

    if (/property=["']og:image["']/i.test(html) || /name=["']twitter:image["']/i.test(html)) {
        return html;
    }

    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const title = (titleMatch?.[1] || toolName).trim();
    const escapedTitle = escapeHtmlAttribute(title);
    const escapedAlt = escapeHtmlAttribute(`${title} featured image`);
    const escapedImagePath = escapeHtmlAttribute(FEATURED_IMAGE_RELATIVE_PATH);
    const metadataMarkup = [
        `    <meta property="og:type" content="website">`,
        `    <meta property="og:title" content="${escapedTitle}">`,
        `    <meta property="og:image" content="${escapedImagePath}">`,
        `    <meta property="og:image:alt" content="${escapedAlt}">`,
        `    <meta name="twitter:card" content="summary_large_image">`,
        `    <meta name="twitter:title" content="${escapedTitle}">`,
        `    <meta name="twitter:image" content="${escapedImagePath}">`,
        `    <meta name="twitter:image:alt" content="${escapedAlt}">`,
        `    <link rel="image_src" href="${escapedImagePath}">`
    ].join('\n');

    return html.replace(/<\/head>/i, `${metadataMarkup}\n</head>`);
}

/**
 * @param {string} toolName
 * @param {string} html
 * @returns {string}
 */
function injectToolPrerender(toolName, html) {
    const config = getPrerenderConfig(toolName);
    let transformedHtml = injectToolFeaturedImageMetadata(toolName, html);
    if (!config) {
        return transformedHtml;
    }

    const rootPattern = new RegExp(`<div\\s+id=["']${escapeRegExp(config.rootId)}["']\\s*><\\/div>`);
    if (!rootPattern.test(transformedHtml)) {
        return transformedHtml;
    }

    const prerenderedMarkup = renderToolPrerenderMarkup(toolName);
    return transformedHtml.replace(rootPattern, `<div id="${config.rootId}">${prerenderedMarkup}</div>`);
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
    injectToolFeaturedImageMetadata,
    injectToolPrerender,
    renderToolPrerenderMarkup
};
