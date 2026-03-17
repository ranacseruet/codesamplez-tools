// @ts-check

const path = require('path');
const { spawnSync } = require('child_process');
const { parseToolSelectionArgs } = require('./tool-manifest');

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

function main() {
    const args = parseArgs(process.argv.slice(2));
    const selection = parseToolSelectionArgs(args.selectionArgv);
    const hasExplicitSelection = args.selectionArgv.length > 0;
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
        env: process.env,
        stdio: 'inherit'
    });

    if (typeof result.status === 'number') {
        process.exit(result.status);
    }

    process.exit(1);
}

main();
