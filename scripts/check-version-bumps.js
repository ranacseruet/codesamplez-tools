// @ts-check

const path = require('path');
const { execFileSync } = require('child_process');
const {
    TOOL_METADATA_FILENAME,
    getToolMetadataPath,
    getToolDefinitions
} = require('./tool-manifest');
const { parseVersion } = require('./tool-release');
const { detectAffectedTargets, getToolIdForPath, isToolMetadataPath, isAllToolsTrigger, isRootOnlyTrigger } = require('./affected-tools');

const SKIP_LABEL = 'skip-version-bump';
const NON_TOOL_DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt']);

/**
 * Classifies whether a changed file can affect a tool's runtime output and
 * therefore demands a version bump. Changelog/doc edits, the checker itself,
 * and workflow files never demand one.
 *
 * Tool metadata files count when any field other than `version` changed:
 * title/description/publicPath edits prerender into the tool's HTML, so they
 * deploy changed output and must carry a bump. The version comparison below
 * still decides whether the demanded bump actually happened.
 * @param {string} filePath
 * @param {{ previousContent?: string | null, currentContent?: string | null }} [contentSnapshot]
 * @returns {boolean}
 */
function demandsVersionBump(filePath, contentSnapshot = {}) {
    if (filePath === 'scripts/check-version-bumps.js'
        || filePath === 'scripts/tool-release.js'
        || filePath.startsWith('.github/')) {
        return false;
    }

    if (isToolMetadataPath(filePath)) {
        return metadataEditDemandsBump(contentSnapshot);
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
 * A tool.meta.json edit demands a bump unless the *only* changed field is
 * `version` (i.e. the bump commit itself) or `dependencyScopes` (build-only
 * metadata that never reaches rendered output).
 * @param {{ previousContent?: string | null, currentContent?: string | null }} contentSnapshot
 * @returns {boolean}
 */
function metadataEditDemandsBump({ previousContent, currentContent }) {
    const previous = parseMetadataFields(previousContent);
    const current = parseMetadataFields(currentContent);

    if (!previous || !current) {
        // Unreadable side (empty file, invalid JSON): treat as a content edit
        // so a broken metadata write cannot silently skip enforcement.
        return true;
    }

    return BUMP_INERT_METADATA_FIELDS.some((field) => previous[field] !== current[field])
        ? false
        : METADATA_FIELDS.some((field) => previous[field] !== current[field]);
}

const BUMP_INERT_METADATA_FIELDS = ['version', 'dependencyScopes'];

/**
 * Fields whose change is prerendered into the tool page.
 * @param {string | null | undefined} rawContent
 * @returns {Record<string, unknown> | null}
 */
function parseMetadataFields(rawContent) {
    if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
        return null;
    }

    try {
        const parsed = /** @type {unknown} */ (JSON.parse(rawContent));

        return parsed && typeof parsed === 'object' ? /** @type {Record<string, unknown>} */ (parsed) : null;
    } catch {
        return null;
    }
}

/** Fields compared when deciding whether a metadata edit is content-bearing. */
const METADATA_FIELDS = [
    'id',
    'title',
    'seoTitle',
    'description',
    'indexDescription',
    'icon',
    'status',
    'keywords',
    'structuredData',
    'catalogGroupId',
    'catalogOrder',
    'appRootId',
    'publicPath',
    'scriptType',
    'relatedToolIds'
];

/**
 * Reads a tool's version from a specific git revision.
 *
 * Returns null ONLY when the metadata file did not exist at that revision
 * (a newly added tool). Any other failure — unreachable revision, transport
 * error, malformed JSON — throws so enforcement fails loudly instead of
 * waving the change through (the CI step would print "passed" for a tool
 * whose bump was never verified).
 * @param {string} revision
 * @param {string} toolId
 * @returns {string | null}
 */
function readVersionAtRevision(revision, toolId) {
    const absoluteMetadataPath = getToolMetadataPath(toolId);
    const repoRelativePath = path.relative(process.cwd(), absoluteMetadataPath).split(path.sep).join('/');
    const resolved = readGitFileAt(revision, repoRelativePath);

    if (resolved.status === 'absent') {
        return null;
    }

    if (resolved.status === 'error') {
        throw new Error(`Failed to read ${repoRelativePath} at ${revision}: ${resolved.message}`);
    }

    const version = /** @type {{ version?: unknown }} */ (JSON.parse(/** @type {string} */ (resolved.content))).version;

    if (typeof version !== 'string' || version.trim().length === 0) {
        throw new Error(`${repoRelativePath} at ${revision} has no usable version field`);
    }

    return version;
}

/**
 * Reads a file from a git revision, tri-furcating the outcome so callers can
 * distinguish "file not in that revision" (absent) from git/transport
 * failures (error) from success (ok).
 * @param {string} revision
 * @param {string} repoRelativePath
 * @returns {{ status: 'ok', content: string } | { status: 'absent' } | { status: 'error', message: string }}
 */
function readGitFileAt(revision, repoRelativePath) {
    try {
        const content = execFileSync('git', ['show', `${revision}:${repoRelativePath}`], {
            cwd: process.cwd(),
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });

        return { status: 'ok', content };
    } catch (error) {
        const candidate = /** @type {Error & {status?: number, stderr?: string}} */ (error);

        if (isFileAbsentInRevisionError(candidate)) {
            return { status: 'absent' };
        }

        return { status: 'error', message: describeGitError(error) };
    }
}

/**
 * Distinguishes "path did not exist in that revision" (exit 128 whose stderr
 * says so — a new tool) from every other git failure (fail loudly).
 * @param {Error & {status?: number, stderr?: Buffer | string}} error
 * @returns {boolean}
 */
function isFileAbsentInRevisionError(error) {
    const stderr = error.stderr ? String(error.stderr) : String(error.message || '');

    return error.status === 128 && /does not exist in|exists on disk, but not in|pathspec .* did not match/u.test(stderr);
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function describeGitError(error) {
    const candidate = /** @type {Error & {stderr?: string}} */ (error);

    return (typeof candidate.stderr === 'string' && candidate.stderr.trim()) || String(error);
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
 * @param {{ workingVersions?: Record<string, string>, readVersionAt?: typeof readVersionAtRevision, readFileAt?: (revision: string, filePath: string) => string | null }} [options]
 * @returns {string[]}
 */
function findMissingBumps(changedFiles, baseRevision, options = {}) {
    const affectedTargets = detectAffectedTargets(changedFiles);
    const readVersionAt = options.readVersionAt || readVersionAtRevision;
    const readFileAt = options.readFileAt || defaultReadFileAt;
    const workingVersions = options.workingVersions
        || Object.fromEntries(getToolDefinitions().map((tool) => [tool.id, tool.version]));
    const candidates = new Set();

    changedFiles.forEach((filePath) => {
        if (!demandsVersionBump(filePath, {
            previousContent: readFileAt(baseRevision, filePath),
            currentContent: readFileAt('HEAD', filePath)
        })) {
            return;
        }

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
                // New tool: nothing to compare against. The manifest load
                // already guarantees the working version is valid semver.
                return false;
            }

            return compareVersions(workingVersion, baseVersion) <= 0;
        })
        .sort();
}

/**
 * @param {string} revision
 * @param {string} filePath
 * @returns {string | null}
 */
function defaultReadFileAt(revision, filePath) {
    try {
        return execFileSync('git', ['show', `${revision}:${filePath}`], {
            cwd: process.cwd(),
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        });
    } catch {
        return null;
    }
}

module.exports = {
    SKIP_LABEL,
    compareVersions,
    demandsVersionBump,
    findMissingBumps,
    readGitFileAt,
    readVersionAtRevision
};