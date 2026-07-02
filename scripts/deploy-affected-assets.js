// @ts-check

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getRootAssets, getRootShellDefinition, getToolById, parseToolSelectionArgs } = require('./tool-manifest');

/**
 * @typedef {{
 *   bucket: string | null,
 *   distributionId: string | null,
 *   buildDir: string,
 *   dryRun: boolean,
 *   selection: ReturnType<typeof parseToolSelectionArgs>
 * }} DeployArgs
 */

function printHelp() {
    console.log('Usage: node scripts/deploy-affected-assets.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --bucket <name>                 S3 bucket name');
    console.log('  --distribution-id <id>          CloudFront distribution id');
    console.log('  --build-dir <path>              Build directory (default: ./build)');
    console.log('  --tool <id>                     Deploy a single tool');
    console.log('  --tools <id,id>                 Deploy multiple tools');
    console.log('  --include-root-shell            Deploy build/root-shell/');
    console.log('  --include-root-assets           Deploy root-level static assets');
    console.log('  --dry-run                       Print AWS commands without executing');
    console.log('  --help, -h                      Show this help');
}

/**
 * @param {string[]} argv
 * @returns {DeployArgs}
 */
function parseArgs(argv) {
    /** @type {DeployArgs} */
    const args = {
        bucket: null,
        distributionId: null,
        buildDir: path.resolve(process.cwd(), 'build'),
        dryRun: false,
        selection: parseToolSelectionArgs([])
    };
    /** @type {string[]} */
    const selectionArgv = [];

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--bucket') {
            args.bucket = argv[index + 1] || null;
            index += 1;
            continue;
        }

        if (arg === '--distribution-id') {
            args.distributionId = argv[index + 1] || null;
            index += 1;
            continue;
        }

        if (arg === '--build-dir') {
            args.buildDir = path.resolve(process.cwd(), argv[index + 1] || 'build');
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

        if (arg === '--dry-run') {
            args.dryRun = true;
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
 * @param {string} command
 * @param {string[]} args
 * @param {boolean} dryRun
 * @returns {void}
 */
function runCommand(command, args, dryRun) {
    if (dryRun) {
        console.log(`[dry-run] ${command} ${args.join(' ')}`);
        return;
    }

    const result = spawnSync(command, args, {
        cwd: process.cwd(),
        stdio: 'inherit'
    });

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

/**
 * @param {string[]} values
 * @returns {string[]}
 */
function uniqueSorted(values) {
    return Array.from(new Set(values)).sort();
}

/**
 * @param {string} filePath
 * @returns {void}
 */
function assertExists(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Required build artifact not found: ${filePath}`);
    }
}

// Cache-Control policy by file type. Without these the S3 objects ship no
// Cache-Control header, so browsers revalidate every static asset on every visit
// (observed as a 304 round-trip per asset per load). Every deploy issues a
// CloudFront invalidation for the changed paths, so the CDN edge is always purged
// on release — the max-age values below only govern how long a *browser* may reuse
// a cached copy, never how stale the CDN can get.
//
//   .woff2            immutable for a year — font files never change in place.
//   .js / .css        1 day — bundle filenames are not content-hashed, but the
//                     deploy invalidation purges the edge, so a returning visitor
//                     is at most a day behind and JS+CSS move together.
//   images / icons    1 week.
//   .txt / .xml       1 hour (robots, sitemap, ads.txt, llms.txt).
//   .html             must-revalidate, max-age 0 — HTML is the entry point and
//                     must always reflect the latest deploy.
const CACHE_CONTROL_HTML = 'public, max-age=0, must-revalidate';
const CACHE_CONTROL_DIR_ASSETS = 'public, max-age=86400';

/**
 * Resolve the Cache-Control header value for a root asset based on its extension.
 * @param {string} assetPath
 * @returns {string}
 */
function cacheControlForAsset(assetPath) {
    const ext = path.extname(assetPath).toLowerCase();
    switch (ext) {
        case '.woff2':
            return 'public, max-age=31536000, immutable';
        case '.js':
        case '.css':
            return 'public, max-age=86400';
        case '.png':
        case '.svg':
        case '.ico':
        case '.webp':
        case '.jpg':
        case '.jpeg':
            return 'public, max-age=604800';
        case '.txt':
        case '.xml':
            return 'public, max-age=3600';
        case '.html':
            return CACHE_CONTROL_HTML;
        default:
            return 'public, max-age=3600';
    }
}

/**
 * Sync a built directory (tool or root-shell) to S3. A single `aws s3 sync` keeps
 * the HTML and its sibling JS/CSS in lockstep (so a half-deployed page is never
 * served); the directory-level Cache-Control suits the JS/CSS bundles it carries,
 * and a follow-up `cp` re-stamps any HTML entry point with the must-revalidate
 * policy so navigations always pick up the newest deploy. Fonts are not in these
 * directories — they ship as root assets with their own immutable policy.
 * @param {string} bucket
 * @param {string} sourceDir
 * @param {string} destPrefix
 * @param {boolean} dryRun
 * @returns {void}
 */
function syncDirectory(bucket, sourceDir, destPrefix, dryRun) {
    runCommand('aws', [
        's3',
        'sync',
        `${sourceDir}/`,
        `s3://${bucket}/${destPrefix}/`,
        '--delete',
        '--cache-control',
        CACHE_CONTROL_DIR_ASSETS
    ], dryRun);

    const htmlPath = path.join(sourceDir, 'index.html');
    if (fs.existsSync(htmlPath)) {
        runCommand('aws', [
            's3',
            'cp',
            htmlPath,
            `s3://${bucket}/${destPrefix}/index.html`,
            '--content-type',
            'text/html',
            '--cache-control',
            CACHE_CONTROL_HTML
        ], dryRun);
    }
}

/**
 * @param {string} bucket
 * @param {string} sourcePath
 * @param {string} destinationPath
 * @param {boolean} dryRun
 * @returns {void}
 */
function copyAsset(bucket, sourcePath, destinationPath, dryRun) {
    runCommand('aws', [
        's3',
        'cp',
        sourcePath,
        `s3://${bucket}/${destinationPath}`,
        '--cache-control',
        cacheControlForAsset(destinationPath)
    ], dryRun);
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.bucket) {
        throw new Error('Missing required --bucket value');
    }
    if (!args.distributionId) {
        throw new Error('Missing required --distribution-id value');
    }

    /** @type {string[]} */
    const invalidationPaths = [];

    args.selection.requestedTools.forEach((toolId) => {
        const tool = getToolById(toolId);
        if (!tool) {
            throw new Error(`Unknown tool id: ${toolId}`);
        }

        const sourceDir = path.join(args.buildDir, tool.outputDir);
        assertExists(sourceDir);
        syncDirectory(args.bucket, sourceDir, tool.outputDir, args.dryRun);
        const htmlPath = path.join(sourceDir, 'index.html');
        assertExists(htmlPath);
        invalidationPaths.push(`${tool.publicPath}*`);
    });

    if (args.selection.includeRootShell) {
        const rootShell = getRootShellDefinition();
        const sourceDir = path.join(args.buildDir, rootShell.id);
        assertExists(sourceDir);
        syncDirectory(args.bucket, sourceDir, rootShell.id, args.dryRun);
        invalidationPaths.push(`/${rootShell.id}/*`);
    }

    if (args.selection.includeRootAssets) {
        getRootAssets().forEach((asset) => {
            const sourcePath = path.join(args.buildDir, asset);
            assertExists(sourcePath);
            copyAsset(args.bucket, sourcePath, asset, args.dryRun);
            invalidationPaths.push(`/${asset}`);
        });
        invalidationPaths.push('/');
    }

    if (invalidationPaths.length > 0) {
        runCommand('aws', [
            'cloudfront',
            'create-invalidation',
            '--distribution-id',
            args.distributionId,
            '--paths',
            ...uniqueSorted(invalidationPaths)
        ], args.dryRun);
    }
}

main();
