// @ts-check

const webpack = require('webpack');
const { getAppShellCatalogDefinition } = require('./app-shell-catalog');
const { REPO_ROOT, ROOT_CONFIG_PATH, getToolById, getToolDefinitions, getToolMetadataPath } = require('./tool-manifest');
const { generateRootDocument } = require('./root-document');
const { generateNotFoundDocument } = require('./error-document');
const { generateToolDocument } = require('./tool-document');

// The 404 page ships beside the root index.html, so its emit path mirrors the
// configured rootHtmlAsset (which is '../index.html' from the root-shell build
// and 'index.html' from the combined build).
function resolveNotFoundFilename(rootHtmlAsset) {
    return rootHtmlAsset.replace(/index\.html$/, '404.html');
}

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

        // Branded soft-404 served by CloudFront's custom error response. Emitted
        // with the root assets so it ships and deploys alongside the landing page.
        assets.push({
            filename: resolveNotFoundFilename(options.rootHtmlAsset),
            source: generateNotFoundDocument()
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
