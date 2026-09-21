// @ts-check

/**
 * Test-time Node version gate.
 *
 * Jest 30 resolves ESM-only modules (common/worker-thresholds.mjs,
 * @babel/parser) through Node's native `require(esm)`, which needs Node
 * >= 24.9. On older runtimes Jest still starts and then explodes with 17+
 * "Must use import to load ES Module" suite failures that look like real
 * regressions. This guard fails fast with a one-line explanation instead.
 *
 * The floor is intentionally the true runtime requirement (24.9.0) rather
 * than the engines range floor (24.15.0): both are satisfied by the same
 * Node 24 LTS line, but the guard should never block a Node that could
 * actually run the suites.
 */

const MIN_NODE_VERSION = '24.9.0';

/**
 * Compares dotted numeric version strings: negative when a < b, positive
 * when a > b, 0 when equal. Deliberately dependency-free — this runs before
 * jest, so it cannot rely on devDependencies being resolvable from here.
 * @param {string} versionA
 * @param {string} versionB
 * @returns {number}
 */
function compareDottedVersions(versionA, versionB) {
    const partsA = versionA.split('.');
    const partsB = versionB.split('.');
    const length = Math.max(partsA.length, partsB.length);

    for (let index = 0; index < length; index += 1) {
        const partA = Number(partsA[index]) || 0;
        const partB = Number(partsB[index]) || 0;

        if (partA !== partB) {
            return partA - partB;
        }
    }

    return 0;
}

/**
 * Strips pre-release/build suffixes (e.g. "24.9.0-nightly.1") and returns
 * null for anything that is not dotted numeric text.
 * @param {string} version
 * @returns {string | null}
 */
function normalizeNodeVersion(version) {
    if (typeof version !== 'string') {
        return null;
    }

    const [numericPart] = version.split('-');
    return /^\d+(\.\d+)*$/.test(numericPart) ? numericPart : null;
}

/**
 * @param {string} [nodeVersion]
 * @returns {boolean}
 */
function isNodeVersionSupported(nodeVersion = process.versions.node) {
    const normalized = normalizeNodeVersion(nodeVersion);

    if (!normalized) {
        return false;
    }

    return compareDottedVersions(normalized, MIN_NODE_VERSION) >= 0;
}

/**
 * Exits non-zero with guidance when the current runtime is too old.
 * @param {{ nodeVersion?: string, log?: (message: string) => void, exit?: (code: number) => void }} [options]
 * @returns {void}
 */
function main(options = {}) {
    const log = options.log || ((message) => console.error(message));
    const exit = options.exit || ((code) => process.exit(code));
    const nodeVersion = options.nodeVersion || process.versions.node;

    if (isNodeVersionSupported(nodeVersion)) {
        return;
    }

    log([
        `Node >= ${MIN_NODE_VERSION} is required to run Jest 30 (native require(esm)); received ${nodeVersion}.`,
        '',
        'Use a Node 24 LTS release (see .nvmrc), e.g.:',
        '  nvm install && nvm use',
        '  # or: nvm install 24 && nvm use 24',
        '',
        'Then reinstall if you switched majors: rm -rf node_modules && npm install'
    ].join('\n'));

    exit(1);
}

if (require.main === module) {
    main();
}

module.exports = {
    MIN_NODE_VERSION,
    compareDottedVersions,
    isNodeVersionSupported,
    main
};
