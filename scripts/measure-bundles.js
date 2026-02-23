const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BUILD_DIR = path.resolve(__dirname, '../build');
const DEFAULT_JSON_OUT = path.resolve(__dirname, '../reports/bundle-metrics/latest.json');

function parseArgs(argv) {
    const args = {
        buildDir: BUILD_DIR,
        jsonOut: null,
        markdownOut: null,
        format: 'both'
    };

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
            args.format = argv[index + 1] || 'both';
            index += 1;
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

    return args;
}

function printHelp() {
    console.log('Usage: node scripts/measure-bundles.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --build-dir <path>       Build directory (default: ./build)');
    console.log('  --format <both|json|markdown>');
    console.log('  --json-out <path>        Write JSON report to file');
    console.log('  --markdown-out <path>    Write markdown table to file');
    console.log('  --write-default-json     Write JSON report to reports/bundle-metrics/latest.json');
}

function ensureDir(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readFileBufferIfExists(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    return fs.readFileSync(filePath);
}

function getMetric(buffer) {
    if (!buffer) {
        return null;
    }

    return {
        rawBytes: buffer.length,
        gzipBytes: zlib.gzipSync(buffer).length
    };
}

function formatNumber(value) {
    if (value === null || value === undefined) {
        return 'n/a';
    }

    return value.toLocaleString('en-US');
}

function formatRawGzip(metric) {
    if (!metric) {
        return 'n/a';
    }

    return `${formatNumber(metric.rawBytes)} / ${formatNumber(metric.gzipBytes)}`;
}

function formatRaw(metric) {
    if (!metric) {
        return 'n/a';
    }

    return formatNumber(metric.rawBytes);
}

function listToolDirectories(buildDir) {
    const entries = fs.readdirSync(buildDir, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
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

function collectToolMetrics(buildDir, toolName) {
    const toolDir = path.join(buildDir, toolName);
    const jsMetric = getMetric(readFileBufferIfExists(path.join(toolDir, 'bundle.main.js')));
    const cssMetric = getMetric(readFileBufferIfExists(path.join(toolDir, 'styles.main.css')));
    const htmlBuffer = readFileBufferIfExists(path.join(toolDir, 'index.html'));

    return {
        tool: toolName,
        files: {
            js: jsMetric,
            css: cssMetric,
            html: htmlBuffer ? { rawBytes: htmlBuffer.length } : null
        }
    };
}

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

    if (toolNames.length === 0) {
        console.error(`No tool build directories found in ${args.buildDir}`);
        process.exit(1);
    }

    const tools = toolNames.map((toolName) => collectToolMetrics(args.buildDir, toolName));
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
