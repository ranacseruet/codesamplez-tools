// @ts-check

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getToolIds, normalizeSelection, parseToolSelectionArgs, selectTools } = require('./tool-manifest');
const { assertNoAnalyticsInHtml } = require('./build-verification');
const { writeGeneratedSiteAssets } = require('./generated-site-assets');

function printHelp() {
    console.log('Usage: node scripts/build-tools.js [options] [-- <webpack args>]');
    console.log('');
    console.log('Options:');
    console.log('  --mode <production|development>  Webpack mode (default: production)');
    console.log('  --tool <id>                      Build a single tool');
    console.log('  --tools <id,id>                  Build multiple tools');
    console.log('  --include-root-shell             Include the root shell bundle');
    console.log('  --include-root-assets            Include root-level static assets');
    console.log('  --help, -h                       Show this help');
}

/**
 * @param {string[]} argv
 * @returns {{ mode: string, passthroughArgs: string[], selectionArgv: string[] }}
 */
function parseArgs(argv) {
    let mode = 'production';
    /** @type {string[]} */
    const passthroughArgs = [];
    /** @type {string[]} */
    const selectionArgv = [];

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--mode') {
            mode = argv[index + 1] || mode;
            index += 1;
            continue;
        }

        if (arg === '--tool' || arg === '--tools') {
            selectionArgv.push(arg, argv[index + 1] || '');
            index += 1;
            continue;
        }

        if (arg === '--include-root-shell' || arg === '--include-root-assets') {
            selectionArgv.push(arg);
            continue;
        }

        if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }

        passthroughArgs.push(arg);
    }

    return {
        mode,
        passthroughArgs,
        selectionArgv
    };
}

/**
 * @param {ReturnType<typeof parseToolSelectionArgs>} selection
 * @returns {void}
 */
function removeLegacyToolBuildDirs(selection) {
    const normalizedSelection = normalizeSelection(selection);
    const buildDir = path.resolve(process.cwd(), 'build');

    selectTools(normalizedSelection.requestedTools).forEach((tool) => {
        if (tool.outputDir === tool.id) {
            return;
        }

        fs.rmSync(path.join(buildDir, tool.id), {
            force: true,
            recursive: true
        });
    });
}

/**
 * Fail a non-production build when regenerated HTML contains tracker markup.
 * Only pages this build regenerated are scanned (mirroring the webpack
 * root-shell/root-asset selection) so stale output from an earlier production
 * build never fails a partial development build. Throws on violation; the
 * main() catch turns it into a non-zero exit.
 * @param {string} mode
 * @param {ReturnType<typeof parseToolSelectionArgs>} selection
 * @returns {void}
 */
function assertNonProductionBuildHasNoTrackers(mode, selection) {
    if (mode === 'production') {
        return;
    }

    const buildDir = path.resolve(process.cwd(), 'build');
    const normalizedSelection = normalizeSelection(selection);
    const isFullBuild = normalizedSelection.requestedTools.length === getToolIds().length;
    // Mirror the webpack root-shell/root-asset selection: root HTML is only
    // regenerated when the root shell build runs with root assets included.
    const rootHtmlRegenerated = (selection.includeRootShell || isFullBuild)
        && (selection.includeRootAssets || isFullBuild);

    /** @type {string[]} */
    const htmlFilePaths = selectTools(normalizedSelection.requestedTools)
        .map((tool) => path.join(process.cwd(), tool.outputPath, 'index.html'));

    if (rootHtmlRegenerated) {
        htmlFilePaths.push(path.join(buildDir, 'index.html'), path.join(buildDir, '404.html'));
    }

    assertNoAnalyticsInHtml(htmlFilePaths);
}

function main() {
    return mainAsync().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exit(1);
    });
}

async function mainAsync() {
    const args = parseArgs(process.argv.slice(2));
    // The webpack child receives NODE_ENV explicitly, but the generated root
    // assets (ads.txt, sitemap, robots) are produced in this parent process.
    // Align the parent's NODE_ENV with the build mode so the analytics gate and
    // dev/prod URL resolution stay consistent across both render paths.
    process.env.NODE_ENV = args.mode;
    const selection = parseToolSelectionArgs(args.selectionArgv);
    const hasExplicitSelection = args.selectionArgv.length > 0;
    removeLegacyToolBuildDirs(selection);
    /** @type {string[]} */
    const cliArgs = [
        require.resolve('webpack-cli/bin/cli.js'),
        '--config',
        path.resolve(__dirname, '../webpack.config.js'),
        '--mode',
        args.mode
    ];

    if (hasExplicitSelection) {
        cliArgs.push('--env', 'toolSelection=explicit');
    }

    if (selection.requestedTools.length > 0) {
        cliArgs.push('--env', `tools=${selection.requestedTools.join(',')}`);
    }

    if (selection.includeRootShell) {
        cliArgs.push('--env', 'includeRootShell=true');
    }

    if (selection.includeRootAssets) {
        cliArgs.push('--env', 'includeRootAssets=true');
    }

    const result = spawnSync(process.execPath, [...cliArgs, ...args.passthroughArgs], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            NODE_ENV: args.mode
        },
        stdio: 'inherit'
    });

    if (typeof result.status === 'number') {
        if (result.status !== 0) {
            process.exit(result.status);
        }

        const shouldGenerateRootAssets = selection.includeRootAssets
            || selection.requestedTools.length === 0
            || selection.requestedTools.length === getToolIds().length;

        if (shouldGenerateRootAssets) {
            await writeGeneratedSiteAssets({
                buildDir: path.resolve(process.cwd(), 'build')
            });
        }

        assertNonProductionBuildHasNoTrackers(args.mode, selection);

        process.exit(0);
    }

    process.exit(1);
}

main();
