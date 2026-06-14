/** @jest-environment node */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
const { getRootPageDefinition, getToolDefinitions } = require('./tool-manifest');
const {
    buildRobotsTxt,
    buildSitemapEntries,
    buildSitemapXml,
    resolveGitLastmodForPaths,
    writeGeneratedSiteAssets
} = require('./generated-site-assets');

function withEnv(overrides, run) {
    const originalEnv = { ...process.env };

    Object.entries(overrides).forEach(([key, value]) => {
        if (typeof value === 'undefined') {
            delete process.env[key];
            return;
        }

        process.env[key] = value;
    });

    try {
        return run();
    } finally {
        process.env = originalEnv;
    }
}

function parseSitemap(xml) {
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);
    const urls = parsed.urlset.url || [];

    return Array.isArray(urls) ? urls : [urls];
}

function withTemporaryBuildArtifacts(run) {
    const buildDir = path.resolve(process.cwd(), 'build');
    const sitemapPath = path.join(buildDir, 'sitemap.xml');
    const robotsPath = path.join(buildDir, 'robots.txt');
    const previousSitemap = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf8') : null;
    const previousRobots = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, 'utf8') : null;

    try {
        return run({ sitemapPath, robotsPath });
    } finally {
        if (previousSitemap === null) {
            fs.rmSync(sitemapPath, { force: true });
        } else {
            fs.writeFileSync(sitemapPath, previousSitemap);
        }

        if (previousRobots === null) {
            fs.rmSync(robotsPath, { force: true });
        } else {
            fs.writeFileSync(robotsPath, previousRobots);
        }
    }
}

describe('generated site assets', () => {
    it('builds a sitemap with the root page and every tool page exactly once', async () => {
        const xml = await buildSitemapXml({
            resolveLastmod: () => null
        });
        const urls = parseSitemap(xml);
        const locations = urls.map((entry) => entry.loc);
        const expectedLocations = [
            getRootPageDefinition().absoluteUrl,
            ...getToolDefinitions().map((tool) => tool.absolutePageUrl)
        ];

        expect(locations).toEqual(expectedLocations);
        expect(new Set(locations).size).toBe(expectedLocations.length);
        expect(locations.some((location) => location.endsWith('/index.html'))).toBe(false);
        expect(locations.some((location) => location.includes('/styles.css'))).toBe(false);
        expect(locations.some((location) => location.includes('/root-shell/'))).toBe(false);
    });

    it('includes per-entry lastmod values when the resolver returns them', async () => {
        const rootTimestamp = '2026-04-20T00:00:00.000Z';
        const toolTimestamp = '2026-04-19T00:00:00.000Z';
        const xml = await buildSitemapXml({
            resolveLastmod: (paths, context) => (context.type === 'root-page' ? rootTimestamp : toolTimestamp)
        });
        const urls = parseSitemap(xml);

        expect(urls[0].lastmod).toBe(rootTimestamp);
        expect(urls.slice(1).every((entry) => entry.lastmod === toolTimestamp)).toBe(true);
    });

    it('omits lastmod when the resolver cannot determine a timestamp', async () => {
        const xml = await buildSitemapXml({
            resolveLastmod: () => null
        });
        const urls = parseSitemap(xml);

        expect(urls.every((entry) => typeof entry.lastmod === 'undefined')).toBe(true);
    });

    it('passes shared tool-document inputs to every tool lastmod lookup', () => {
        const sharedTimestamp = '2026-04-18T00:00:00.000Z';
        const entries = buildSitemapEntries({
            resolveLastmod: (paths, context) => {
                if (context.type === 'tool-page' && paths.some((filePath) => filePath.endsWith('scripts/tool-document.js'))) {
                    return sharedTimestamp;
                }

                return null;
            }
        });

        expect(entries.slice(1).every((entry) => entry.lastmod === sharedTimestamp)).toBe(true);
    });

    it('builds an indexable robots file that points to the absolute static-root sitemap URL', () => {
        expect(buildRobotsTxt()).toBe([
            'User-agent: *',
            'Allow: /',
            '',
            'Sitemap: https://tools.codesamplez.com/sitemap.xml'
        ].join('\n'));
    });

    it('uses the static root override for the robots sitemap directive', () => {
        expect(withEnv({
            CST_SITE_BASE_URL: 'https://tools.codesamplez.com',
            CST_SITE_STATIC_ROOT_URI: 'https://static.example.test/tools-assets'
        }, () => buildRobotsTxt())).toBe([
            'User-agent: *',
            'Allow: /',
            '',
            'Sitemap: https://static.example.test/tools-assets/sitemap.xml'
        ].join('\n'));
    });

    it('returns an ISO timestamp from git log output and degrades on git failures', () => {
        expect(resolveGitLastmodForPaths(['package.json'], {
            spawnSyncImpl: () => ({
                status: 0,
                stdout: '2026-04-17T20:57:56-04:00\n'
            })
        })).toBe('2026-04-18T00:57:56.000Z');

        expect(resolveGitLastmodForPaths(['package.json'], {
            spawnSyncImpl: () => ({
                status: 1,
                stdout: ''
            })
        })).toBeNull();
    });

    it('returns null when no requested paths exist on disk', () => {
        expect(resolveGitLastmodForPaths(['definitely-not-a-real-file-for-coverage.txt'], {
            spawnSyncImpl: jest.fn()
        })).toBeNull();
    });

    it('returns null when the surviving path resolves to the repo root itself', () => {
        expect(resolveGitLastmodForPaths([process.cwd()], {
            spawnSyncImpl: jest.fn()
        })).toBeNull();
    });

    it('returns null when git output is not a valid timestamp', () => {
        expect(resolveGitLastmodForPaths(['package.json'], {
            spawnSyncImpl: () => ({
                status: 0,
                stdout: 'not-a-date'
            })
        })).toBeNull();
    });

    it('returns null when git output is not a string', () => {
        expect(resolveGitLastmodForPaths(['package.json'], {
            spawnSyncImpl: () => ({
                status: 0,
                stdout: Buffer.from('2026-04-17T20:57:56-04:00')
            })
        })).toBeNull();
    });

    it('can resolve git lastmod with the default options object', () => {
        const result = resolveGitLastmodForPaths(['package.json']);

        expect(result === null || typeof result === 'string').toBe(true);
    });

    it('can build sitemap entries with the default lastmod resolver', () => {
        const entries = buildSitemapEntries();

        expect(entries[0].absoluteUrl).toBe(getRootPageDefinition().absoluteUrl);
        expect(entries).toHaveLength(getToolDefinitions().length + 1);
    });

    it('can build sitemap xml without an injected lastmod resolver', async () => {
        const xml = await buildSitemapXml();
        const urls = parseSitemap(xml);

        expect(urls[0].loc).toBe(getRootPageDefinition().absoluteUrl);
        expect(urls).toHaveLength(getToolDefinitions().length + 1);
    });

    it('writes generated sitemap and robots assets into the target build directory', async () => {
        const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cst-generated-assets-'));

        try {
            const result = await writeGeneratedSiteAssets({
                buildDir,
                resolveLastmod: () => null
            });

            expect(result.sitemapPath).toBe(path.join(buildDir, 'sitemap.xml'));
            expect(result.robotsPath).toBe(path.join(buildDir, 'robots.txt'));
            expect(fs.readFileSync(result.sitemapPath, 'utf8')).toContain('<urlset');
            expect(fs.readFileSync(result.robotsPath, 'utf8')).toContain('Sitemap: https://tools.codesamplez.com/sitemap.xml');
        } finally {
            fs.rmSync(buildDir, { force: true, recursive: true });
        }
    });

    it('uses the default build directory when one is not provided', async () => {
        await withTemporaryBuildArtifacts(async ({ sitemapPath, robotsPath }) => {
            const result = await writeGeneratedSiteAssets({
                resolveLastmod: () => null
            });

            expect(result.sitemapPath).toBe(sitemapPath);
            expect(result.robotsPath).toBe(robotsPath);
            expect(fs.readFileSync(sitemapPath, 'utf8')).toContain('<urlset');
            expect(fs.readFileSync(robotsPath, 'utf8')).toContain('Sitemap: https://tools.codesamplez.com/sitemap.xml');
        });
    });

    it('can write generated site assets with the default options object', async () => {
        await withTemporaryBuildArtifacts(async ({ sitemapPath, robotsPath }) => {
            const result = await writeGeneratedSiteAssets();

            expect(result.sitemapPath).toBe(sitemapPath);
            expect(result.robotsPath).toBe(robotsPath);
            expect(fs.readFileSync(sitemapPath, 'utf8')).toContain('<urlset');
            expect(fs.readFileSync(robotsPath, 'utf8')).toContain('Sitemap: https://tools.codesamplez.com/sitemap.xml');
        });
    });
});
