// @ts-check

const fs = require('fs');
const { execFileSync, spawnSync } = require('child_process');
const { detectAffectedTargets } = require('./affected-tools');

/**
 * @typedef {{
 *   base: string | null,
 *   head: string | null,
 *   changedFiles: string[],
 *   format: 'json' | 'plain',
 *   writeGithubOutput: boolean
 * }} Args
 */

function printHelp() {
    console.log('Usage: node scripts/detect-affected-tools.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --base <sha>             Git diff base ref');
    console.log('  --head <sha>             Git diff head ref');
    console.log('  --changed-file <path>    Add a changed file manually (repeatable)');
    console.log('  --format <json|plain>    Output format (default: json)');
    console.log('  --write-github-output    Write derived values to $GITHUB_OUTPUT');
    console.log('  --help, -h               Show this help');
}

/**
 * @param {string[]} argv
 * @returns {Args}
 */
function parseArgs(argv) {
    /** @type {Args} */
    const args = {
        base: null,
        head: null,
        changedFiles: [],
        format: 'json',
        writeGithubOutput: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--base') {
            args.base = argv[index + 1] || null;
            index += 1;
            continue;
        }

        if (arg === '--head') {
            args.head = argv[index + 1] || null;
            index += 1;
            continue;
        }

        if (arg === '--changed-file') {
            args.changedFiles.push(argv[index + 1] || '');
            index += 1;
            continue;
        }

        if (arg === '--format') {
            const value = argv[index + 1];
            if (value === 'plain' || value === 'json') {
                args.format = value;
            }
            index += 1;
            continue;
        }

        if (arg === '--write-github-output') {
            args.writeGithubOutput = true;
            continue;
        }

        if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }
    }

    return args;
}

/**
 * @param {string} base
 * @param {string} head
 * @returns {string[]}
 */
function getChangedFilesFromGit(base, head) {
    // Report every tracked file as changed. Used when no usable base exists
    // (fresh repo, rewritten history, or a force-pushed base) so callers run a
    // full build instead of failing the git diff.
    const listAllTrackedFiles = () => execFileSync('git', ['ls-files'], {
        cwd: process.cwd(),
        encoding: 'utf8'
    }).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);

    let effectiveBase = base;

    if (/^0+$/u.test(base)) {
        // All-zero base: a fresh or rewritten-history push. Diff against the
        // parent commit when one exists; otherwise fall back to a full build.
        try {
            effectiveBase = execFileSync('git', ['rev-parse', '--verify', `${head}^`], {
                cwd: process.cwd(),
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            }).trim();
        } catch {
            return listAllTrackedFiles();
        }
    } else if (!isAncestorOf(base, head)) {
        // A force-push (rewritten history) leaves `before` outside the pushed
        // commit's ancestry, so diffing against it is meaningless — and whether
        // the old object is still fetchable differs per job, which previously
        // made test-and-build and deploy disagree. Treat any non-ancestor base
        // as a full build so both jobs are deterministic.
        return listAllTrackedFiles();
    }

    try {
        const output = execFileSync('git', ['diff', '--name-only', effectiveBase, head], {
            cwd: process.cwd(),
            encoding: 'utf8'
        });

        return output
            .split(/\r?\n/u)
            .map((line) => line.trim())
            .filter(Boolean);
    } catch {
        return listAllTrackedFiles();
    }
}

/**
 * Whether `base` is an ancestor of `head` (a normal fast-forward push). An
 * unreachable/unknown base is not an ancestor, which callers treat as a
 * full build.
 * @param {string} base
 * @param {string} head
 * @returns {boolean}
 */
function isAncestorOf(base, head) {
    const result = spawnSync('git', ['merge-base', '--is-ancestor', base, head], {
        cwd: process.cwd(),
        stdio: 'ignore'
    });

    return result.status === 0;
}

/**
 * @param {ReturnType<typeof detectAffectedTargets>} result
 * @returns {Record<string, string>}
 */
function createGithubOutputs(result) {
    return {
        affected_tools: result.affectedTools.join(','),
        affected_tool_count: String(result.affectedTools.length),
        affects_all_tools: String(result.scope === 'all-tools'),
        include_root_shell: String(result.includeRootShell),
        include_root_assets: String(result.includeRootAssets),
        should_build: String(result.shouldBuild),
        should_deploy: String(result.shouldDeploy),
        scope: result.scope,
        deploy_paths: result.deployPaths.join(','),
        invalidation_paths: result.invalidationPaths.join(','),
        changed_files: result.changedFiles.join(',')
    };
}

/**
 * @param {Record<string, string>} outputs
 * @returns {void}
 */
function writeGithubOutputs(outputs) {
    const outputPath = process.env.GITHUB_OUTPUT;
    if (!outputPath) {
        throw new Error('GITHUB_OUTPUT is not set');
    }

    const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
    fs.appendFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const changedFiles = args.changedFiles.length > 0
        ? args.changedFiles
        : (args.base && args.head ? getChangedFilesFromGit(args.base, args.head) : []);
    const result = detectAffectedTargets(changedFiles);

    if (args.writeGithubOutput) {
        writeGithubOutputs(createGithubOutputs(result));
    }

    if (args.format === 'plain') {
        console.log(`scope=${result.scope}`);
        console.log(`affectedTools=${result.affectedTools.join(',')}`);
        console.log(`deployPaths=${result.deployPaths.join(',')}`);
        return;
    }

    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
    main();
}

module.exports = {
    getChangedFilesFromGit
};
