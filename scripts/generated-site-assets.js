// @ts-check

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { spawnSync } = require('child_process');
const { SitemapStream, streamToPromise } = require('sitemap');
const {
    REPO_ROOT,
    ROOT_CONFIG_PATH,
    buildAbsoluteUrl,
    getRootPageDefinition,
    getSiteBaseUrl,
    getToolDefinitions
} = require('./tool-manifest');

const SITEMAP_FILENAME = 'sitemap.xml';
const ROBOTS_FILENAME = 'robots.txt';
const SHARED_TOOL_LASTMOD_INPUTS = [
    ROOT_CONFIG_PATH,
    path.resolve(REPO_ROOT, 'common/material-theme.css'),
    path.resolve(REPO_ROOT, 'common/app-shell/app-shell.css'),
    path.resolve(REPO_ROOT, 'common/shared-styles.css'),
    path.resolve(REPO_ROOT, 'scripts/document-helpers.js'),
    path.resolve(REPO_ROOT, 'scripts/structured-data.js'),
    path.resolve(REPO_ROOT, 'scripts/tool-document.js')
];
const ROOT_PAGE_LASTMOD_INPUTS = [
    ROOT_CONFIG_PATH,
    path.resolve(REPO_ROOT, 'root-shell.ts'),
    path.resolve(REPO_ROOT, 'common/material-theme.css'),
    path.resolve(REPO_ROOT, 'common/app-shell/app-shell.css'),
    path.resolve(REPO_ROOT, 'scripts/document-helpers.js'),
    path.resolve(REPO_ROOT, 'scripts/root-document.js'),
    path.resolve(REPO_ROOT, 'scripts/structured-data.js')
];

/**
 * @param {string[]} values
 * @returns {string[]}
 */
function unique(values) {
    return Array.from(new Set(values));
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function toAbsolutePath(filePath) {
    return path.isAbsolute(filePath)
        ? filePath
        : path.resolve(REPO_ROOT, filePath);
}

/**
 * @returns {string[]}
 */
function getRootPageLastmodPaths() {
    return ROOT_PAGE_LASTMOD_INPUTS.slice();
}

/**
 * @param {{ sourceRoot: string }} tool
 * @returns {string[]}
 */
function getToolPageLastmodPaths(tool) {
    return unique([
        path.resolve(REPO_ROOT, tool.sourceRoot),
        ...SHARED_TOOL_LASTMOD_INPUTS
    ]);
}

/**
 * @param {string[]} paths
 * @param {{ spawnSyncImpl?: typeof spawnSync }} [options]
 * @returns {string | null}
 */
function resolveGitLastmodForPaths(paths, options = {}) {
    const spawnSyncImpl = options.spawnSyncImpl || spawnSync;
    const existingPaths = unique(paths.map(toAbsolutePath).filter((filePath) => fs.existsSync(filePath)));

    if (existingPaths.length === 0) {
        return null;
    }

    const relativePaths = existingPaths
        .map((filePath) => path.relative(REPO_ROOT, filePath))
        .filter(Boolean);

    if (relativePaths.length === 0) {
        return null;
    }

    const result = spawnSyncImpl('git', ['log', '-1', '--format=%cI', '--', ...relativePaths], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
    });

    if (result.status !== 0) {
        return null;
    }

    const timestamp = typeof result.stdout === 'string' ? result.stdout.trim() : '';

    if (!timestamp || Number.isNaN(Date.parse(timestamp))) {
        return null;
    }

    return new Date(timestamp).toISOString();
}

/**
 * @typedef {{ absoluteUrl: string, lastmod?: string }} SitemapEntry
 */

/**
 * @param {{ resolveLastmod?: (paths: string[], context: Record<string, unknown>) => string | null }} [options]
 * @returns {SitemapEntry[]}
 */
function buildSitemapEntries(options = {}) {
    const resolveLastmod = options.resolveLastmod || resolveGitLastmodForPaths;
    const rootPage = getRootPageDefinition();
    const tools = getToolDefinitions();
    const rootLastmod = resolveLastmod(getRootPageLastmodPaths(), { type: 'root-page' });

    return [
        {
            absoluteUrl: rootPage.absoluteUrl,
            ...(rootLastmod ? { lastmod: rootLastmod } : {})
        },
        ...tools.map((tool) => {
            const lastmod = resolveLastmod(getToolPageLastmodPaths(tool), {
                type: 'tool-page',
                toolId: tool.id
            });

            return {
                absoluteUrl: tool.absolutePageUrl,
                ...(lastmod ? { lastmod } : {})
            };
        })
    ];
}

/**
 * @param {{ resolveLastmod?: (paths: string[], context: Record<string, unknown>) => string | null }} [options]
 * @returns {Promise<string>}
 */
async function buildSitemapXml(options = {}) {
    const stream = new SitemapStream({
        hostname: getSiteBaseUrl(),
        xmlns: {
            news: false,
            xhtml: false,
            image: false,
            video: false
        }
    });
    const entries = buildSitemapEntries(options).map((entry) => {
        const location = new URL(entry.absoluteUrl);
        const url = `${location.pathname}${location.search}`;

        return entry.lastmod
            ? { url, lastmod: entry.lastmod }
            : { url };
    });

    return String(await streamToPromise(Readable.from(entries).pipe(stream)));
}

/**
 * @returns {string}
 */
function buildRobotsTxt() {
    return [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${buildAbsoluteUrl(getSiteBaseUrl(), SITEMAP_FILENAME)}`
    ].join('\n');
}

/**
 * @param {{ buildDir?: string, resolveLastmod?: (paths: string[], context: Record<string, unknown>) => string | null }} [options]
 * @returns {Promise<{ sitemapPath: string, robotsPath: string }>}
 */
async function writeGeneratedSiteAssets(options = {}) {
    const buildDir = path.resolve(options.buildDir || path.join(REPO_ROOT, 'build'));
    const sitemapPath = path.join(buildDir, SITEMAP_FILENAME);
    const robotsPath = path.join(buildDir, ROBOTS_FILENAME);
    const [sitemapXml, robotsTxt] = await Promise.all([
        buildSitemapXml({ resolveLastmod: options.resolveLastmod }),
        Promise.resolve(buildRobotsTxt())
    ]);

    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(sitemapPath, sitemapXml);
    fs.writeFileSync(robotsPath, `${robotsTxt}\n`);

    return {
        sitemapPath,
        robotsPath
    };
}

module.exports = {
    ROBOTS_FILENAME,
    SITEMAP_FILENAME,
    buildRobotsTxt,
    buildSitemapEntries,
    buildSitemapXml,
    getRootPageLastmodPaths,
    getToolPageLastmodPaths,
    resolveGitLastmodForPaths,
    writeGeneratedSiteAssets
};
