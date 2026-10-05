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
    // config we author ourselves, not untrusted data.
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

function main() {
    const result = spawnSync('npm', ['audit', '--json', '--audit-level=high'], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });

    let report;
    try {
        report = JSON.parse(result.stdout);
    } catch (error) {
        console.error('Could not parse `npm audit --json` output:', result.stderr || String(error));
        process.exit(1);
    }

    if (report && report.error) {
        console.error(`npm audit failed: ${report.error.summary || report.error.code}`);
        process.exit(1);
    }

    const { blocking, expired, tolerated, unusedAllowances } = evaluateAudit(report);

    for (const id of tolerated) {
        console.warn(`Tolerated ${id} until ${ALLOWED_ADVISORIES[id].expires}: ${ALLOWED_ADVISORIES[id].reason}`);
    }
    for (const id of unusedAllowances) {
        console.warn(`Allowlist entry ${id} no longer matches any advisory; remove it from scripts/audit-deps.js.`);
    }

    if (blocking.length === 0) {
        console.log('Dependency audit passed: no high/critical advisories outside the allowlist.');
        return;
    }

    console.error('Dependency audit failed. Blocking advisories:');
    for (const advisory of blocking) {
        const suffix = advisory.id && expired.includes(advisory.id) ? ' (allowlist entry expired)' : '';
        console.error(`  - [${advisory.severity}] ${advisory.packageName}: ${advisory.title} ${advisory.id || ''}${suffix}`);
    }
    console.error('Run `npm audit` for the dependency paths.');
    process.exit(1);
}

if (require.main === module) {
    main();
}

module.exports = { ALLOWED_ADVISORIES, advisoryIdFromUrl, collectAdvisories, evaluateAudit };
