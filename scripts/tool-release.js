// @ts-check

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
    assertValidToolIds,
    getToolById,
    getToolMetadataPath,
    loadManifest,
    parseToolSelectionArgs
} = require('./tool-manifest');

/**
 * @typedef {'major' | 'minor' | 'patch'} ReleaseBumpType
 */

function printHelp() {
    console.log('Usage: node scripts/tool-release.js <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  list                         Print tool versions');
    console.log('  bump --tool <id> --release <patch|minor|major>');
    console.log('  bump --tool <id> --set-version <x.y.z>');
    console.log('  note --tool <id> --version <x.y.z> --note "<text>"');
    console.log('                               Prepend a changelog entry in <tool>/CHANGELOG.md');
    console.log('  tag --tool <id>              Create annotated git tag <tool>/v<version>');
    console.log('');
    console.log('Options:');
    console.log('  --tool <id>                  Select a single tool');
    console.log('  --tools <id,id>              Select multiple tools');
    console.log('  --release <type>             Version bump type');
    console.log('  --set-version <x.y.z>        Explicit version value');
    console.log('  --note <text>                Changelog entry text (note command)');
    console.log('  --version <x.y.z>            Changelog entry version (note command)');
    console.log('  --format <json|plain>        Output format for list (default: plain)');
    console.log('  --dry-run                    Print actions without mutating state');
    console.log('  --help, -h                   Show this help');
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
 * @param {string} currentVersion
 * @param {ReleaseBumpType} bumpType
 * @returns {string}
 */
function bumpVersion(currentVersion, bumpType) {
    const [major, minor, patch] = parseVersion(currentVersion);

    if (bumpType === 'major') {
        return `${major + 1}.0.0`;
    }

    if (bumpType === 'minor') {
        return `${major}.${minor + 1}.0`;
    }

    return `${major}.${minor}.${patch + 1}`;
}

/**
 * @param {string[]} argv
 * @returns {{
 *   command: string | null,
 *   releaseType: ReleaseBumpType | null,
 *   setVersion: string | null,
 *   format: 'json' | 'plain',
 *   dryRun: boolean,
 *   selection: ReturnType<typeof parseToolSelectionArgs>
 * }}
 */
function parseArgs(argv) {
    const command = argv[0] || null;
    /** @type {string | null} */
    let releaseType = null;
    /** @type {string | null} */
    let setVersion = null;
    /** @type {string | null} */
    let noteText = null;
    /** @type {string | null} */
    let noteVersion = null;
    /** @type {'json' | 'plain'} */
    let format = 'plain';
    let dryRun = false;
    /** @type {string[]} */
    const selectionArgv = [];

    for (let index = 1; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--tool' || arg === '--tools') {
            selectionArgv.push(arg, argv[index + 1] || '');
            index += 1;
            continue;
        }

        if (arg === '--release') {
            releaseType = argv[index + 1] || null;
            index += 1;
            continue;
        }

        if (arg === '--set-version') {
            setVersion = argv[index + 1] || null;
            index += 1;
            continue;
        }

        if (arg === '--note') {
            noteText = argv[index + 1] || null;
            index += 1;
            continue;
        }

        if (arg === '--version') {
            noteVersion = argv[index + 1] || null;
            index += 1;
            continue;
        }

        if (arg === '--format') {
            const value = argv[index + 1];
            format = value === 'json' ? 'json' : 'plain';
            index += 1;
            continue;
        }

        if (arg === '--dry-run') {
            dryRun = true;
            continue;
        }

        if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }
    }

    return {
        command,
        releaseType: releaseType === 'major' || releaseType === 'minor' || releaseType === 'patch' ? releaseType : null,
        setVersion,
        noteText,
        noteVersion,
        format,
        dryRun,
        selection: parseToolSelectionArgs(selectionArgv)
    };
}

/**
 * @param {string[]} selectedTools
 * @returns {string[]}
 */
function resolveSelectedTools(selectedTools) {
    if (selectedTools.length === 0) {
        throw new Error('At least one tool must be specified via --tool or --tools');
    }

    return assertValidToolIds(selectedTools);
}

/**
 * Resolves a tool's changelog path. `directoryOverride` exists for tests; the
 * CLI always uses the real tool directory.
 * @param {string} toolId
 * @param {{ directory?: string }} [options]
 * @returns {string}
 */
function getToolChangelogPath(toolId, options = {}) {
    const directory = options.directory || path.dirname(getToolMetadataPath(toolId));

    return path.join(directory, 'CHANGELOG.md');
}

/**
 * @param {string} toolId
 * @param {string} version
 * @param {{ directory?: string }} [options]
 * @returns {boolean}
 */
function changelogHasVersionEntry(toolId, version, options = {}) {
    const changelogPath = getToolChangelogPath(toolId, options);

    if (!fs.existsSync(changelogPath)) {
        return false;
    }

    const entryPattern = new RegExp(`^## \\[${version.replace(/\./gu, '\\.')}\\]`, 'u');
    return fs.readFileSync(changelogPath, 'utf8')
        .split(/\r?\n/u)
        .some((line) => entryPattern.test(line));
}

/**
 * @param {string} toolId
 * @param {string} version
 * @param {string} note
 * @returns {string}
 */
function renderChangelogEntry(toolId, version, note) {
    const tool = getToolById(toolId);
    const title = tool ? tool.title : toolId;
    const date = new Date().toISOString().slice(0, 10);

    return [
        `## [${version}] - ${date}`,
        '',
        `### ${title}`,
        '',
        `- ${note}`,
        ''
    ].join('\n');
}

/**
 * @param {string} toolId
 * @param {string} version
 * @param {string} note
 * @param {boolean} dryRun
 * @param {{ directory?: string }} [options]
 * @returns {void}
 */
function addChangelogNote(toolId, version, note, dryRun, options = {}) {
    const changelogPath = getToolChangelogPath(toolId, options);
    const entry = renderChangelogEntry(toolId, version, note);

    if (dryRun) {
        console.log(`[dry-run] prepend entry to ${changelogPath}:`);
        console.log(entry);
        return;
    }

    if (!fs.existsSync(changelogPath)) {
        fs.writeFileSync(changelogPath, `# Changelog\n\n${entry}`, 'utf8');
        return;
    }

    const existing = fs.readFileSync(changelogPath, 'utf8');
    const headerEnd = existing.indexOf('\n## ');
    const header = headerEnd === -1 ? existing : existing.slice(0, headerEnd);
    const rest = headerEnd === -1 ? '' : existing.slice(headerEnd);

    fs.writeFileSync(changelogPath, `${header.replace(/\s*$/u, '\n\n')}${entry}${rest}`, 'utf8');
}

/**
 * @param {ReturnType<typeof loadManifest>} manifest
 * @param {string[]} selectedTools
 * @returns {Array<{ id: string, version: string }>}
 */
function listToolVersions(manifest, selectedTools) {
    const selectedSet = selectedTools.length > 0 ? new Set(selectedTools) : null;
    return manifest.tools
        .filter((tool) => !selectedSet || selectedSet.has(tool.id))
        .map((tool) => ({ id: tool.id, version: tool.version }));
}

/**
 * @param {string[]} toolIds
 * @param {boolean} dryRun
 * @returns {void}
 */
function createReleaseTags(toolIds, dryRun) {
    const manifest = loadManifest();
    const selectedSet = new Set(toolIds);

    manifest.tools
        .filter((tool) => selectedSet.has(tool.id))
        .forEach((tool) => {
            const tagName = `${tool.id}/v${tool.version}`;
            if (dryRun) {
                console.log(`[dry-run] git tag -a ${tagName} -m "Release ${tagName}"`);
                return;
            }

            const result = spawnSync('git', ['tag', '-a', tagName, '-m', `Release ${tagName}`], {
                cwd: process.cwd(),
                stdio: 'inherit'
            });
            if (result.status !== 0) {
                process.exit(result.status || 1);
            }
        });
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.command) {
        printHelp();
        process.exit(1);
    }

    const manifest = loadManifest();

    if (args.command === 'list') {
        const versions = listToolVersions(manifest, args.selection.requestedTools);
        if (args.format === 'json') {
            console.log(JSON.stringify(versions, null, 2));
            return;
        }

        versions.forEach((tool) => console.log(`${tool.id}: ${tool.version}`));
        return;
    }

    const selectedTools = resolveSelectedTools(args.selection.requestedTools);

    if (args.command === 'bump') {
        if (!args.releaseType && !args.setVersion) {
            throw new Error('Specify --release <patch|minor|major> or --set-version <x.y.z>');
        }

        const selectedSet = new Set(selectedTools);
        const updatedManifest = {
            ...manifest,
            tools: manifest.tools.map((tool) => {
                if (!selectedSet.has(tool.id)) {
                    return tool;
                }

                const nextVersion = args.setVersion || bumpVersion(tool.version, /** @type {ReleaseBumpType} */ (args.releaseType));
                parseVersion(nextVersion);
                return {
                    ...tool,
                    version: nextVersion
                };
            })
        };

        if (args.dryRun) {
            console.log(JSON.stringify(listToolVersions(updatedManifest, selectedTools), null, 2));
            return;
        }

        updatedManifest.tools
            .filter((tool) => selectedSet.has(tool.id))
            .forEach((tool) => {
                const metadataPath = getToolMetadataPath(tool.id);
                const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                metadata.version = tool.version;
                fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
            });
        console.log(`Updated ${selectedTools.join(', ')} tool metadata file(s)`);
        return;
    }

    if (args.command === 'note') {
        if (selectedTools.length !== 1) {
            throw new Error('The note command requires exactly one tool via --tool');
        }

        const noteVersion = args.noteVersion || args.setVersion;
        if (!noteVersion || !parseVersion(noteVersion)) {
            throw new Error('Specify a valid version via --version <x.y.z>');
        }

        if (!args.noteText || args.noteText.trim().length === 0) {
            throw new Error('Specify a changelog entry via --note "<text>"');
        }

        addChangelogNote(selectedTools[0], noteVersion, args.noteText.trim(), args.dryRun);

        if (!args.dryRun) {
            console.log(`Added ${noteVersion} entry to ${getToolChangelogPath(selectedTools[0])}`);
        }
        return;
    }

    if (args.command === 'tag') {
        const missingEntries = selectedTools.filter((toolId) => {
            const tool = manifest.tools.find((candidate) => candidate.id === toolId);
            return !tool || !changelogHasVersionEntry(toolId, tool.version);
        });

        if (missingEntries.length > 0) {
            throw new Error(`Missing changelog entries for ${missingEntries.join(', ')} — run the note command before tagging`);
        }

        createReleaseTags(selectedTools, args.dryRun);
        return;
    }

    throw new Error(`Unknown command: ${args.command}`);
}

if (require.main === module) {
    main();
}

module.exports = {
    addChangelogNote,
    bumpVersion,
    changelogHasVersionEntry,
    createReleaseTags,
    getToolChangelogPath,
    listToolVersions,
    main,
    parseVersion,
    renderChangelogEntry,
    resolveSelectedTools
};
