// @ts-check

const path = require('path');
const { execFileSync } = require('child_process');
const {
    getToolMetadataPath,
    getToolDefinitions
} = require('./tool-manifest');
const { detectAffectedTargets, getToolIdForPath, isToolMetadataPath, isAllToolsTrigger, isRootOnlyTrigger } = require('./affected-tools');

const SKIP_LABEL = 'skip-version-bump';
const NON_TOOL_DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt']);

/**
 * Classifies whether a changed file can affect a tool's runtime output and
 * therefore demands a version bump. Changelog/doc edits, the checker itself,
 * and workflow files never demand one.
 * @param {string} filePath
 * @returns {boolean}
 */
function demandsVersionBump(filePath) {
    if (filePath === 'scripts/check-version-bumps.js'
        || filePath === 'scripts/tool-release.js'
        || filePath.startsWith('.github/')) {
        return false;
    }

    if (isToolMetadataPath(filePath)) {
        // Metadata edits other than the version bump itself are content edits
        // handled by the tool-document generators; the version comparison below
        // decides whether the bump happened.
        return false;
    }

    if (isAllToolsTrigger(filePath) || isRootOnlyTrigger(filePath)) {
        // Shared runtime inputs (common/, build config, shared scripts) affect
        // every tool's output; root-only inputs (landing copy, root assets) do
        // not change any tool's runtime bundle.
        return isAllToolsTrigger(filePath);
    }

    const toolId = getToolIdForPath(filePath);

    if (toolId) {
        const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();

        return !NON_TOOL_DOC_EXTENSIONS.has(extension);
    }

    return false;
}

/**
 * Reads a tool's version from a specific git revision. Returns null when the
 * file did not exist at that revision (e.g. a newly added tool).
 * @param {string} revision
 * @param {string} toolId
 * @returns {string | null}
 */
function readVersionAtRevision(revision, toolId) {
    const absoluteMetadataPath = getToolMetadataPath(toolId);
    const repoRelativePath = path.relative(process.cwd(), absoluteMetadataPath).split(path.sep).join('/');

    try {
        const content = execFileSync('git', ['show', `${revision}:${repoRelativePath}`], {
            cwd: process.cwd(),
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        });

        return /** @type {{ version?: unknown }} */ (JSON.parse(content)).version || null;
    } catch {
        return null;
    }
}

/**
 * @param {string} version
 * @returns {[number, number, number]}
 */
function parseVersion(version) {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/u);

    if (!match) {
        throw new Error(`Unsupported version format: ${version}`);
    }

    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Semver comparison: negative when a < b, positive when a > b, 0 when equal.
 * @param {string} versionA
 * @param {string} versionB
 * @returns {number}
 */
function compareVersions(versionA, versionB) {
    const [majorA, minorA, patchA] = parseVersion(versionA);
    const [majorB, minorB, patchB] = parseVersion(versionB);

    return (majorA - majorB) || (minorA - minorB) || (patchA - patchB);
}

/**
 * Computes the tools whose runtime files changed without a version bump.
 * @param {string[]} changedFiles
 * @param {string} baseRevision
 * @param {{ workingVersions?: Record<string, string>, readVersionAt?: typeof readVersionAtRevision }} [options]
 * @returns {string[]}
 */
function findMissingBumps(changedFiles, baseRevision, options = {}) {
    const affectedTargets = detectAffectedTargets(changedFiles);
    const readVersionAt = options.readVersionAt || readVersionAtRevision;
    const workingVersions = options.workingVersions
        || Object.fromEntries(getToolDefinitions().map((tool) => [tool.id, tool.version]));
    const candidates = new Set();

    changedFiles.filter(demandsVersionBump).forEach((filePath) => {
        const toolId = getToolIdForPath(filePath);

        if (toolId) {
            candidates.add(toolId);
        } else {
            // Shared trigger (common/, build config, shared scripts) — every
            // tool's runtime is affected.
            affectedTargets.affectedTools.forEach((toolId) => candidates.add(toolId));
        }
    });

    return Array.from(candidates)
        .filter((toolId) => {
            const baseVersion = readVersionAt(baseRevision, toolId);
            const workingVersion = workingVersions[toolId];

            if (!baseVersion) {
                // New tool or unreadable history: require the working version to
                // be a valid semver, which the manifest load already guarantees.
                return false;
            }

            return compareVersions(workingVersion, baseVersion) <= 0;
        })
        .sort();
}

module.exports = {
    SKIP_LABEL,
    compareVersions,
    demandsVersionBump,
    findMissingBumps,
    readVersionAtRevision
};