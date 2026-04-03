// @ts-check

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { TextEncoder, TextDecoder } = require('util');
const { getRootShellDefinition, getToolById, getToolDefinitions, parseToolSelectionArgs } = require('./tool-manifest');

const BUILD_DIR = path.resolve(__dirname, '../build');
const IGNORE_DIRS = ['assets', 'common'];

/**
 * @typedef {{ tool: string, status: 'passed' | 'failed' | 'skipped', message?: string }} VerificationResult
 */

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

/**
 * @param {string} buildDir
 * @returns {string[]}
 */
function getBuildTools(buildDir) {
    const validBuildDirs = new Set([
        ...getToolDefinitions().map((tool) => tool.outputDir),
        getRootShellDefinition().id
    ]);

    return fs.readdirSync(buildDir).filter((file) => {
        return fs.statSync(path.join(buildDir, file)).isDirectory()
            && !IGNORE_DIRS.includes(file)
            && validBuildDirs.has(file);
    });
}

/**
 * @param {import('jsdom').DOMWindow} window
 * @returns {void}
 */
function installBrowserLikeGlobals(window) {
    window.process = undefined;

    if (!window.TextEncoder) {
        window.TextEncoder = global.TextEncoder || TextEncoder;
    }
    if (!window.TextDecoder) {
        window.TextDecoder = global.TextDecoder || TextDecoder;
    }

    window.matchMedia = window.matchMedia || function (query) {
        return /** @type {MediaQueryList} */ ({
            matches: false,
            media: query,
            onchange: null,
            addListener: function () { },
            removeListener: function () { },
            addEventListener: function () { },
            removeEventListener: function () { },
            dispatchEvent: function () {
                return false;
            }
        });
    };
}

/**
 * @param {string} buildDir
 * @param {string} tool
 * @returns {VerificationResult}
 */
function verifyToolBundle(buildDir, tool) {
    const toolDir = path.join(buildDir, tool);
    const bundlePath = path.join(toolDir, 'bundle.main.js');

    if (!fs.existsSync(bundlePath)) {
        return {
            tool,
            status: 'skipped',
            message: 'bundle.main.js not found'
        };
    }

    console.log(`Verifying ${tool}...`);

    try {
        const bundleContent = fs.readFileSync(bundlePath, 'utf8');

        /** @type {string[]} */
        const runtimeErrors = [];
        const virtualConsole = new VirtualConsole();
        virtualConsole.on('error', (err) => {
            console.error(`${colors.red}[${tool}] Runtime Error: ${err.message}${colors.reset}`);
            runtimeErrors.push(err.message);
        });

        // Setup JSDOM environment
        const dom = new JSDOM(`<!DOCTYPE html><body><div id="app"></div></body>`, {
            runScripts: 'dangerously',
            resources: 'usable',
            virtualConsole
        });

        installBrowserLikeGlobals(dom.window);

        try {
            dom.window.eval(bundleContent);

            if (runtimeErrors.length > 0) {
                return {
                    tool,
                    status: 'failed',
                    message: runtimeErrors.join('; ')
                };
            }

            console.log(`${colors.green}✓ ${tool} passed verification${colors.reset}`);
            return { tool, status: 'passed' };
        } catch (err) {
            console.error(`${colors.red}✗ ${tool} failed verification${colors.reset}`);
            const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
            console.error(`${colors.red}  ${message}${colors.reset}`);
            if (message.includes('process is not defined')) {
                console.error(`${colors.red}  -> Detected 'process is not defined' error! Polyfill missing.${colors.reset}`);
            }
            return { tool, status: 'failed', message };
        }

    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`${colors.red}Error reading/processing ${tool}: ${message}${colors.reset}`);
        return { tool, status: 'failed', message };
    }
}

/**
 * @param {string} buildDir
 * @returns {VerificationResult[]}
 */
function verifyBuild(buildDir) {
    return getBuildTools(buildDir).map((tool) => verifyToolBundle(buildDir, tool));
}

/**
 * @param {string[]} buildTools
 * @param {{ requestedTools: string[], includeRootShell: boolean }} selection
 * @returns {string[]}
 */
function filterBuildTools(buildTools, selection) {
    if (selection.requestedTools.length === 0) {
        return buildTools;
    }

    const allowedTools = new Set(selection.requestedTools.map((toolId) => {
        const tool = getToolById(toolId);
        return tool ? tool.outputDir : toolId;
    }));

    if (selection.includeRootShell) {
        allowedTools.add(getRootShellDefinition().id);
    }

    return buildTools.filter((tool) => allowedTools.has(tool));
}

/**
 * @param {string[]} tools
 * @param {string} buildDir
 * @returns {void}
 */
function assertBuildTargetsExist(tools, buildDir) {
    if (tools.length === 0) {
        throw new Error(`No built tool bundles found in ${buildDir}. Run 'npm run build' first.`);
    }
}

/**
 * @param {string[]} argv
 * @returns {{ buildDir: string, selection: ReturnType<typeof parseToolSelectionArgs> }}
 */
function parseArgs(argv) {
    let buildDir = BUILD_DIR;
    /** @type {string[]} */
    const selectionArgv = [];

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--build-dir') {
            buildDir = path.resolve(process.cwd(), argv[index + 1]);
            index += 1;
            continue;
        }

        if (arg === '--tool' || arg === '--tools') {
            selectionArgv.push(arg, argv[index + 1] || '');
            index += 1;
            continue;
        }

        if (arg === '--include-root-shell') {
            selectionArgv.push(arg);
            continue;
        }
    }

    return {
        buildDir,
        selection: parseToolSelectionArgs(selectionArgv)
    };
}

function main() {
    console.log(`${colors.cyan}Starting Build Verification...${colors.reset}`);
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(args.buildDir)) {
        console.error(`${colors.red}Build directory not found at ${args.buildDir}. Run 'npm run build' first.${colors.reset}`);
        process.exit(1);
    }

    let tools;
    try {
        tools = filterBuildTools(getBuildTools(args.buildDir), args.selection);
        assertBuildTargetsExist(tools, args.buildDir);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${colors.red}${message}${colors.reset}`);
        process.exit(1);
    }

    const results = tools.map((tool) => verifyToolBundle(args.buildDir, tool));
    const errorCount = results.filter((result) => result.status === 'failed').length;
    const successCount = results.filter((result) => result.status === 'passed').length;

    console.log('\nVerification Summary:');
    console.log(`${colors.green}Passed: ${successCount}${colors.reset}`);
    console.log(`${colors.red}Failed: ${errorCount}${colors.reset}`);

    if (errorCount > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

module.exports = {
    assertBuildTargetsExist,
    filterBuildTools,
    getBuildTools,
    installBrowserLikeGlobals,
    main,
    parseArgs,
    verifyToolBundle,
    verifyBuild
};
