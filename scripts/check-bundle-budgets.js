// @ts-check

const fs = require('fs');
const path = require('path');
const { getToolById, getToolByOutputDir, getToolDefinitions, parseToolSelectionArgs } = require('./tool-manifest');
const { sumAsyncChunkRawBytes } = require('./bundle-chunk-utils');

const DEFAULT_BUILD_DIR = path.resolve(__dirname, '../build');
const DEFAULT_WARN_PERCENT = 5;
const DEFAULT_FAIL_PERCENT = 10;

// Section 9.1 baselines from docs/archive/post-migration-modernization-execution-plan.md.
// `data-format-converter` and `diff-checker-tool` were refreshed when the per-tool
// social share rail (common/app-shell/ShareBar.tsx) landed: it adds ~5–7 KB of
// inline brand SVGs + preact/hooks to every tool bundle, and main was already ~8%
// over both original frozen baselines, so these values reflect the new expected
// size rather than masking a regression.
/** @type {Readonly<Record<string, number>>} */
const JS_RAW_BASELINES = Object.freeze({
    'js-minifier-tool': 857058,
    'data-format-converter': 160784,
    'diff-checker-tool': 72558,
    'jwt-builder-tool': 77707,
    'jwt-decoder-tool': 78448,
    'base64-converter-tool': 100367,
    'json-formatter-tool': 79715,
    'css-minifier-tool': 61713,
    'text-analyzer-tool': 51949,
    'qr-code-generator': 91896
});

/**
 * @typedef {{ buildDir: string, warnPct: number, failPct: number, waiverSpecs: string[], selection: ReturnType<typeof parseToolSelectionArgs> }} BudgetArgs
 * @typedef {'OK' | 'WARN' | 'FAIL' | 'WAIVED_FAIL' | 'MISSING'} BudgetStatus
 * @typedef {{ tool: string, baseline: number, current: number | null, warnThreshold: number, failThreshold: number, delta: number | null, asyncBytes: number, status: BudgetStatus }} BudgetResult
 */

function printHelp() {
    console.log('Usage: node scripts/check-bundle-budgets.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --build-dir <path>       Build directory (default: ./build)');
    console.log('  --tool <id>              Check a single tool budget');
    console.log('  --tools <id,id>          Check multiple tool budgets');
    console.log('  --warn-pct <number>      Warning threshold percent (default: 5)');
    console.log('  --fail-pct <number>      Failure threshold percent (default: 10)');
    console.log('  --waive <spec>           Comma-separated waiver spec, e.g. "tool-a=JIRA-123,tool-b"');
    console.log('  --help, -h               Show this help');
    console.log('');
    console.log('Env:');
    console.log('  BUNDLE_BUDGET_WAIVERS    Same format as --waive (merged with CLI waivers)');
}

/**
 * @param {string[]} argv
 * @returns {BudgetArgs}
 */
function parseArgs(argv) {
    /** @type {BudgetArgs} */
    const args = {
        buildDir: DEFAULT_BUILD_DIR,
        warnPct: DEFAULT_WARN_PERCENT,
        failPct: DEFAULT_FAIL_PERCENT,
        waiverSpecs: [],
        selection: parseToolSelectionArgs([])
    };
    /** @type {string[]} */
    const selectionArgv = [];

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--build-dir') {
            args.buildDir = path.resolve(process.cwd(), argv[index + 1]);
            index += 1;
            continue;
        }

        if (arg === '--warn-pct') {
            args.warnPct = Number(argv[index + 1]);
            index += 1;
            continue;
        }

        if (arg === '--fail-pct') {
            args.failPct = Number(argv[index + 1]);
            index += 1;
            continue;
        }

        if (arg === '--waive') {
            args.waiverSpecs.push(argv[index + 1] || '');
            index += 1;
            continue;
        }

        if (arg === '--tool' || arg === '--tools') {
            selectionArgv.push(arg, argv[index + 1] || '');
            index += 1;
            continue;
        }

        if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }
    }

    args.selection = parseToolSelectionArgs(selectionArgv);
    return args;
}

/**
 * @param {number} value
 * @returns {string}
 */
function formatNumber(value) {
    return value.toLocaleString('en-US');
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function isDirectory(filePath) {
    try {
        return fs.statSync(filePath).isDirectory();
    } catch (_error) {
        return false;
    }
}

/**
 * @param {string} spec
 * @returns {string[]}
 */
function splitWaiverSpec(spec) {
    return spec
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}

/**
 * @param {string[]} specs
 * @returns {Map<string, string>}
 */
function parseWaivers(specs) {
    const waiverMap = new Map();

    specs.forEach((spec) => {
        splitWaiverSpec(spec).forEach((entry) => {
            let tool = entry;
            let reason = 'waived';

            if (entry.includes('=')) {
                const [left, ...rest] = entry.split('=');
                tool = left.trim();
                reason = rest.join('=').trim() || reason;
            } else if (entry.includes(':')) {
                const [left, ...rest] = entry.split(':');
                tool = left.trim();
                reason = rest.join(':').trim() || reason;
            }

            if (tool) {
                waiverMap.set(tool, reason);
            }
        });
    });

    return waiverMap;
}

/**
 * @param {string} buildDir
 * @returns {string[]}
 */
function listBundleToolDirs(buildDir) {
    const validToolDirs = new Set(getToolDefinitions().map((tool) => tool.outputDir));

    return fs.readdirSync(buildDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((toolName) => validToolDirs.has(toolName))
        .filter((toolName) => fs.existsSync(path.join(buildDir, toolName, 'bundle.main.js')))
        .sort();
}

/**
 * @param {BudgetArgs} args
 * @returns {void}
 */
function validateConfig(args) {
    if (!isDirectory(args.buildDir)) {
        console.error(`Build directory not found: ${args.buildDir}`);
        console.error("Run 'npm run build' first.");
        process.exit(1);
    }

    if (!Number.isFinite(args.warnPct) || args.warnPct <= 0) {
        console.error(`Invalid --warn-pct value: ${args.warnPct}`);
        process.exit(1);
    }

    if (!Number.isFinite(args.failPct) || args.failPct <= 0) {
        console.error(`Invalid --fail-pct value: ${args.failPct}`);
        process.exit(1);
    }

    if (args.failPct <= args.warnPct) {
        console.error(`--fail-pct must be greater than --warn-pct (received warn=${args.warnPct}, fail=${args.failPct})`);
        process.exit(1);
    }
}

/**
 * @param {number} baseline
 * @param {number} percent
 * @returns {number}
 */
function createThreshold(baseline, percent) {
    return Math.ceil(baseline * (1 + percent / 100));
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    validateConfig(args);

    const envWaivers = process.env.BUNDLE_BUDGET_WAIVERS ? [process.env.BUNDLE_BUDGET_WAIVERS] : [];
    const waivers = parseWaivers([...envWaivers, ...args.waiverSpecs]);
    const baselineTools = (args.selection.requestedTools.length > 0
        ? args.selection.requestedTools
        : Object.keys(JS_RAW_BASELINES)
    ).sort();
    const builtTools = listBundleToolDirs(args.buildDir).map((toolDir) => {
        return getToolByOutputDir(toolDir)?.id || toolDir;
    });
    const untrackedBuiltTools = builtTools.filter((tool) => !JS_RAW_BASELINES[tool]);
    /** @type {BudgetResult[]} */
    const results = [];
    const errors = [];
    const warnings = [];

    baselineTools.forEach((tool) => {
        const baseline = JS_RAW_BASELINES[tool];
        const warnThreshold = createThreshold(baseline, args.warnPct);
        const failThreshold = createThreshold(baseline, args.failPct);
        const buildDirName = getToolById(tool)?.outputDir || tool;
        const toolDir = path.join(args.buildDir, buildDirName);
        const bundlePath = path.join(toolDir, 'bundle.main.js');
        const asyncBytes = sumAsyncChunkRawBytes(toolDir);

        if (!fs.existsSync(bundlePath)) {
            errors.push(`[missing] ${tool}: ${bundlePath} not found`);
            results.push({
                tool,
                baseline,
                current: null,
                warnThreshold,
                failThreshold,
                delta: null,
                asyncBytes,
                status: 'MISSING'
            });
            return;
        }

        const current = fs.statSync(bundlePath).size;
        const delta = current - baseline;
        const isWarn = current > warnThreshold;
        const isFail = current > failThreshold;
        const waiverReason = waivers.get(tool);
        const isWaived = Boolean(waiverReason);
        /** @type {BudgetStatus} */
        let status = 'OK';

        if (isFail) {
            if (isWaived) {
                status = 'WAIVED_FAIL';
                warnings.push(`[waived-fail] ${tool}: ${formatNumber(current)} > fail ${formatNumber(failThreshold)} (${waiverReason})`);
            } else {
                status = 'FAIL';
                errors.push(`[fail] ${tool}: ${formatNumber(current)} > fail ${formatNumber(failThreshold)}`);
            }
        } else if (isWarn) {
            status = 'WARN';
            warnings.push(`[warn] ${tool}: ${formatNumber(current)} > warn ${formatNumber(warnThreshold)}`);
        }

        results.push({
            tool,
            baseline,
            current,
            warnThreshold,
            failThreshold,
            delta,
            asyncBytes,
            status
        });
    });

    untrackedBuiltTools.forEach((tool) => {
        warnings.push(`[untracked-tool] ${tool}: no JS baseline budget configured; skipped from enforcement`);
    });

    waivers.forEach((_reason, tool) => {
        if (!JS_RAW_BASELINES[tool]) {
            warnings.push(`[unknown-waiver] ${tool}: waiver specified for tool without baseline entry`);
        }
    });

    console.log(`Bundle budget check (raw JS bytes): warn +${args.warnPct}% / fail +${args.failPct}%`);
    console.log('Enforcement is on the main bundle only. Async = total raw bytes of worker/code-split chunks (informational).');
    console.log('');
    console.log('| Tool | Baseline | Current | Warn | Fail | Delta | Async | Status |');
    console.log('|---|---:|---:|---:|---:|---:|---:|---|');
    results.forEach((result) => {
        const deltaLabel = result.delta === null
            ? 'n/a'
            : `${result.delta >= 0 ? '+' : ''}${formatNumber(result.delta)}`;
        const currentLabel = result.current === null ? 'n/a' : formatNumber(result.current);
        const asyncLabel = result.asyncBytes > 0 ? formatNumber(result.asyncBytes) : '—';

        console.log(`| \`${result.tool}\` | ${formatNumber(result.baseline)} | ${currentLabel} | ${formatNumber(result.warnThreshold)} | ${formatNumber(result.failThreshold)} | ${deltaLabel} | ${asyncLabel} | ${result.status} |`);
    });

    if (warnings.length > 0) {
        console.log('');
        console.log('Warnings:');
        warnings.forEach((warning) => console.log(`- ${warning}`));
    }

    if (errors.length > 0) {
        console.error('');
        console.error('Errors:');
        errors.forEach((error) => console.error(`- ${error}`));
        console.error('');
        console.error('Bundle budget check failed.');
        process.exit(1);
    }

    console.log('');
    console.log('Bundle budget check passed.');
}

main();
