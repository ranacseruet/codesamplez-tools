// @ts-check

const fs = require('fs');
const path = require('path');
const { getToolDefinitions } = require('./tool-manifest');

const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'build', 'coverage', 'graft', 'tasks', '.git', '.github']);
const TEST_FILE_PATTERN = /\.test\.[cm]?[jt]sx?$/u;
// Every quoted relative specifier: `from './x'`, `import './x'`, `import('./x')`,
// `require('./x')`, `new URL('./x', import.meta.url)`. Deliberately over-inclusive
// (any quoted `./` or `../` string), so a stray match can only widen the set of
// tools asked to bump, never hide one.
const RELATIVE_SPECIFIER_PATTERN = /(['"`])(\.{1,2}\/[^'"`\s]+)\1/gu;

/**
 * @param {string} filePath repo-relative, forward slashes
 * @returns {boolean}
 */
function isTestFile(filePath) {
    return TEST_FILE_PATTERN.test(filePath);
}

/**
 * Whether a changed file is a `common/` source module whose impact can be
 * resolved from the import graph. Everything else under `common/` (CSS,
 * webpack alias shims, assets) is wired in by the build rather than by an
 * import, so it keeps the conservative every-tool behavior.
 * @param {string} filePath repo-relative, forward slashes
 * @returns {boolean}
 */
function isResolvableCommonFile(filePath) {
    return filePath.startsWith('common/')
        && !filePath.startsWith('common/shims/')
        && CODE_EXTENSIONS.includes(path.extname(filePath));
}

/**
 * @param {string} rootDirectory
 * @param {string} directory
 * @param {string[]} files
 * @returns {string[]}
 */
function collectCodeFiles(rootDirectory, directory, files = []) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!SKIPPED_DIRECTORIES.has(entry.name)) {
                collectCodeFiles(rootDirectory, path.join(directory, entry.name), files);
            }
        } else if (CODE_EXTENSIONS.includes(path.extname(entry.name))) {
            const relativePath = path.relative(rootDirectory, path.join(directory, entry.name)).split(path.sep).join('/');
            if (!isTestFile(relativePath)) {
                files.push(relativePath);
            }
        }
    }

    return files;
}

/**
 * @param {string} rootDirectory
 * @param {string} fromFile repo-relative importer
 * @param {string} specifier relative specifier as written
 * @returns {string | null} repo-relative target, or null when nothing on disk matches
 */
function resolveSpecifier(rootDirectory, fromFile, specifier) {
    const base = path.resolve(rootDirectory, path.dirname(fromFile), specifier);
    const candidates = [
        base,
        ...CODE_EXTENSIONS.map((extension) => `${base}${extension}`),
        // `./x.js` written for a `.ts` source (ESM-style specifiers).
        ...CODE_EXTENSIONS.map((extension) => `${base.replace(/\.[cm]?jsx?$/u, '')}${extension}`),
        ...CODE_EXTENSIONS.map((extension) => path.join(base, `index${extension}`))
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return path.relative(rootDirectory, candidate).split(path.sep).join('/');
        }
    }

    return null;
}

/**
 * Maps every shipped source file to the files that import it. Test files are
 * excluded as importers: they are never part of a tool's bundle.
 * @param {string} rootDirectory
 * @returns {Map<string, Set<string>>}
 */
function buildReverseImportGraph(rootDirectory) {
    /** @type {Map<string, Set<string>>} */
    const importersByTarget = new Map();

    for (const file of collectCodeFiles(rootDirectory, rootDirectory)) {
        const source = fs.readFileSync(path.join(rootDirectory, file), 'utf8');

        for (const match of source.matchAll(RELATIVE_SPECIFIER_PATTERN)) {
            const target = resolveSpecifier(rootDirectory, file, match[2]);

            if (target && target !== file) {
                const importers = importersByTarget.get(target) || new Set();
                importers.add(file);
                importersByTarget.set(target, importers);
            }
        }
    }

    return importersByTarget;
}

/**
 * Resolves which tools a changed `common/` source module can reach: every tool
 * whose files import it directly or through other modules.
 *
 * Returns `null` when the impact cannot be narrowed safely, and callers must
 * then treat every tool as affected. That covers files this resolver does not
 * handle, files missing at HEAD (deleted or renamed), and `common/` modules
 * imported directly by code outside any tool (build config, scripts), which
 * shape every tool's output.
 * @param {string} filePath repo-relative, forward slashes
 * @param {{ rootDirectory?: string, graph?: Map<string, Set<string>>, toolIdForPath?: (filePath: string) => string | null }} [options]
 * @returns {string[] | null} sorted tool ids
 */
function resolveToolsReachedByCommonFile(filePath, options = {}) {
    const rootDirectory = options.rootDirectory || process.cwd();

    if (!isResolvableCommonFile(filePath) || !fs.existsSync(path.join(rootDirectory, filePath))) {
        return null;
    }

    const graph = options.graph || buildReverseImportGraph(rootDirectory);
    const toolIdForPath = options.toolIdForPath || ((candidate) => {
        return getToolDefinitions().find((tool) => {
            return candidate === tool.sourceRoot || candidate.startsWith(`${tool.sourceRoot}/`);
        })?.id || null;
    });
    const tools = new Set();
    const visited = new Set([filePath]);
    const queue = [filePath];

    while (queue.length > 0) {
        const current = /** @type {string} */ (queue.shift());
        const currentIsToolFile = toolIdForPath(current) !== null;

        for (const importer of graph.get(current) || []) {
            if (visited.has(importer)) {
                continue;
            }
            visited.add(importer);

            const toolId = toolIdForPath(importer);

            if (toolId) {
                tools.add(toolId);
            } else if (!importer.startsWith('common/')) {
                if (currentIsToolFile) {
                    // Build scripts load each tool's own entry module to prerender it
                    // (scripts/prerender-tool.js). That is the tool being built, not
                    // shared code, so it must not fan out to every other tool.
                    continue;
                }

                // Build config, scripts or other shared code outside any tool imports
                // a common/ module directly: it can change every tool's output.
                return null;
            }

            queue.push(importer);
        }
    }

    return Array.from(tools).sort();
}

module.exports = {
    buildReverseImportGraph,
    isResolvableCommonFile,
    resolveToolsReachedByCommonFile
};
