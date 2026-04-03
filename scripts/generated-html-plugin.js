// @ts-check

const webpack = require('webpack');
const { getAppShellCatalogDefinition } = require('./app-shell-catalog');
const { REPO_ROOT, ROOT_CONFIG_PATH, getToolById, getToolDefinitions, getToolMetadataPath } = require('./tool-manifest');
const { generateRootDocument } = require('./root-document');
const { generateToolDocument } = require('./tool-document');

/**
 * @typedef {{
 *   toolHtmlAssets?: Record<string, string>,
 *   includeRootAssets?: boolean,
 *   rootHtmlAsset?: string | null
 * }} GeneratedHtmlPluginOptions
 */

/**
 * @returns {{ fileDependencies: string[], contextDependencies: string[] }}
 */
function getGeneratedHtmlDependencies() {
    const toolDefinitions = getToolDefinitions();

    return {
        fileDependencies: [
            ROOT_CONFIG_PATH,
            ...toolDefinitions.map((tool) => getToolMetadataPath(tool.id))
        ],
        contextDependencies: [REPO_ROOT]
    };
}

/**
 * @returns {void}
 */
function ensureNodeAppShellCatalog() {
    if (typeof globalThis === 'undefined' || globalThis.__CST_APP_SHELL_CATALOG__) {
        return;
    }

    globalThis.__CST_APP_SHELL_CATALOG__ = getAppShellCatalogDefinition();
}

/**
 * @param {GeneratedHtmlPluginOptions} [options]
 * @returns {{ filename: string, source: string }[]}
 */
function buildGeneratedHtmlAssets(options = {}) {
    ensureNodeAppShellCatalog();

    /** @type {{ filename: string, source: string }[]} */
    const assets = [];
    const toolHtmlAssets = options.toolHtmlAssets || {};

    if (options.includeRootAssets && options.rootHtmlAsset) {
        assets.push({
            filename: options.rootHtmlAsset,
            source: generateRootDocument()
        });
    }

    Object.entries(toolHtmlAssets).forEach(([toolId, filename]) => {
        const tool = getToolById(toolId);
        if (!tool) {
            throw new Error(`Unknown tool id: ${toolId}`);
        }

        assets.push({
            filename,
            source: generateToolDocument(toolId)
        });
    });

    return assets;
}

/**
 * @param {{ fileDependencies: Set<string>, contextDependencies: Set<string> }} compilation
 * @returns {void}
 */
function registerGeneratedHtmlDependencies(compilation) {
    const dependencies = getGeneratedHtmlDependencies();
    dependencies.fileDependencies.forEach((dependencyPath) => compilation.fileDependencies.add(dependencyPath));
    dependencies.contextDependencies.forEach((dependencyPath) => compilation.contextDependencies.add(dependencyPath));
}

class GeneratedHtmlPlugin {
    /**
     * @param {GeneratedHtmlPluginOptions} [options]
     */
    constructor(options = {}) {
        this.options = options;
    }

    /**
     * @param {import('webpack').Compiler} compiler
     * @returns {void}
     */
    apply(compiler) {
        compiler.hooks.thisCompilation.tap('GeneratedHtmlPlugin', (compilation) => {
            registerGeneratedHtmlDependencies(compilation);

            compilation.hooks.processAssets.tap(
                {
                    name: 'GeneratedHtmlPlugin',
                    stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
                },
                () => {
                    buildGeneratedHtmlAssets(this.options).forEach((asset) => {
                        compilation.emitAsset(asset.filename, new webpack.sources.RawSource(asset.source));
                    });
                }
            );
        });
    }
}

module.exports = {
    GeneratedHtmlPlugin,
    buildGeneratedHtmlAssets,
    getGeneratedHtmlDependencies,
    registerGeneratedHtmlDependencies
};
