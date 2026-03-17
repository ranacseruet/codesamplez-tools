// @ts-check

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ROOT_CONFIG_PATH = path.resolve(REPO_ROOT, 'config/tooling-root.json');
const TOOL_METADATA_FILENAME = 'tool.meta.json';

/**
 * @typedef {{
 *   id: string,
 *   version: string,
 *   sourceRoot: string,
 *   outputPath: string,
 *   dependencyScopes: string[]
 * }} ToolDefinition
 * @typedef {{ id: string, outputPath: string }} RootShellDefinition
 * @typedef {{ tools: ToolDefinition[], rootShell: RootShellDefinition, rootAssets: string[] }} ToolManifest
 * @typedef {{ requestedTools: string[], includeRootShell: boolean, includeRootAssets: boolean }} ToolSelection
 */

/**
 * @typedef {{
 *   id: string,
 *   version: string,
 *   dependencyScopes: string[]
 * }} RawToolMetadata
 */

/**
 * @returns {{ rootShell: RootShellDefinition, rootAssets: string[] }}
 */
function loadRootConfig() {
    return JSON.parse(fs.readFileSync(ROOT_CONFIG_PATH, 'utf8'));
}

/**
 * @returns {string[]}
 */
function listToolMetadataPaths() {
    return fs.readdirSync(REPO_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.resolve(REPO_ROOT, entry.name, TOOL_METADATA_FILENAME))
        .filter((metaPath) => fs.existsSync(metaPath))
        .sort();
}

/**
 * @param {string} metadataPath
 * @returns {RawToolMetadata}
 */
function readToolMetadata(metadataPath) {
    return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
}

/**
 * @param {string} metadataPath
 * @returns {ToolDefinition}
 */
function createToolDefinition(metadataPath) {
    const sourceRoot = path.basename(path.dirname(metadataPath));
    const metadata = readToolMetadata(metadataPath);

    return {
        id: metadata.id,
        version: metadata.version,
        sourceRoot,
        outputPath: path.join('build', metadata.id),
        dependencyScopes: metadata.dependencyScopes.slice()
    };
}

/**
 * @returns {ToolDefinition[]}
 */
function getToolDefinitions() {
    return listToolMetadataPaths().map((metadataPath) => createToolDefinition(metadataPath));
}

/**
 * @returns {ToolManifest}
 */
function loadManifest() {
    const rootConfig = loadRootConfig();
    return {
        tools: getToolDefinitions(),
        rootShell: rootConfig.rootShell,
        rootAssets: rootConfig.rootAssets.slice()
    };
}

/**
 * @returns {string[]}
 */
function getToolIds() {
    return getToolDefinitions().map((tool) => tool.id);
}

/**
 * @param {string} toolId
 * @returns {ToolDefinition | undefined}
 */
function getToolById(toolId) {
    return getToolDefinitions().find((tool) => tool.id === toolId);
}

/**
 * @param {string} toolId
 * @returns {string}
 */
function getToolMetadataPath(toolId) {
    const tool = getToolById(toolId);
    if (!tool) {
        throw new Error(`Unknown tool id: ${toolId}`);
    }

    return path.resolve(REPO_ROOT, tool.sourceRoot, TOOL_METADATA_FILENAME);
}

/**
 * @returns {RootShellDefinition}
 */
function getRootShellDefinition() {
    return loadManifest().rootShell;
}

/**
 * @returns {string[]}
 */
function getRootAssets() {
    return loadManifest().rootAssets.slice();
}

/**
 * @param {string | undefined} value
 * @returns {string[]}
 */
function splitCsv(value) {
    if (!value) {
        return [];
    }

    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

/**
 * @param {string[]} toolIds
 * @returns {string[]}
 */
function dedupeToolIds(toolIds) {
    return Array.from(new Set(toolIds));
}

/**
 * @param {string[]} requestedTools
 * @returns {string[]}
 */
function assertValidToolIds(requestedTools) {
    const knownTools = new Set(getToolIds());
    const invalidTools = requestedTools.filter((tool) => !knownTools.has(tool));

    if (invalidTools.length > 0) {
        throw new Error(`Unknown tool id(s): ${invalidTools.join(', ')}`);
    }

    return requestedTools;
}

/**
 * @param {string[]} argv
 * @returns {ToolSelection}
 */
function parseToolSelectionArgs(argv) {
    /** @type {ToolSelection} */
    const selection = {
        requestedTools: [],
        includeRootShell: false,
        includeRootAssets: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--tool') {
            selection.requestedTools.push(argv[index + 1] || '');
            index += 1;
            continue;
        }

        if (arg === '--tools') {
            selection.requestedTools.push(...splitCsv(argv[index + 1]));
            index += 1;
            continue;
        }

        if (arg === '--include-root-shell') {
            selection.includeRootShell = true;
            continue;
        }

        if (arg === '--include-root-assets') {
            selection.includeRootAssets = true;
            continue;
        }
    }

    selection.requestedTools = assertValidToolIds(dedupeToolIds(selection.requestedTools));
    return selection;
}

/**
 * @param {ToolSelection} selection
 * @returns {ToolSelection}
 */
function normalizeSelection(selection) {
    return {
        requestedTools: selection.requestedTools.length > 0 ? selection.requestedTools : getToolIds(),
        includeRootShell: selection.includeRootShell,
        includeRootAssets: selection.includeRootAssets
    };
}

/**
 * @param {string[]} requestedTools
 * @returns {ToolDefinition[]}
 */
function selectTools(requestedTools) {
    const requestedSet = new Set(assertValidToolIds(dedupeToolIds(requestedTools)));
    return getToolDefinitions().filter((tool) => requestedSet.has(tool.id));
}

module.exports = {
    ROOT_CONFIG_PATH,
    REPO_ROOT,
    TOOL_METADATA_FILENAME,
    assertValidToolIds,
    dedupeToolIds,
    getRootAssets,
    getRootShellDefinition,
    getToolById,
    getToolDefinitions,
    getToolIds,
    getToolMetadataPath,
    loadManifest,
    loadRootConfig,
    normalizeSelection,
    parseToolSelectionArgs,
    selectTools,
    splitCsv
};
