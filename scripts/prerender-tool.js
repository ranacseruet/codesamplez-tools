// @ts-check

const path = require('path');

/**
 * @typedef {import('../common/tooling-contracts').ToolPrerenderConfig} ToolPrerenderConfig
 * @typedef {import('../common/tooling-contracts').ToolPrerenderRegistry} ToolPrerenderRegistry
 */

let babelRegistered = false;

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
        createAppNode: () => {
            const { h } = require('preact');
            const { Base64ConverterApp } = require(path.resolve(__dirname, '../base64-converter-tool/script'));
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
            const { CssMinifierApp } = require(path.resolve(__dirname, '../css-minifier-tool/script'));
            return h(CssMinifierApp, {});
        }
    },
    'diff-checker-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { DiffCheckerApp } = require(path.resolve(__dirname, '../diff-checker-tool/script'));
            return h(DiffCheckerApp, {});
        }
    },
    'json-formatter-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { JsonFormatterApp } = require(path.resolve(__dirname, '../json-formatter-tool/script'));
            return h(JsonFormatterApp, {});
        }
    },
    'js-minifier-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { JSMinifierApp } = require(path.resolve(__dirname, '../js-minifier-tool/script'));
            return h(JSMinifierApp, {});
        }
    },
    'jwt-builder-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { JwtBuilderApp } = require(path.resolve(__dirname, '../jwt-builder-tool/script'));
            return h(JwtBuilderApp, {});
        }
    },
    'jwt-decoder-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { JwtDecoderApp } = require(path.resolve(__dirname, '../jwt-decoder-tool/script'));
            return h(JwtDecoderApp, {});
        }
    },
    'text-analyzer-tool': {
        createAppNode: () => {
            const { h } = require('preact');
            const { TextAnalyzerApp } = require(path.resolve(__dirname, '../text-analyzer-tool/script'));
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
 * @returns {string[]}
 */
function getPrerenderToolNames() {
    return Object.keys(TOOL_PRERENDER_REGISTRY);
}

module.exports = {
    TOOL_PRERENDER_REGISTRY,
    getPrerenderConfig,
    getPrerenderToolNames,
    renderToolPrerenderMarkup
};
