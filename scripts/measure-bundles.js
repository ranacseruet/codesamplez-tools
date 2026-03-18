// @ts-check

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { getRootShellDefinition, getToolById, getToolByOutputDir, getToolDefinitions, parseToolSelectionArgs } = require('./tool-manifest');

const BUILD_DIR = path.resolve(__dirname, '../build');
const DEFAULT_JSON_OUT = path.resolve(__dirname, '../reports/bundle-metrics/latest.json');

/**
 * @typedef {'both' | 'json' | 'markdown'} ReportFormat
 * @typedef {{ buildDir: string, jsonOut: string | null, markdownOut: string | null, format: ReportFormat, selection: ReturnType<typeof parseToolSelectionArgs> }} MeasureBundleArgs
 * @typedef {{ rawBytes: number, gzipBytes: number }} RawAndGzipMetric
 * @typedef {{ rawBytes: number }} RawOnlyMetric
 * @typedef {{ js: RawAndGzipMetric | null, css: RawAndGzipMetric | null, html: RawOnlyMetric | null }} ToolMetricFiles
 * @typedef {{ tool: string, files: ToolMetricFiles }} ToolMetricRow
 * @typedef {{ jsRawBytes: number, jsGzipBytes: number, cssRawBytes: number, cssGzipBytes: number, htmlRawBytes: number }} BundleMetricSummary
 */

/**
 * @param {string | undefined} value
 * @returns {ReportFormat}
 */
function normalizeFormat(value) {
    return value === 'json' || value === 'markdown' || value === 'both' ? value : 'both';
}

/**
 * @param {string[]} argv
 * @returns {MeasureBundleArgs}
 */
function parseArgs(argv) {
    /** @type {MeasureBundleArgs} */
    const args = {
        buildDir: BUILD_DIR,
        jsonOut: null,
        markdownOut: null,
        format: 'both',
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

        if (arg === '--json-out') {
            args.jsonOut = path.resolve(process.cwd(), argv[index + 1]);
            index += 1;
            continue;
        }

        if (arg === '--markdown-out') {
            args.markdownOut = path.resolve(process.cwd(), argv[index + 1]);
            index += 1;
            continue;
        }

        if (arg === '--format') {
            args.format = normalizeFormat(argv[index + 1]);
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

        if (arg === '--write-default-json') {
            args.jsonOut = DEFAULT_JSON_OUT;
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

function printHelp() {
    console.log('Usage: node scripts/measure-bundles.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --build-dir <path>       Build directory (default: ./build)');
    console.log('  --tool <id>              Measure a single tool');
    console.log('  --tools <id,id>          Measure multiple tools');
    console.log('  --include-root-shell     Include root-shell metrics when filtering');
    console.log('  --format <both|json|markdown>');
    console.log('  --json-out <path>        Write JSON report to file');
    console.log('  --markdown-out <path>    Write markdown table to file');
    console.log('  --write-default-json     Write JSON report to reports/bundle-metrics/latest.json');
}

/**
 * @param {string} filePath
 */
function ensureDir(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/**
 * @param {string} filePath
 * @returns {Buffer | null}
 */
function readFileBufferIfExists(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    return fs.readFileSync(filePath);
}

/**
 * @param {Buffer | null} buffer
 * @returns {RawAndGzipMetric | null}
 */
function getMetric(buffer) {
    if (!buffer) {
        return null;
    }

    return {
        rawBytes: buffer.length,
        gzipBytes: zlib.gzipSync(buffer).length
    };
}

/**
 * @param {number | null | undefined} value
 * @returns {string}
 */
function formatNumber(value) {
    if (value === null || value === undefined) {
        return 'n/a';
    }

    return value.toLocaleString('en-US');
}

/**
 * @param {RawAndGzipMetric | null} metric
 * @returns {string}
 */
function formatRawGzip(metric) {
    if (!metric) {
        return 'n/a';
    }

    return `${formatNumber(metric.rawBytes)} / ${formatNumber(metric.gzipBytes)}`;
}

/**
 * @param {RawOnlyMetric | null} metric
 * @returns {string}
 */
function formatRaw(metric) {
    if (!metric) {
        return 'n/a';
    }

    return formatNumber(metric.rawBytes);
}

/**
 * @param {string} buildDir
 * @returns {string[]}
 */
function listToolDirectories(buildDir) {
    const entries = fs.readdirSync(buildDir, { withFileTypes: true });
    const validToolDirs = new Set([
        ...getToolDefinitions().map((tool) => tool.outputDir),
        getRootShellDefinition().id
    ]);

    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((toolName) => validToolDirs.has(toolName))
        .filter((toolName) => {
            const toolDir = path.join(buildDir, toolName);

            return (
                fs.existsSync(path.join(toolDir, 'bundle.main.js')) ||
                fs.existsSync(path.join(toolDir, 'styles.main.css')) ||
                fs.existsSync(path.join(toolDir, 'index.html'))
            );
        })
        .sort();
}

/**
 * @param {string} buildDir
 * @param {string} toolName
 * @returns {ToolMetricRow}
 */
function collectToolMetrics(buildDir, toolName) {
    const toolDir = path.join(buildDir, toolName);
    const jsMetric = getMetric(readFileBufferIfExists(path.join(toolDir, 'bundle.main.js')));
    const cssMetric = getMetric(readFileBufferIfExists(path.join(toolDir, 'styles.main.css')));
    const htmlBuffer = readFileBufferIfExists(path.join(toolDir, 'index.html'));
    const tool = getToolByOutputDir(toolName);

    return {
        tool: tool ? tool.id : toolName,
        files: {
            js: jsMetric,
            css: cssMetric,
            html: htmlBuffer ? { rawBytes: htmlBuffer.length } : null
        }
    };
}

/**
 * @param {ToolMetricRow[]} tools
 * @returns {BundleMetricSummary}
 */
function createSummary(tools) {
    return tools.reduce(
        (acc, tool) => {
            if (tool.files.js) {
                acc.jsRawBytes += tool.files.js.rawBytes;
                acc.jsGzipBytes += tool.files.js.gzipBytes;
            }

            if (tool.files.css) {
                acc.cssRawBytes += tool.files.css.rawBytes;
                acc.cssGzipBytes += tool.files.css.gzipBytes;
            }

            if (tool.files.html) {
                acc.htmlRawBytes += tool.files.html.rawBytes;
            }

            return acc;
        },
        {
            jsRawBytes: 0,
            jsGzipBytes: 0,
            cssRawBytes: 0,
            cssGzipBytes: 0,
            htmlRawBytes: 0
        }
    );
}

/**
 * @param {ToolMetricRow[]} tools
 * @returns {string}
 */
function toMarkdownTableRows(tools) {
    const header = [
        '| Tool | JS (raw/gzip bytes) | CSS (raw/gzip bytes) | HTML (bytes) |',
        '|---|---:|---:|---:|'
    ];

    const rows = tools.map((tool) => {
        return `| \`${tool.tool}\` | ${formatRawGzip(tool.files.js)} | ${formatRawGzip(tool.files.css)} | ${formatRaw(tool.files.html)} |`;
    });

    return [...header, ...rows].join('\n');
}

function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(args.buildDir)) {
        console.error(`Build directory not found: ${args.buildDir}`);
        console.error("Run 'npm run build' first.");
        process.exit(1);
    }

    const toolNames = listToolDirectories(args.buildDir);
    const filteredToolNames = args.selection.requestedTools.length > 0
        ? toolNames.filter((toolName) => {
            return args.selection.requestedTools.some((toolId) => {
                return getToolById(toolId)?.outputDir === toolName;
            })
                || (args.selection.includeRootShell && toolName === getRootShellDefinition().id);
        })
        : toolNames;

    if (filteredToolNames.length === 0) {
        console.error(`No matching build directories found in ${args.buildDir}`);
        process.exit(1);
    }

    const tools = filteredToolNames.map((toolName) => collectToolMetrics(args.buildDir, toolName));
    const summary = createSummary(tools);
    const generatedAt = new Date().toISOString();

    const report = {
        generatedAt,
        buildDir: args.buildDir,
        toolCount: tools.length,
        summary,
        tools
    };

    const markdown = toMarkdownTableRows(tools);
    const json = JSON.stringify(report, null, 2);
    const shouldPrintJson = args.format === 'json' || args.format === 'both';
    const shouldPrintMarkdown = args.format === 'markdown' || args.format === 'both';

    if (args.jsonOut) {
        ensureDir(args.jsonOut);
        fs.writeFileSync(args.jsonOut, `${json}\n`, 'utf8');
    }

    if (args.markdownOut) {
        ensureDir(args.markdownOut);
        fs.writeFileSync(args.markdownOut, `${markdown}\n`, 'utf8');
    }

    if (shouldPrintMarkdown) {
        console.log(`# Bundle Metrics (${generatedAt})`);
        console.log('');
        console.log(markdown);
        console.log('');
        console.log(`Totals: JS ${formatNumber(summary.jsRawBytes)} / ${formatNumber(summary.jsGzipBytes)}, CSS ${formatNumber(summary.cssRawBytes)} / ${formatNumber(summary.cssGzipBytes)}, HTML ${formatNumber(summary.htmlRawBytes)} bytes`);
    }

    if (shouldPrintJson) {
        if (shouldPrintMarkdown) {
            console.log('');
        }

        console.log(json);
    }
}

main();
