// @ts-check

const { spawnSync } = require('node:child_process');

const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

/**
 * Advisories that are knowingly tolerated. Each entry is keyed by GHSA id and
 * MUST carry a reason and an expiry: an expired entry fails the audit again so
 * the exception cannot be forgotten.
 *
 * @type {Record<string, { reason: string, expires: string }>}
 */
const ALLOWED_ADVISORIES = {
    // braces <= 3.0.3 has no patched release. It is reached only through
    // webpack-cli -> webpack-dev-server -> http-proxy-middleware -> micromatch,
    // i.e. the `npm run dev` proxy matcher. Nothing in that chain is bundled
    // into the shipped static site, and the vulnerable input is dev-server proxy
    // config we author ourselves, not untrusted data. main() enforces the
    // dev-only premise by re-auditing with --omit=dev and no waivers.
    'GHSA-vfj7-8cjw-p6xm': {
        reason: 'braces has no patched version; dev-server-only transitive dependency',
        expires: '2026-11-04',
    },
};

/**
 * @param {string} url
 * @returns {string | null}
 */
function advisoryIdFromUrl(url) {
    const match = /GHSA-[a-z0-9-]+/i.exec(url || '');
    return match ? match[0] : null;
}

/**
 * `npm audit --json` lists each affected package under `vulnerabilities`. A
 * package's `via` holds advisory objects for advisories that hit it directly
 * and plain package names for ones inherited from a dependency, so only the
 * objects are independent findings.
 *
 * @param {any} report
 * @returns {{ id: string | null, title: string, severity: string, packageName: string }[]}
 */
function collectAdvisories(report) {
    const found = new Map();
    const vulnerabilities = (report && report.vulnerabilities) || {};

    for (const entry of Object.values(vulnerabilities)) {
        for (const via of (entry && entry.via) || []) {
            if (typeof via !== 'object' || via === null) {
                continue;
            }
            const id = advisoryIdFromUrl(via.url);
            const key = id || `${via.name}:${via.title}`;
            if (!found.has(key)) {
                found.set(key, {
                    id,
                    title: via.title,
                    severity: via.severity,
                    packageName: via.name,
                });
            }
        }
    }

    return Array.from(found.values());
}

/**
 * @param {any} report parsed `npm audit --json` output
 * @param {{ allowed?: Record<string, { reason: string, expires: string }>, now?: Date }} [options]
 * @returns {{ blocking: ReturnType<typeof collectAdvisories>, expired: string[], tolerated: string[], unusedAllowances: string[] }}
 */
function evaluateAudit(report, options = {}) {
    const allowed = options.allowed || ALLOWED_ADVISORIES;
    const now = options.now || new Date();
    const advisories = collectAdvisories(report).filter((advisory) => BLOCKING_SEVERITIES.has(advisory.severity));

    const blocking = [];
    const expired = [];
    const tolerated = [];

    for (const advisory of advisories) {
        const allowance = advisory.id ? allowed[advisory.id] : undefined;
        if (!allowance) {
            blocking.push(advisory);
        } else if (now.getTime() > Date.parse(`${allowance.expires}T23:59:59Z`)) {
            expired.push(/** @type {string} */ (advisory.id));
            blocking.push(advisory);
        } else {
            tolerated.push(/** @type {string} */ (advisory.id));
        }
    }

    const presentIds = new Set(advisories.map((advisory) => advisory.id));
    const unusedAllowances = Object.keys(allowed).filter((id) => !presentIds.has(id));

    return { blocking, expired, tolerated, unusedAllowances };
}

/**
 * Prefers the npm CLI that launched this script (`npm_execpath`, set by `npm
 * run`) executed through the current Node binary, which avoids the Windows
 * `npm.cmd` launcher that cannot be spawned without a shell. Falls back to
 * `npm` on PATH, using a shell on Windows only.
 *
 * @param {NodeJS.ProcessEnv} env
 * @param {string} platform
 * @param {string[]} args npm arguments
 * @returns {{ command: string, args: string[], shell: boolean }}
 */
function resolveNpmInvocation(env, platform, args) {
    if (env.npm_execpath) {
        return { command: process.execPath, args: [env.npm_execpath, ...args], shell: false };
    }
    return { command: 'npm', args, shell: platform === 'win32' };
}

/**
 * Parses `npm audit --json` output, failing closed. An unparseable, empty or
 * non-object payload must never be read as "no vulnerabilities".
 *
 * @param {string | null | undefined} stdout
 * @returns {any}
 */
function parseAuditOutput(stdout) {
    if (typeof stdout !== 'string' || stdout.trim() === '') {
        throw new Error('npm audit produced no output');
    }

    let report;
    try {
        report = JSON.parse(stdout);
    } catch (error) {
        throw new Error(`npm audit output was not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (typeof report !== 'object' || report === null) {
        throw new Error('npm audit output was not a JSON object');
    }
    if (report.error) {
        throw new Error(`npm audit failed: ${report.error.summary || report.error.code}`);
    }
    return report;
}

/**
 * @param {string[]} extraArgs
 * @returns {any}
 */
function runAudit(extraArgs) {
    const invocation = resolveNpmInvocation(process.env, process.platform, ['audit', '--json', '--audit-level=high', ...extraArgs]);
    const result = spawnSync(invocation.command, invocation.args, {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        shell: invocation.shell,
    });

    if (result.error) {
        throw new Error(`could not run npm audit: ${result.error.message}`);
    }
    // npm audit exits 1 when it finds vulnerabilities; anything else (signal, 2+) is a tooling failure.
    if (result.status !== 0 && result.status !== 1) {
        throw new Error(`npm audit exited with status ${result.status}: ${result.stderr || 'no stderr'}`);
    }
    return parseAuditOutput(result.stdout);
}

/**
 * @param {string} label
 * @param {ReturnType<typeof evaluateAudit>} outcome
 * @returns {boolean} true when the audit passed
 */
function reportOutcome(label, outcome) {
    const { blocking, expired } = outcome;
    if (blocking.length === 0) {
        return true;
    }

    console.error(`${label} audit failed. Blocking advisories:`);
    for (const advisory of blocking) {
        const suffix = advisory.id && expired.includes(advisory.id) ? ' (allowlist entry expired)' : '';
        console.error(`  - [${advisory.severity}] ${advisory.packageName}: ${advisory.title} ${advisory.id || ''}${suffix}`);
    }
    return false;
}

function main() {
    let fullReport;
    let productionReport;
    try {
        fullReport = runAudit([]);
        productionReport = runAudit(['--omit=dev']);
    } catch (error) {
        console.error(`Dependency audit could not complete: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }

    const full = evaluateAudit(fullReport);
    // The allowlist is justified by the advisory being dev-only, so production
    // dependencies get no waivers: if it ever becomes reachable from them, this fails.
    const production = evaluateAudit(productionReport, { allowed: {} });

    for (const id of full.tolerated) {
        console.warn(`Tolerated ${id} until ${ALLOWED_ADVISORIES[id].expires}: ${ALLOWED_ADVISORIES[id].reason}`);
    }
    for (const id of full.unusedAllowances) {
        console.warn(`Allowlist entry ${id} no longer matches any advisory; remove it from scripts/audit-deps.js.`);
    }

    const fullPassed = reportOutcome('Dependency', full);
    const productionPassed = reportOutcome('Production dependency', production);

    if (!fullPassed || !productionPassed) {
        console.error('Run `npm audit` for the dependency paths.');
        process.exit(1);
    }

    console.log('Dependency audit passed: production dependencies are clean and no high/critical dev advisories are outside the allowlist.');
}

if (require.main === module) {
    main();
}

module.exports = {
    ALLOWED_ADVISORIES,
    advisoryIdFromUrl,
    collectAdvisories,
    evaluateAudit,
    parseAuditOutput,
    resolveNpmInvocation,
};
