// @ts-check

const path = require('path');
const { TOOL_METADATA_FILENAME, getRootAssets, getRootShellDefinition, getToolById, getToolDefinitions, getToolIds } = require('./tool-manifest');

const ALL_TOOL_TRIGGER_FILES = new Set([
    'babel.config.js',
    'package-lock.json',
    'package.json',
    'tsconfig.json',
    'tsconfig.test.json',
    'webpack.config.js',
    'config/tooling-root.json',
    'scripts/analytics.js',
    'scripts/build-tools.js',
    // The deploy script itself. It stamps Cache-Control on every tool directory
    // and every root asset, so a policy change there only reaches production by
    // re-uploading all of them — and with no trigger the detector returns
    // `shouldDeploy: false`, leaving the change inert until some unrelated edit
    // happens to redeploy each object. Its sibling `deploy-cloudfront-function.js`
    // does not need an entry: the workflow greps for that one separately.
    'scripts/deploy-affected-assets.js',
    'scripts/document-helpers.js',
    'scripts/error-document.js',
    // Vendored Lucide icon geometry, inlined into the landing cards and the
    // related-tools cards. Editing a path changes the emitted SVG on every page.
    'scripts/lucide-icons.js',
    'scripts/prerender-tool.js',
    // Configures the Babel register hook the generators use to require TSX at
    // prerender time, so a change here can alter the emitted markup. Pre-existing
    // gap, surfaced by the generator-input guard test in affected-tools.test.js.
    'scripts/register-node-transforms.js',
    // Stamps data-build-commit into tool and root HTML and prerenders
    // build/versions.json. Required by tool-document.js, so a change here can
    // alter every emitted document; without the trigger the detector returns
    // `shouldDeploy: false` and production keeps serving the stale provenance
    // (same silent-staleness trap noted on generated-site-assets.js below).
    'scripts/provenance-manifest.js',
    // Renders the per-tool on-page changelog section into every tool
    // document, so a change to its parsing or markup must rebuild all tool
    // pages (same generator-input rule as tool-document.js).
    'scripts/tool-changelog.js',
    // Pair-specific related-tools copy. Prerendered into every tool document,
    // so a copy-only edit must still rebuild and redeploy them — otherwise it
    // is classified as a no-op and production keeps the old wording, the same
    // silent-staleness trap noted on generated-site-assets.js below.
    'scripts/related-tools-metadata.js',
    'scripts/root-document.js',
    'scripts/structured-data.js',
    // Catalog group -> category accent slug. Feeds the landing cards via
    // root-document.js and the related-tools cards via prerender-tool.js, so it
    // affects the root page and every tool page.
    'scripts/tool-categories.js',
    'scripts/tool-document.js',
    'scripts/tool-faq-metadata.js',
    'scripts/tool-feature-metadata.js',
    'scripts/tool-howto-metadata.js',
    'scripts/tool-manifest.js'
]);

const ROOT_ONLY_TRIGGER_FILES = new Set([
    'root-shell.ts',
    // Generates the root-level SEO/crawler assets (sitemap.xml, robots.txt,
    // llms.txt). Changing it must redeploy those assets; without this trigger a
    // wording/grouping-only edit is classified as a no-op and production goes stale.
    'scripts/generated-site-assets.js',
    // Landing-page intro and post-index section copy. Root-only: it never
    // reaches a tool document, but a wording edit still has to redeploy the
    // root page. Pre-existing gap, surfaced by the generator-input guard test.
    'scripts/root-page-content.js',
    ...getRootAssets()
]);

/**
 * @typedef {{
 *   scope: 'none' | 'selected-tools' | 'all-tools' | 'root-only',
 *   changedFiles: string[],
 *   affectedTools: string[],
 *   includeRootShell: boolean,
 *   includeRootAssets: boolean,
 *   shouldBuild: boolean,
 *   shouldDeploy: boolean,
 *   deployPaths: string[],
 *   invalidationPaths: string[]
 * }} AffectedTargetsResult
 */

/**
 * @param {string} filePath
 * @returns {string}
 */
function normalizeGitPath(filePath) {
    return filePath.split(path.sep).join('/').replace(/^\.\//, '');
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function isToolDocPath(filePath) {
    return filePath.endsWith('/README.md') || filePath.endsWith('.md');
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function isAllToolsTrigger(filePath) {
    return filePath.startsWith('common/') || ALL_TOOL_TRIGGER_FILES.has(filePath);
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function isRootOnlyTrigger(filePath) {
    return ROOT_ONLY_TRIGGER_FILES.has(filePath);
}

/**
 * @param {string} filePath
 * @returns {string | null}
 */
function getToolIdForPath(filePath) {
    return getToolDefinitions().find((tool) => {
        return filePath === tool.sourceRoot || filePath.startsWith(`${tool.sourceRoot}/`);
    })?.id || null;
}

/**
 * @returns {Map<string, string[]>}
 */
function buildReverseRelatedToolMap() {
    const reverseRelatedToolMap = new Map();

    getToolDefinitions().forEach((tool) => {
        tool.relatedToolIds.forEach((relatedToolId) => {
            const reverseRelatedToolIds = reverseRelatedToolMap.get(relatedToolId) || [];
            reverseRelatedToolIds.push(tool.id);
            reverseRelatedToolMap.set(relatedToolId, reverseRelatedToolIds);
        });
    });

    return new Map(
        Array.from(reverseRelatedToolMap.entries()).map(([toolId, reverseRelatedToolIds]) => [
            toolId,
            Array.from(new Set(reverseRelatedToolIds)).sort()
        ])
    );
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function isToolMetadataPath(filePath) {
    return filePath.endsWith(`/${TOOL_METADATA_FILENAME}`);
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function isToolRuntimeChange(filePath) {
    // The tool-local CHANGELOG.md is prerendered into the tool's own page by
    // scripts/tool-changelog.js, so an edit there is a runtime change for
    // that tool — NOT docs-only like README.md or the root CHANGELOG.md
    // (which stays doc-only because getToolIdForPath never maps it).
    return isToolChangelogPath(filePath) || !isToolDocPath(filePath);
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function isToolChangelogPath(filePath) {
    return filePath.endsWith('/CHANGELOG.md') && Boolean(getToolIdForPath(filePath));
}

/**
 * @param {AffectedTargetsResult} result
 * @returns {AffectedTargetsResult}
 */
function finalizeAffectedTargets(result) {
    const deployPaths = new Set();
    const invalidationPaths = new Set();
    const rootShell = getRootShellDefinition();

    result.affectedTools.forEach((toolId) => {
        const tool = getToolById(toolId);
        if (!tool) {
            throw new Error(`Unknown tool id: ${toolId}`);
        }

        deployPaths.add(tool.outputDir);
        invalidationPaths.add(tool.publicPath);
        invalidationPaths.add(`${tool.publicPath}*`);
    });

    if (result.includeRootShell) {
        deployPaths.add(rootShell.id);
        invalidationPaths.add(`/${rootShell.id}/`);
        invalidationPaths.add(`/${rootShell.id}/*`);
    }

    if (result.includeRootAssets) {
        // Derive invalidations from the actual root-asset list so newly added
        // assets (e.g. self-hosted fonts) are invalidated, not just a fixed set.
        getRootAssets().forEach((asset) => {
            deployPaths.add(asset);
            invalidationPaths.add(`/${asset}`);
        });
        invalidationPaths.add('/');
    }

    return {
        ...result,
        deployPaths: Array.from(deployPaths).sort(),
        invalidationPaths: Array.from(invalidationPaths).sort()
    };
}

/**
 * @param {string[]} changedFiles
 * @returns {AffectedTargetsResult}
 */
function detectAffectedTargets(changedFiles) {
    const normalizedFiles = Array.from(new Set(changedFiles.map(normalizeGitPath).filter(Boolean))).sort();
    const affectedTools = new Set();
    const reverseRelatedToolMap = buildReverseRelatedToolMap();
    let includeRootShell = false;
    let includeRootAssets = false;
    let affectsAllTools = false;
    let shouldBuild = false;

    for (const filePath of normalizedFiles) {
        if (isAllToolsTrigger(filePath)) {
            affectsAllTools = true;
            includeRootShell = true;
            includeRootAssets = true;
            shouldBuild = true;
            continue;
        }

        if (isRootOnlyTrigger(filePath)) {
            includeRootShell = true;
            includeRootAssets = true;
            shouldBuild = true;
            continue;
        }

        const toolId = getToolIdForPath(filePath);
        if (!toolId && isToolMetadataPath(filePath)) {
            affectsAllTools = true;
            includeRootShell = true;
            includeRootAssets = true;
            shouldBuild = true;
            continue;
        }

        if (toolId && isToolRuntimeChange(filePath)) {
            affectedTools.add(toolId);
            if (isToolMetadataPath(filePath)) {
                (reverseRelatedToolMap.get(toolId) || []).forEach((reverseRelatedToolId) => {
                    affectedTools.add(reverseRelatedToolId);
                });
                includeRootShell = true;
                includeRootAssets = true;
            }
            shouldBuild = true;
        }
    }

    const resolvedTools = affectsAllTools ? getToolIds() : Array.from(affectedTools).sort();
    /** @type {AffectedTargetsResult} */
    const result = {
        scope: 'none',
        changedFiles: normalizedFiles,
        affectedTools: resolvedTools,
        includeRootShell,
        includeRootAssets,
        shouldBuild,
        shouldDeploy: shouldBuild,
        deployPaths: [],
        invalidationPaths: []
    };

    if (!shouldBuild) {
        return finalizeAffectedTargets(result);
    }

    if (affectsAllTools) {
        result.scope = 'all-tools';
    } else if (resolvedTools.length > 0) {
        result.scope = 'selected-tools';
    } else {
        result.scope = 'root-only';
    }

    return finalizeAffectedTargets(result);
}

module.exports = {
    buildReverseRelatedToolMap,
    detectAffectedTargets,
    getToolIdForPath,
    isToolMetadataPath,
    isToolChangelogPath,
    isAllToolsTrigger,
    isRootOnlyTrigger,
    isToolDocPath,
    isToolRuntimeChange,
    normalizeGitPath
};
