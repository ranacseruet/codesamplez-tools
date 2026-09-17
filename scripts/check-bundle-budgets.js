// @ts-check

const fs = require('fs');
const path = require('path');
const { getToolById, getToolByOutputDir, getToolDefinitions, parseToolSelectionArgs } = require('./tool-manifest');
const { sumAsyncChunkRawBytes } = require('./bundle-chunk-utils');

const DEFAULT_BUILD_DIR = path.resolve(__dirname, '../build');
const DEFAULT_WARN_PERCENT = 5;
const DEFAULT_FAIL_PERCENT = 10;

// Frozen bundle size baselines from the post-migration modernization program.
// `data-format-converter` and `diff-checker-tool` were refreshed when the per-tool
// social share rail (common/app-shell/ShareBar.tsx) landed: it adds ~5–7 KB of
// inline brand SVGs + preact/hooks to every tool bundle, and main was already ~8%
// over both original frozen baselines, so these values reflect the new expected
// size rather than masking a regression.
//
// `js-minifier-tool` dropped from 857,058 to ~54 KB when the Babel engine was
// code-split behind `./load-minifier` (issue #396): the engine is now a lazy
// chunk (counted in the Async column, not enforced — see measure/budget split).
// This baseline tracks the new initial bundle only.
//
// `css-minifier-tool` was refreshed (issue #60) from 61,713: accumulated drift
// from the ShareBar social rail + DS work had already pushed main to ~67.7 KB
// (a tolerated WARN against the stale baseline), and the inline validation-error
// markup added here is ~240 bytes more. This value reflects the new expected
//
// `data-format-converter` was refreshed from 160,784 to 181,680 (PR #442) due
// to the upgrade of `fast-xml-parser` from 5.8.0 to 5.10.1, which pulled in new
// transitive dependencies like `@nodable/entities@3`, `anynum`, and `is-unsafe`.
//
// `diff-checker-tool` was refreshed from 72,558 to 82,970 (UI v4 Phase C): the
// tool gained the shared CopyButton overlay on its output well (previously the
// only tool with no copy affordance), the new common/shortcut-utils module
// (⌘⏎ primary-action contract), and the two-pane Load Sample + `.c-empty-state`
// markup — the same kind of sanctioned per-phase growth as the ShareBar rail
// above. Main had already drifted to 77,284 (tolerated WARN), so this value
// reflects the new expected size rather than masking a regression.
//
// `css-minifier-tool` (67,919 -> 71,459) and `js-minifier-tool` (53,969 ->
// 58,348) were refreshed for UI v4 Phase D, which adds the shared
// common/drop-zone.ts module (drag-and-drop file loading) plus each tool's
// drop handler. Both were already sitting just under their warn lines
// (js-minifier had 534 bytes of headroom), so the ~2 KB module tipped them
// over. The module is deliberately polyfill-free — an early version used
// `Array.from(...).includes(...)`, which dragged the core-js iterator chain
// into every consuming bundle for ~15 KB each; see the comment on
// `dragCarriesFiles`. The other five tools that gained the same module
// (json-formatter, diff-checker, text-analyzer, base64-converter,
// data-format-converter) absorbed it within their existing headroom and are
// deliberately left un-refreshed.
//
// `diff-checker-tool` (82,970 -> 87,207) was refreshed for UI v4 Phase D as a
// whole: the drop zone (D1) plus the Share button and its handler (D2). The
// share payload codec itself is NOT in this number — `./share-url` pulls
// lz-string, so it is loaded as a lazy chunk on first Share click or share-link
// visit and shows up in the Async column instead (10,250 -> 15,944). Without
// that split the main bundle was 92,444, over the fail line. Left at a standing
// WARN it would have been 88 bytes over, which dulls the signal for the next
// change rather than reflecting the new expected size.
//
// `css-minifier-tool` (71,459 -> 75,570), `text-analyzer-tool` (51,949 ->
// 55,830), and `data-format-converter` (181,680 -> 191,635) were refreshed for
// UI v4 Phase D3 (`?` shortcut help + recently-used tracking). Every tool gains
// the same two things: ~1 KB for the shell's visit recorder plus the `?`
// registrar, and — for the tools that previously had no code-split chunk at
// all — webpack's chunk-loading runtime, because the help overlay is a lazy
// chunk. Measured alternatives were both worse: importing the overlay eagerly
// costs ~5.5 KB of main bundle per tool instead of ~2.4 KB, and rendering the
// overlay with Preact (rather than plain DOM) adds a further ~3.7 KB per tool
// by breaking scope hoisting in main, which is what pushed text-analyzer over
// its fail line during development. The other seven tools absorbed the same
// growth within their existing headroom and are deliberately left alone.
// `data-format-converter` had also drifted +7,855 on its own before this
// change (dependency growth), so its new value banks that drift too.
//
// All nine non-diff-checker baselines were lowered for issue #327, which moved
// intro/article/FAQ content out of the hydrated app root and into the prerender
// pipeline. Measured by building main and the branch and diffing the emitted
// bundles: 790,271 -> 700,363 raw bytes across the nine migrated main bundles,
// a saving of 89,908 (-11.4%), ranging -5.6% (data-format-converter) to -17.6%
// (js-minifier). Those percentages are against main's actual sizes, not against
// the previous baselines — several of which carried years of stale headroom, so
// the drop from baseline looks larger (qr-code-generator 91,896 -> 65,847) and
// banks that pre-existing drift as well, the same caveat noted for
// data-format-converter above.
//
// Lowering them is the point rather than bookkeeping: left at the old numbers
// every tool would carry 10-25% of slack, so the budgets would stop catching
// the next regression — the same "dulls the signal" reasoning as the refreshes
// above, in the opposite direction. `diff-checker-tool` is unchanged because it
// already used this pattern; its +2,365 drift is pre-existing and still inside
// the warn line.
//
// These are pinned to the exact measured byte, so warn is +5% and fail +10% of
// the true size (e.g. text-analyzer has 2,320 bytes before WARN). A shared
// addition that lands in every bundle — the ShareBar rail cost 5-7 KB, a
// fast-xml-parser bump ~21 KB — will therefore trip several tools at once
// rather than being absorbed silently. That is the intended signal; the
// expected response is one coordinated refresh commit, not a per-tool waiver.
// `json-formatter-tool` is refreshed for the optional JSON Schema disclosure and
// its stale-result/worker dispatch UI. Ajv 8 and json-source-map remain in the
// validator's lazy async chunks (not the initial bundle); this baseline records
// the intentional main-thread UI growth while keeping the next regression visible.
// `json-editor-tool` is measured from its initial production bundle; the
// dependency-free visual tree editor keeps parsing and serialization in the
// main bundle and has no editor library or worker chunk.
// `image-editor` is measured from its initial production bundle; the
// dependency-free canvas editor keeps all geometry/filter math in the main
// bundle with no editor library or worker chunk.
// `base64-converter-tool` (76,402 -> 84,607) was refreshed for image preview
// support (PR #527): the magic-byte sniffer that previews bare base64 without
// a Data URI prefix, the upload thumbnail with its blob-URL lifecycle, and the
// decode-path caption (type, decoded size, dimensions). SVG stays
// download-only by policy, so it adds no preview weight.
/** @type {Readonly<Record<string, number>>} */
const JS_RAW_BASELINES = Object.freeze({
    'js-minifier-tool': 49773,
    'data-format-converter': 190839,
    'diff-checker-tool': 87207,
    'jwt-builder-tool': 70073,
    'jwt-decoder-tool': 70827,
    'base64-converter-tool': 84607,
    'json-formatter-tool': 71306,
    'json-editor-tool': 63226,
    'css-minifier-tool': 66115,
    'text-analyzer-tool': 46389,
    'qr-code-generator': 65847,
    'image-editor': 66107
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
