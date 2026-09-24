// @ts-check

const webpack = require('webpack');
const { findTrackerMarkupOffenders } = require('./analytics');
const { getAppShellCatalogDefinition } = require('./app-shell-catalog');
const { REPO_ROOT, ROOT_CONFIG_PATH, getToolById, getToolDefinitions, getToolMetadataPath, withRootConfigPass } = require('./tool-manifest');
const { resetBuildCommit } = require('./provenance-manifest');
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
    return withRootConfigPass(() => renderGeneratedHtmlAssets(options));
}

/**
 * @param {GeneratedHtmlPluginOptions} options
 * @returns {{ filename: string, source: string }[]}
 */
function renderGeneratedHtmlAssets(options) {
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

    // Fail-closed guard for every non-production render path — including
    // `npm run dev`, which serves this HTML from memory and never passes
    // through the build-tools.js post-build check. A gate regression fails the
    // compilation loudly instead of silently serving trackers locally.
    if (process.env.NODE_ENV !== 'production') {
        const offenders = findTrackerMarkupOffenders(assets.filter((asset) => asset.filename.endsWith('.html')));

        if (offenders.length > 0) {
            throw new Error(`Tracker markup generated for non-production build: ${offenders.join(', ')}`);
        }
    }

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
        // The build commit is memoized per process so one build stamps one SHA
        // everywhere. A watch-mode recompile is a new build, though: without
        // this reset, commits made while `webpack --watch` runs would keep
        // stamping the SHA from when the watcher started.
        compiler.hooks.watchRun.tap('GeneratedHtmlPlugin', () => {
            resetBuildCommit();
        });

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
