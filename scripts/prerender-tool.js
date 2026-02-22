const path = require('path');

let babelRegistered = false;

function ensureBabelRegister() {
    if (babelRegistered) {
        return;
    }

    require('@babel/register')({
        extensions: ['.js', '.jsx'],
        ignore: [/node_modules/],
        babelrc: false,
        configFile: false,
        presets: [
            ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
            ['@babel/preset-react', { runtime: 'automatic', importSource: 'preact' }]
        ]
    });

    babelRegistered = true;
}

const TOOL_PRERENDER_REGISTRY = {
    'data-format-converter': {
        rootId: 'data-format-converter-app',
        createAppNode: () => {
            const { h } = require('preact');
            const { DataFormatConverter } = require(path.resolve(__dirname, '../data-format-converter/DataFormatConverter.js'));
            const { DataFormatConverterApp } = require(path.resolve(__dirname, '../data-format-converter/script.js'));

            return h(DataFormatConverterApp, {
                converter: new DataFormatConverter()
            });
        }
    },
    'css-minifier-tool': {
        rootId: 'css-minifier-app',
        createAppNode: () => {
            const { h } = require('preact');
            const { CssMinifierApp } = require(path.resolve(__dirname, '../css-minifier-tool/script.js'));
            return h(CssMinifierApp, {});
        }
    },
    'json-formatter-tool': {
        rootId: 'json-formatter-app',
        createAppNode: () => {
            const { h } = require('preact');
            const { JsonFormatterApp } = require(path.resolve(__dirname, '../json-formatter-tool/script.js'));
            return h(JsonFormatterApp, {});
        }
    },
    'text-analyzer-tool': {
        rootId: 'text-analyzer-app',
        createAppNode: () => {
            const { h } = require('preact');
            const { TextAnalyzerApp } = require(path.resolve(__dirname, '../text-analyzer-tool/script.js'));
            return h(TextAnalyzerApp, {});
        }
    },
    'qr-code-generator': {
        rootId: 'qr-code-generator-app',
        createAppNode: () => {
            const { h } = require('preact');
            const { QRCodeGeneratorApp } = require(path.resolve(__dirname, '../qr-code-generator/script.js'));
            return h(QRCodeGeneratorApp, {});
        }
    }
};

function getPrerenderConfig(toolName) {
    return TOOL_PRERENDER_REGISTRY[toolName] || null;
}

function renderToolPrerenderMarkup(toolName) {
    const config = getPrerenderConfig(toolName);
    if (!config) {
        throw new Error(`No prerender config found for tool: ${toolName}`);
    }

    ensureBabelRegister();

    const renderToString = require('preact-render-to-string');
    return renderToString(config.createAppNode());
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function injectToolPrerender(toolName, html) {
    const config = getPrerenderConfig(toolName);
    if (!config) {
        return html;
    }

    const rootPattern = new RegExp(`<div\\s+id=["']${escapeRegExp(config.rootId)}["']\\s*><\\/div>`);
    if (!rootPattern.test(html)) {
        return html;
    }

    const prerenderedMarkup = renderToolPrerenderMarkup(toolName);
    return html.replace(rootPattern, `<div id="${config.rootId}">${prerenderedMarkup}</div>`);
}

function getPrerenderToolNames() {
    return Object.keys(TOOL_PRERENDER_REGISTRY);
}

module.exports = {
    TOOL_PRERENDER_REGISTRY,
    getPrerenderConfig,
    getPrerenderToolNames,
    injectToolPrerender,
    renderToolPrerenderMarkup
};
