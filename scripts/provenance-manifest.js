// @ts-check

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { getToolDefinitions } = require('./tool-manifest');

const VERSIONS_FILENAME = 'versions.json';
const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Memoized per process: every document in one build (root HTML, all tool
 * HTMLs, versions.json) must stamp the SAME commit, and webpack watch
 * recompiles re-render documents repeatedly — a per-call `git rev-parse` would
 * spawn ~14 subprocesses per build and could resolve different commits
 * mid-build, breaking the "page attribute matches versions.json" invariant.
 * Cleared by `resetBuildCommit()` when a watch-mode recompile starts.
 * @type {string | null}
 */
let memoizedBuildCommit = null;

/**
 * Resolves the git commit SHA for the working tree at build time. Falls back to
 * 'unknown' when git is unavailable (e.g. tarball artifact builds) so HTML
 * generation never fails on provenance metadata.
 * @returns {string}
 */
function resolveBuildCommit() {
    if (memoizedBuildCommit) {
        return memoizedBuildCommit;
    }

    try {
        const result = execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        });
        const commit = result.trim();

        memoizedBuildCommit = /^[0-9a-f]{40}$/u.test(commit) ? commit : 'unknown';
    } catch {
        memoizedBuildCommit = 'unknown';
    }

    return memoizedBuildCommit;
}

/**
 * Drops the memoized commit so the next build resolves HEAD afresh. Called at
 * the start of each watch-mode recompile (see GeneratedHtmlPlugin).
 * @returns {void}
 */
function resetBuildCommit() {
    memoizedBuildCommit = null;
}

/**
 * Byte-stable for a given commit: no wall-clock timestamps. A timestamp would
 * make versions.json differ on every rebuild of the same commit, paying an S3
 * upload + cache invalidation per build for zero information — buildCommit
 * already carries the provenance.
 * @param {string} [buildCommit]
 * @returns {string}
 */
function buildVersionsJson(buildCommit = resolveBuildCommit()) {
    const manifest = {
        buildCommit,
        tools: getToolDefinitions()
            .map((tool) => ({
                id: tool.id,
                version: tool.version
            }))
            .sort((toolA, toolB) => toolA.id.localeCompare(toolB.id))
    };

    return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Writes build/versions.json, the site-wide provenance manifest mapping every
 * tool id to its released version plus the build's source commit. Deployed as
 * a root asset so `https://<site>/versions.json` answers "what is live?" for
 * regression triage.
 * @param {{ buildDir?: string, buildCommit?: string }} [options]
 * @returns {string}
 */
function writeVersionsManifest(options = {}) {
    const buildDir = path.resolve(options.buildDir || path.join(REPO_ROOT, 'build'));
    const outputPath = path.join(buildDir, VERSIONS_FILENAME);

    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(outputPath, buildVersionsJson(options.buildCommit));

    return outputPath;
}

/**
 * @returns {string}
 */
function getBuildCommitAttributeMarkup() {
    const commit = resolveBuildCommit();

    return commit === 'unknown' ? '' : ` data-build-commit="${commit}"`;
}

module.exports = {
    VERSIONS_FILENAME,
    buildVersionsJson,
    getBuildCommitAttributeMarkup,
    resetBuildCommit,
    resolveBuildCommit,
    writeVersionsManifest
};