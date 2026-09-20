// @ts-check

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { getToolDefinitions } = require('./tool-manifest');

const VERSIONS_FILENAME = 'versions.json';
const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Resolves the git commit SHA for the working tree at build time. Falls back to
 * 'unknown' when git is unavailable (e.g. tarball artifact builds) so HTML
 * generation never fails on provenance metadata.
 * @returns {string}
 */
function resolveBuildCommit() {
    try {
        const result = execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        });
        const commit = result.trim();

        return /^[0-9a-f]{40}$/u.test(commit) ? commit : 'unknown';
    } catch {
        return 'unknown';
    }
}

/**
 * @param {string} [buildCommit]
 * @param {string} [generatedAt]
 * @returns {string}
 */
function buildVersionsJson(buildCommit = resolveBuildCommit(), generatedAt = new Date().toISOString()) {
    const manifest = {
        generatedAt,
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
 * @param {{ buildDir?: string, buildCommit?: string, generatedAt?: string }} [options]
 * @returns {string}
 */
function writeVersionsManifest(options = {}) {
    const buildDir = path.resolve(options.buildDir || path.join(REPO_ROOT, 'build'));
    const outputPath = path.join(buildDir, VERSIONS_FILENAME);

    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(outputPath, buildVersionsJson(options.buildCommit, options.generatedAt));

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
    resolveBuildCommit,
    writeVersionsManifest
};