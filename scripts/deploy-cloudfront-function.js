// @ts-check

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_FUNCTION_NAME = 'codesamplez-tools-rewrite-static-urls';
const DEFAULT_SOURCE_PATH = path.resolve(process.cwd(), 'infrastructure/cloudfront-functions/codesamplez-tools-rewrite-static-urls.js');
const DEFAULT_RUNTIME = 'cloudfront-js-2.0';
const DEFAULT_EVENT_TYPE = 'viewer-request';
const DEFAULT_VIEWER_PROTOCOL_POLICY = 'redirect-to-https';
// NOTE: keep <=128 chars (CloudFront Function Comment limit). The repo name is
// intentionally embedded so anyone (human or agent) inspecting this function in
// the shared AWS account knows its owner and that manual publishes are clobbered
// by CI.
const DEFAULT_COMMENT = 'OWNER ranacseruet/codesamplez-tools (CI: deploy-cloudfront-function.js). Do not edit/publish by hand.';
// CloudFront's control plane is eventually consistent: an ETag read moments
// after a publish can already be stale, which fails UpdateFunction with
// PreconditionFailed. Re-read and retry rather than failing the deploy.
const ETAG_CONFLICT_PATTERN = /PreconditionFailed|InvalidIfMatchVersion/u;
const ETAG_RETRY_ATTEMPTS = 3;
const ETAG_RETRY_DELAY_MS = 5000;

/**
 * @typedef {{
 *   name: string,
 *   sourcePath: string,
 *   distributionId: string | null,
 *   runtime: string,
 *   eventType: string,
 *   comment: string,
 *   dryRun: boolean,
 *   skipAssociation: boolean
 * }} DeployFunctionArgs
 *
 * @typedef {{
 *   runCommand?: typeof runCommand,
 *   describeFunction?: typeof describeFunction,
 *   readLiveSource?: typeof readLiveSource,
 *   verifyLiveSource?: typeof verifyLiveSource,
 *   ensureDistributionAssociation?: typeof ensureDistributionAssociation,
 *   sleep?: (durationMs: number) => void,
 *   retryDelayMs?: number
 * }} DeployFunctionOptions
 */

function printHelp() {
    console.log('Usage: node scripts/deploy-cloudfront-function.js [options]');
    console.log('');
    console.log('Options:');
    console.log(`  --name <name>                  CloudFront Function name (default: ${DEFAULT_FUNCTION_NAME})`);
    console.log(`  --source <path>                Function source path (default: ${path.relative(process.cwd(), DEFAULT_SOURCE_PATH)})`);
    console.log('  --distribution-id <id>         CloudFront distribution id to update');
    console.log(`  --runtime <runtime>            Function runtime (default: ${DEFAULT_RUNTIME})`);
    console.log(`  --event-type <event>           Function association event type (default: ${DEFAULT_EVENT_TYPE})`);
    console.log(`  --comment <text>               Function comment`);
    console.log('  --skip-association             Update/publish the function without touching the distribution');
    console.log('  --dry-run                      Print AWS commands without executing');
    console.log('  --help, -h                     Show this help');
}

/**
 * @param {string[]} argv
 * @returns {DeployFunctionArgs}
 */
function parseArgs(argv) {
    /** @type {DeployFunctionArgs} */
    const args = {
        name: DEFAULT_FUNCTION_NAME,
        sourcePath: DEFAULT_SOURCE_PATH,
        distributionId: null,
        runtime: DEFAULT_RUNTIME,
        eventType: DEFAULT_EVENT_TYPE,
        comment: DEFAULT_COMMENT,
        dryRun: false,
        skipAssociation: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--name') {
            args.name = argv[index + 1] || args.name;
            index += 1;
            continue;
        }

        if (arg === '--source') {
            args.sourcePath = path.resolve(process.cwd(), argv[index + 1] || args.sourcePath);
            index += 1;
            continue;
        }

        if (arg === '--distribution-id') {
            args.distributionId = argv[index + 1] || null;
            index += 1;
            continue;
        }

        if (arg === '--runtime') {
            args.runtime = argv[index + 1] || args.runtime;
            index += 1;
            continue;
        }

        if (arg === '--event-type') {
            args.eventType = argv[index + 1] || args.eventType;
            index += 1;
            continue;
        }

        if (arg === '--comment') {
            args.comment = argv[index + 1] || args.comment;
            index += 1;
            continue;
        }

        if (arg === '--skip-association') {
            args.skipAssociation = true;
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

    return args;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ dryRun?: boolean, allowFailure?: boolean }} options
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
function runCommand(command, args, options = {}) {
    if (options.dryRun) {
        console.log(`[dry-run] ${command} ${args.join(' ')}`);
        return { status: 0, stdout: '', stderr: '' };
    }

    const result = spawnSync(command, args, {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });

    if (result.error) {
        if (!options.allowFailure) {
            throw result.error;
        }
        return {
            status: 1,
            stdout: result.stdout || '',
            stderr: result.stderr || result.error.message
        };
    }

    const status = result.status || 0;
    if (status !== 0 && !options.allowFailure) {
        process.stderr.write(result.stderr || '');
        process.exit(status);
    }

    return {
        status,
        stdout: result.stdout || '',
        stderr: result.stderr || ''
    };
}

/**
 * @param {string} output
 * @returns {any}
 */
function parseJsonOutput(output) {
    return output.trim() ? JSON.parse(output) : {};
}

/**
 * @param {string} name
 * @param {'DEVELOPMENT' | 'LIVE'} stage
 * @param {boolean} dryRun
 * @returns {any | null}
 */
function describeFunction(name, stage, dryRun) {
    const result = runCommand('aws', [
        'cloudfront',
        'describe-function',
        '--name',
        name,
        '--stage',
        stage,
        '--output',
        'json'
    ], { dryRun, allowFailure: true });

    if (dryRun || result.status !== 0) {
        return null;
    }

    return parseJsonOutput(result.stdout);
}

/**
 * @param {string} sourcePath
 * @returns {void}
 */
function assertSourceExists(sourcePath) {
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`CloudFront Function source not found: ${sourcePath}`);
    }
}

/**
 * @param {string} source
 * @returns {{ tempDir: string, eventPath: string }}
 */
function createTestEventFile(source) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesamplez-cloudfront-function-'));
    const eventPath = path.join(tempDir, 'event.json');
    fs.writeFileSync(eventPath, JSON.stringify({
        version: '1.0',
        context: {
            eventType: 'viewer-request'
        },
        viewer: {
            ip: '203.0.113.1'
        },
        request: {
            method: 'GET',
            uri: '/',
            headers: {
                host: {
                    value: 'tools.codesamplez.com'
                }
            }
        }
    }), 'utf8');

    if (!source.includes('function handler(event)')) {
        throw new Error('CloudFront Function source must define handler(event)');
    }

    return { tempDir, eventPath };
}

/**
 * @param {string} source
 * @returns {string}
 */
function normalizeSource(source) {
    return source.replace(/\r\n/gu, '\n').trim();
}

/**
 * Exports the published (LIVE) function body to a temporary file and returns it
 * normalized, or null when the export is unavailable (dry run, missing
 * function, or a tolerated command failure).
 *
 * @param {string} name
 * @param {typeof runCommand} commandRunner
 * @param {{ dryRun?: boolean, allowFailure?: boolean }} options
 * @returns {string | null}
 */
function exportLiveSource(name, commandRunner = runCommand, options = {}) {
    const { dryRun = false, allowFailure = false } = options;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesamplez-cloudfront-live-'));
    const outputPath = path.join(tempDir, `${name}.js`);

    try {
        const result = commandRunner('aws', [
            'cloudfront',
            'get-function',
            '--name',
            name,
            '--stage',
            'LIVE',
            outputPath,
            '--output',
            'json'
        ], { dryRun, allowFailure });

        if (dryRun || result.status !== 0 || !fs.existsSync(outputPath)) {
            return null;
        }

        return normalizeSource(fs.readFileSync(outputPath, 'utf8'));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

/**
 * Best-effort read of the published function body. Returns null instead of
 * failing when the function does not exist yet.
 *
 * @param {string} name
 * @param {typeof runCommand} commandRunner
 * @returns {string | null}
 */
function readLiveSource(name, commandRunner = runCommand) {
    return exportLiveSource(name, commandRunner, { allowFailure: true });
}

/**
 * @param {string} name
 * @param {string} sourcePath
 * @param {boolean} dryRun
 * @param {typeof runCommand} commandRunner
 * @returns {void}
 */
function verifyLiveSource(name, sourcePath, dryRun, commandRunner = runCommand) {
    const expectedSource = normalizeSource(fs.readFileSync(sourcePath, 'utf8'));
    let lastLiveSource = '';
    const maxAttempts = dryRun ? 1 : 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const liveSource = exportLiveSource(name, commandRunner, { dryRun });

        if (dryRun) {
            return;
        }

        lastLiveSource = liveSource || '';
        if (expectedSource === lastLiveSource) {
            return;
        }
    }

    throw new Error(`Live CloudFront Function ${name} does not match ${sourcePath} after ${maxAttempts} attempts`);
}

/**
 * @param {any} distributionConfig
 * @param {string} functionArn
 * @param {string} eventType
 * @returns {{ config: any, changed: boolean }}
 */
function ensureDefaultFunctionAssociation(distributionConfig, functionArn, eventType = DEFAULT_EVENT_TYPE) {
    const defaultCacheBehavior = distributionConfig.DefaultCacheBehavior;
    if (!defaultCacheBehavior) {
        throw new Error('Distribution config is missing DefaultCacheBehavior');
    }

    const viewerProtocolPolicy = defaultCacheBehavior.ViewerProtocolPolicy;
    const associations = defaultCacheBehavior.FunctionAssociations || { Quantity: 0 };
    const items = Array.isArray(associations.Items) ? associations.Items.slice() : [];
    const existingIndex = items.findIndex((item) => item.EventType === eventType);
    let changed = false;

    if (viewerProtocolPolicy !== DEFAULT_VIEWER_PROTOCOL_POLICY) {
        changed = true;
    }

    if (existingIndex === -1) {
        items.push({ EventType: eventType, FunctionARN: functionArn });
        changed = true;
    } else if (items[existingIndex].FunctionARN !== functionArn) {
        items[existingIndex] = { ...items[existingIndex], FunctionARN: functionArn };
        changed = true;
    }

    const nextAssociations = {
        Quantity: items.length
    };
    if (items.length > 0) {
        nextAssociations.Items = items;
    }

    return {
        config: {
            ...distributionConfig,
            DefaultCacheBehavior: {
                ...defaultCacheBehavior,
                ViewerProtocolPolicy: DEFAULT_VIEWER_PROTOCOL_POLICY,
                FunctionAssociations: nextAssociations
            }
        },
        changed
    };
}

/**
 * @param {string} distributionId
 * @param {string} functionArn
 * @param {string} eventType
 * @param {boolean} dryRun
 * @param {typeof runCommand} commandRunner
 * @returns {void}
 */
function ensureDistributionAssociation(distributionId, functionArn, eventType, dryRun, commandRunner = runCommand) {
    const result = commandRunner('aws', [
        'cloudfront',
        'get-distribution-config',
        '--id',
        distributionId,
        '--output',
        'json'
    ], { dryRun });

    if (dryRun) {
        commandRunner('aws', [
            'cloudfront',
            'update-distribution',
            '--id',
            distributionId,
            '--if-match',
            '<distribution-etag>',
            '--distribution-config',
            'file://<updated-distribution-config>'
        ], { dryRun });
        return;
    }

    const current = parseJsonOutput(result.stdout);
    const next = ensureDefaultFunctionAssociation(current.DistributionConfig, functionArn, eventType);
    if (!next.changed) {
        console.log(`CloudFront distribution ${distributionId} already has ${eventType} association for ${functionArn} and ${DEFAULT_VIEWER_PROTOCOL_POLICY} viewer policy`);
        return;
    }

    const configPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'codesamplez-distribution-config-')), `${distributionId}.json`);
    fs.writeFileSync(configPath, JSON.stringify(next.config, null, 2), 'utf8');

    commandRunner('aws', [
        'cloudfront',
        'update-distribution',
        '--id',
        distributionId,
        '--if-match',
        current.ETag,
        '--distribution-config',
        `file://${configPath}`
    ]);
}

/**
 * @param {number} durationMs
 * @returns {void}
 */
function sleepSync(durationMs) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, durationMs);
}

/**
 * Runs `update-function`, refreshing the DEVELOPMENT ETag and retrying when
 * CloudFront rejects it as stale. The ETag comes from a `describe-function`
 * read, and that read can lag a recent publish — unlike the ETags used by
 * `test-function`/`publish-function`, which are returned by the immediately
 * preceding successful call in this same process.
 *
 * @param {DeployFunctionArgs} args
 * @param {string} functionConfig
 * @param {string} etag
 * @param {{
 *   commandRunner: typeof runCommand,
 *   functionDescriber: typeof describeFunction,
 *   sleep?: (durationMs: number) => void,
 *   retryDelayMs?: number,
 *   maxAttempts?: number
 * }} options
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
function updateFunctionWithRetry(args, functionConfig, etag, options) {
    const {
        commandRunner,
        functionDescriber,
        sleep = sleepSync,
        retryDelayMs = ETAG_RETRY_DELAY_MS,
        maxAttempts = ETAG_RETRY_ATTEMPTS
    } = options;
    let currentETag = etag;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const result = commandRunner('aws', [
            'cloudfront',
            'update-function',
            '--name',
            args.name,
            '--if-match',
            currentETag,
            '--function-config',
            functionConfig,
            '--function-code',
            `fileb://${args.sourcePath}`,
            '--output',
            'json'
        ], { dryRun: args.dryRun, allowFailure: true });

        if (args.dryRun || result.status === 0) {
            return result;
        }

        const isStaleETag = ETAG_CONFLICT_PATTERN.test(`${result.stderr}${result.stdout}`);
        if (!isStaleETag || attempt === maxAttempts) {
            process.stderr.write(result.stderr || '');
            process.exit(result.status);
        }

        console.log(`Stale DEVELOPMENT ETag for ${args.name}; refreshing and retrying update-function (attempt ${attempt} of ${maxAttempts})`);
        sleep(retryDelayMs);
        currentETag = functionDescriber(args.name, 'DEVELOPMENT', false)?.ETag || currentETag;
    }

    throw new Error(`Could not update CloudFront Function ${args.name} after ${maxAttempts} attempts`);
}

/**
 * @param {DeployFunctionArgs} args
 * @param {DeployFunctionOptions} options
 * @returns {void}
 */
function deployCloudFrontFunction(args, options = {}) {
    const commandRunner = options.runCommand || runCommand;
    const functionDescriber = options.describeFunction || describeFunction;
    const liveSourceReader = options.readLiveSource || readLiveSource;
    const liveSourceVerifier = options.verifyLiveSource || verifyLiveSource;
    const distributionAssociationEnsurer = options.ensureDistributionAssociation || ensureDistributionAssociation;

    assertSourceExists(args.sourcePath);
    const source = fs.readFileSync(args.sourcePath, 'utf8');
    const functionConfig = JSON.stringify({
        Comment: args.comment,
        Runtime: args.runtime
    });

    // Publishing a function that already matches the repo is pure churn: it
    // burns a CloudFront revision and re-reads an ETag that the control plane
    // may not have caught up on yet. A dry run always prints the full sequence.
    const publishedConfig = args.dryRun
        ? null
        : functionDescriber(args.name, 'LIVE', false)?.FunctionSummary?.FunctionConfig;
    const isPublishedUpToDate = Boolean(publishedConfig)
        && publishedConfig.Comment === args.comment
        && publishedConfig.Runtime === args.runtime
        && liveSourceReader(args.name, commandRunner) === normalizeSource(source);

    if (isPublishedUpToDate) {
        console.log(`CloudFront Function ${args.name} is already published from ${args.sourcePath}; skipping update, test, and publish`);
    } else {
        const currentDevelopmentFunction = args.dryRun
            ? { ETag: '<development-etag>' }
            : functionDescriber(args.name, 'DEVELOPMENT', false);
        const sourceFileArg = `fileb://${args.sourcePath}`;
        let developmentETag = currentDevelopmentFunction?.ETag || null;

        if (currentDevelopmentFunction) {
            const updateResult = updateFunctionWithRetry(args, functionConfig, developmentETag, {
                commandRunner,
                functionDescriber,
                sleep: options.sleep,
                retryDelayMs: options.retryDelayMs
            });
            developmentETag = args.dryRun ? '<development-etag>' : parseJsonOutput(updateResult.stdout).ETag;
        } else {
            const createResult = commandRunner('aws', [
                'cloudfront',
                'create-function',
                '--name',
                args.name,
                '--function-config',
                functionConfig,
                '--function-code',
                sourceFileArg,
                '--output',
                'json'
            ], { dryRun: args.dryRun });
            developmentETag = args.dryRun ? '<development-etag>' : parseJsonOutput(createResult.stdout).ETag;
        }

        const testEvent = createTestEventFile(source);
        try {
            commandRunner('aws', [
                'cloudfront',
                'test-function',
                '--name',
                args.name,
                '--if-match',
                developmentETag,
                '--event-object',
                `fileb://${testEvent.eventPath}`,
                '--output',
                'json'
            ], { dryRun: args.dryRun });
        } finally {
            fs.rmSync(testEvent.tempDir, { recursive: true, force: true });
        }

        commandRunner('aws', [
            'cloudfront',
            'publish-function',
            '--name',
            args.name,
            '--if-match',
            developmentETag,
            '--output',
            'json'
        ], { dryRun: args.dryRun });

        liveSourceVerifier(args.name, args.sourcePath, args.dryRun, commandRunner);
    }

    if (args.skipAssociation) {
        return;
    }
    if (!args.distributionId) {
        throw new Error('Missing required --distribution-id value');
    }

    const liveFunction = functionDescriber(args.name, 'LIVE', args.dryRun);
    const functionArn = args.dryRun
        ? `arn:aws:cloudfront::<account>:function/${args.name}`
        : liveFunction?.FunctionSummary?.FunctionMetadata?.FunctionARN;
    if (!functionArn) {
        throw new Error(`Could not resolve LIVE FunctionARN for ${args.name}`);
    }

    distributionAssociationEnsurer(args.distributionId, functionArn, args.eventType, args.dryRun, commandRunner);
}

function main() {
    deployCloudFrontFunction(parseArgs(process.argv.slice(2)));
}

if (require.main === module) {
    main();
}

module.exports = {
    DEFAULT_EVENT_TYPE,
    DEFAULT_FUNCTION_NAME,
    createTestEventFile,
    deployCloudFrontFunction,
    describeFunction,
    ensureDistributionAssociation,
    ensureDefaultFunctionAssociation,
    exportLiveSource,
    normalizeSource,
    parseJsonOutput,
    parseArgs,
    readLiveSource,
    runCommand,
    sleepSync,
    updateFunctionWithRetry,
    verifyLiveSource
};
