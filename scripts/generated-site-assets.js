// @ts-check

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { spawnSync } = require('child_process');
const { SitemapStream, streamToPromise } = require('sitemap');
const {
    ADS_TXT_FILENAME,
    REPO_ROOT,
    ROOT_CONFIG_PATH,
    buildAbsoluteUrl,
    getAdsenseClientId,
    getRootPageDefinition,
    getSiteBaseUrl,
    getSiteStaticRootUri,
    getToolDefinitions
} = require('./tool-manifest');
const { buildAdsTxt } = require('./analytics');

const SITEMAP_FILENAME = 'sitemap.xml';
const ROBOTS_FILENAME = 'robots.txt';
const SHARED_TOOL_LASTMOD_INPUTS = [
    ROOT_CONFIG_PATH,
    path.resolve(REPO_ROOT, 'common/material-theme.css'),
    path.resolve(REPO_ROOT, 'common/app-shell/app-shell.css'),
    path.resolve(REPO_ROOT, 'common/shared-styles.css'),
    path.resolve(REPO_ROOT, 'scripts/analytics.js'),
    path.resolve(REPO_ROOT, 'scripts/document-helpers.js'),
    path.resolve(REPO_ROOT, 'scripts/structured-data.js'),
    path.resolve(REPO_ROOT, 'scripts/tool-document.js')
];
const ROOT_PAGE_LASTMOD_INPUTS = [
    ROOT_CONFIG_PATH,
    path.resolve(REPO_ROOT, 'root-shell.ts'),
    path.resolve(REPO_ROOT, 'common/material-theme.css'),
    path.resolve(REPO_ROOT, 'common/app-shell/app-shell.css'),
    path.resolve(REPO_ROOT, 'scripts/analytics.js'),
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
 * @typedef {{ url: string, title?: string, caption?: string }} SitemapImage
 * @typedef {{ absoluteUrl: string, lastmod?: string, images?: SitemapImage[] }} SitemapEntry
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
            ...(rootLastmod ? { lastmod: rootLastmod } : {}),
            images: [{ url: rootPage.imageUrl, title: rootPage.title, caption: rootPage.description }]
        },
        ...tools.map((tool) => {
            const lastmod = resolveLastmod(getToolPageLastmodPaths(tool), {
                type: 'tool-page',
                toolId: tool.id
            });

            return {
                absoluteUrl: tool.absolutePageUrl,
                ...(lastmod ? { lastmod } : {}),
                images: [{ url: tool.absoluteFeaturedImageUrl, title: tool.title, caption: tool.description }]
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
            image: true,
            video: false
        }
    });
    const entries = buildSitemapEntries(options).map(toSitemapUrlItem);

    return String(await streamToPromise(Readable.from(entries).pipe(stream)));
}

/**
 * Maps a {@link SitemapEntry} to the `sitemap` package's url-item shape, emitting
 * `lastmod` and `img` only when present so optional fields never serialize empty.
 * @param {SitemapEntry} entry
 * @returns {{ url: string, lastmod?: string, img?: { url: string, title?: string, caption?: string }[] }}
 */
function toSitemapUrlItem(entry) {
    const location = new URL(entry.absoluteUrl);
    const url = `${location.pathname}${location.search}`;
    const img = Array.isArray(entry.images) && entry.images.length > 0
        ? entry.images.map((image) => ({
            url: image.url,
            ...(image.title ? { title: image.title } : {}),
            ...(image.caption ? { caption: image.caption } : {})
        }))
        : undefined;

    return {
        url,
        ...(entry.lastmod ? { lastmod: entry.lastmod } : {}),
        ...(img ? { img } : {})
    };
}

/**
 * @returns {string}
 */
function buildRobotsTxt() {
    return [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${buildAbsoluteUrl(getSiteStaticRootUri(), SITEMAP_FILENAME)}`
    ].join('\n');
}

/**
 * @param {{ buildDir?: string, resolveLastmod?: (paths: string[], context: Record<string, unknown>) => string | null }} [options]
 * @returns {Promise<{ sitemapPath: string, robotsPath: string, adsTxtPath: string | null }>}
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

    // ads.txt only exists when AdSense is configured; skip the file otherwise so
    // we never ship an empty authorization record.
    const adsTxt = buildAdsTxt(getAdsenseClientId());
    const adsTxtPath = adsTxt ? path.join(buildDir, ADS_TXT_FILENAME) : null;
    if (adsTxtPath) {
        fs.writeFileSync(adsTxtPath, `${adsTxt}\n`);
    }

    return {
        sitemapPath,
        robotsPath,
        adsTxtPath
    };
}

module.exports = {
    ADS_TXT_FILENAME,
    ROBOTS_FILENAME,
    SITEMAP_FILENAME,
    buildRobotsTxt,
    buildSitemapEntries,
    buildSitemapXml,
    getRootPageLastmodPaths,
    getToolPageLastmodPaths,
    resolveGitLastmodForPaths,
    toSitemapUrlItem,
    writeGeneratedSiteAssets
};
