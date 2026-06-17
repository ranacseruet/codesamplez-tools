// @ts-check

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_FUNCTION_NAME = 'RewriteStaticURLs';
const DEFAULT_SOURCE_PATH = path.resolve(process.cwd(), 'infrastructure/cloudfront-functions/RewriteStaticURLs.js');
const DEFAULT_RUNTIME = 'cloudfront-js-2.0';
const DEFAULT_EVENT_TYPE = 'viewer-request';
const DEFAULT_VIEWER_PROTOCOL_POLICY = 'redirect-to-https';
const DEFAULT_COMMENT = 'Rewrite static site URLs for SEO-friendly paths (managed by CI/CD)';

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
 *   verifyLiveSource?: typeof verifyLiveSource,
 *   ensureDistributionAssociation?: typeof ensureDistributionAssociation
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
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesamplez-cloudfront-live-'));
        const outputPath = path.join(tempDir, `${name}.js`);
        try {
            commandRunner('aws', [
                'cloudfront',
                'get-function',
                '--name',
                name,
                '--stage',
                'LIVE',
                outputPath,
                '--output',
                'json'
            ], { dryRun });

            if (dryRun) {
                return;
            }

            lastLiveSource = normalizeSource(fs.readFileSync(outputPath, 'utf8'));
            if (expectedSource === lastLiveSource) {
                return;
            }
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }

    if (expectedSource !== lastLiveSource) {
        throw new Error(`Live CloudFront Function ${name} does not match ${sourcePath} after ${maxAttempts} attempts`);
    }
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
 * @param {DeployFunctionArgs} args
 * @param {DeployFunctionOptions} options
 * @returns {void}
 */
function deployCloudFrontFunction(args, options = {}) {
    const commandRunner = options.runCommand || runCommand;
    const functionDescriber = options.describeFunction || describeFunction;
    const liveSourceVerifier = options.verifyLiveSource || verifyLiveSource;
    const distributionAssociationEnsurer = options.ensureDistributionAssociation || ensureDistributionAssociation;

    assertSourceExists(args.sourcePath);
    const source = fs.readFileSync(args.sourcePath, 'utf8');
    const currentDevelopmentFunction = args.dryRun
        ? { ETag: '<development-etag>' }
        : functionDescriber(args.name, 'DEVELOPMENT', false);
    const functionConfig = JSON.stringify({
        Comment: args.comment,
        Runtime: args.runtime
    });
    const sourceFileArg = `fileb://${args.sourcePath}`;
    let developmentETag = currentDevelopmentFunction?.ETag || null;

    if (currentDevelopmentFunction) {
        const updateResult = commandRunner('aws', [
            'cloudfront',
            'update-function',
            '--name',
            args.name,
            '--if-match',
            developmentETag,
            '--function-config',
            functionConfig,
            '--function-code',
            sourceFileArg,
            '--output',
            'json'
        ], { dryRun: args.dryRun });
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
    normalizeSource,
    parseJsonOutput,
    parseArgs,
    runCommand,
    verifyLiveSource
};
