/** @jest-environment node */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
const { getGroupedToolDefinitions, getRootPageDefinition, getToolById, getToolDefinitions } = require('./tool-manifest');
const {
    buildLlmsTxt,
    buildRobotsTxt,
    buildSitemapEntries,
    buildSitemapXml,
    resolveGitLastmodForPaths,
    toSitemapUrlItem,
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
    const artifactPaths = {
        sitemapPath: path.join(buildDir, 'sitemap.xml'),
        robotsPath: path.join(buildDir, 'robots.txt'),
        llmsTxtPath: path.join(buildDir, 'llms.txt')
    };
    const previousContents = Object.fromEntries(Object.values(artifactPaths).map((artifactPath) => [
        artifactPath,
        fs.existsSync(artifactPath) ? fs.readFileSync(artifactPath, 'utf8') : null
    ]));

    try {
        return run(artifactPaths);
    } finally {
        Object.entries(previousContents).forEach(([artifactPath, previousContent]) => {
            if (previousContent === null) {
                fs.rmSync(artifactPath, { force: true });
            } else {
                fs.writeFileSync(artifactPath, previousContent);
            }
        });
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
        expect(locations).toContain(getToolById('json-editor-tool').absolutePageUrl);
        expect(locations.some((location) => location.endsWith('/index.html'))).toBe(false);
        expect(locations.some((location) => location.includes('/styles.css'))).toBe(false);
        expect(locations.some((location) => location.includes('/root-shell/'))).toBe(false);
    });

    it('attaches an image entry (loc, title, caption) to the root page and every tool page', async () => {
        const xml = await buildSitemapXml({ resolveLastmod: () => null });

        expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');

        const urls = parseSitemap(xml);
        const rootImage = urls[0]['image:image'];
        expect(rootImage['image:loc']).toBe(getRootPageDefinition().imageUrl);
        expect(rootImage['image:title']).toBe(getRootPageDefinition().title);

        urls.forEach((entry) => {
            expect(entry['image:image']).toBeDefined();
            expect(typeof entry['image:image']['image:loc']).toBe('string');
        });

        const [firstTool] = getToolDefinitions();
        const firstToolEntry = urls.find((entry) => entry.loc === firstTool.absolutePageUrl);
        expect(firstToolEntry['image:image']['image:loc']).toBe(firstTool.absoluteFeaturedImageUrl);
        expect(firstToolEntry['image:image']['image:title']).toBe(firstTool.title);
    });

    it('maps sitemap url items, emitting lastmod and img only when present', () => {
        expect(toSitemapUrlItem({
            absoluteUrl: 'https://tools.codesamplez.com/diff-checker/',
            lastmod: '2026-04-20T00:00:00.000Z',
            images: [{ url: 'https://tools.codesamplez.com/diff-checker/images/featured.png', title: 'Diff Checker', caption: 'Compare text' }]
        })).toEqual({
            url: '/diff-checker/',
            lastmod: '2026-04-20T00:00:00.000Z',
            img: [{ url: 'https://tools.codesamplez.com/diff-checker/images/featured.png', title: 'Diff Checker', caption: 'Compare text' }]
        });

        // Image without title/caption keeps only the url; no lastmod key when absent.
        expect(toSitemapUrlItem({
            absoluteUrl: 'https://tools.codesamplez.com/diff-checker/',
            images: [{ url: 'https://tools.codesamplez.com/diff-checker/images/featured.png' }]
        })).toEqual({
            url: '/diff-checker/',
            img: [{ url: 'https://tools.codesamplez.com/diff-checker/images/featured.png' }]
        });

        // No images → no img key at all.
        expect(toSitemapUrlItem({ absoluteUrl: 'https://tools.codesamplez.com/diff-checker/', images: [] }))
            .toEqual({ url: '/diff-checker/' });
        expect(toSitemapUrlItem({ absoluteUrl: 'https://tools.codesamplez.com/diff-checker/' }))
            .toEqual({ url: '/diff-checker/' });
    });

    it('exposes images on built sitemap entries', () => {
        const entries = buildSitemapEntries({ resolveLastmod: () => null });

        expect(entries[0].images).toEqual([
            { url: getRootPageDefinition().imageUrl, title: getRootPageDefinition().title, caption: getRootPageDefinition().description }
        ]);
        expect(entries.every((entry) => Array.isArray(entry.images) && entry.images.length === 1)).toBe(true);
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

    it('builds an llms.txt manifest with the site summary and every tool page exactly once', () => {
        const llmsTxt = buildLlmsTxt();
        const rootPage = getRootPageDefinition();
        const tools = getToolDefinitions();

        expect(llmsTxt.startsWith(`# ${rootPage.title}\n\n> ${rootPage.description}`)).toBe(true);
        expect(llmsTxt).toContain(rootPage.absoluteUrl);
        expect(llmsTxt).toContain('- [Sitemap](https://tools.codesamplez.com/sitemap.xml)');

        tools.forEach((tool) => {
            const link = `- [${tool.title}](${tool.absolutePageUrl}): ${tool.indexDescription}`;
            expect(llmsTxt).toContain(link);
            expect(llmsTxt.indexOf(link)).toBe(llmsTxt.lastIndexOf(link));
        });
    });

    it('sections llms.txt by catalog group, omitting empty groups', () => {
        const llmsTxt = buildLlmsTxt();

        getGroupedToolDefinitions().forEach((group) => {
            expect(llmsTxt.includes(`## ${group.label}`)).toBe(group.tools.length > 0);
        });
    });

    it('writes generated sitemap, robots, and llms.txt assets into the target build directory', async () => {
        const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cst-generated-assets-'));

        try {
            const result = await writeGeneratedSiteAssets({
                buildDir,
                resolveLastmod: () => null
            });

            expect(result.sitemapPath).toBe(path.join(buildDir, 'sitemap.xml'));
            expect(result.robotsPath).toBe(path.join(buildDir, 'robots.txt'));
            expect(result.llmsTxtPath).toBe(path.join(buildDir, 'llms.txt'));
            expect(fs.readFileSync(result.sitemapPath, 'utf8')).toContain('<urlset');
            expect(fs.readFileSync(result.robotsPath, 'utf8')).toContain('Sitemap: https://tools.codesamplez.com/sitemap.xml');
            expect(fs.readFileSync(result.llmsTxtPath, 'utf8')).toBe(`${buildLlmsTxt()}\n`);
        } finally {
            fs.rmSync(buildDir, { force: true, recursive: true });
        }
    });

    it('writes ads.txt only when an AdSense client id is configured', async () => {
        const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cst-generated-assets-'));
        const previousClientId = process.env.CST_ADSENSE_CLIENT_ID;
        const previousNodeEnv = process.env.NODE_ENV;
        process.env.CST_ADSENSE_CLIENT_ID = 'ca-pub-1234567890123456';
        // Production env: ads.txt is only emitted for production builds.
        process.env.NODE_ENV = 'production';

        try {
            const result = await writeGeneratedSiteAssets({ buildDir, resolveLastmod: () => null });

            expect(result.adsTxtPath).toBe(path.join(buildDir, 'ads.txt'));
            expect(fs.readFileSync(result.adsTxtPath, 'utf8'))
                .toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
        } finally {
            if (typeof previousClientId === 'undefined') {
                delete process.env.CST_ADSENSE_CLIENT_ID;
            } else {
                process.env.CST_ADSENSE_CLIENT_ID = previousClientId;
            }
            if (typeof previousNodeEnv === 'undefined') {
                delete process.env.NODE_ENV;
            } else {
                process.env.NODE_ENV = previousNodeEnv;
            }
            fs.rmSync(buildDir, { force: true, recursive: true });
        }
    });

    it('omits ads.txt when AdSense is disabled (development gate)', async () => {
        const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cst-generated-assets-'));
        const previousNodeEnv = process.env.NODE_ENV;
        // The dev gate nulls the analytics config regardless of the configured id.
        process.env.NODE_ENV = 'development';

        try {
            const result = await writeGeneratedSiteAssets({ buildDir, resolveLastmod: () => null });

            expect(result.adsTxtPath).toBeNull();
            expect(fs.existsSync(path.join(buildDir, 'ads.txt'))).toBe(false);
        } finally {
            if (typeof previousNodeEnv === 'undefined') {
                delete process.env.NODE_ENV;
            } else {
                process.env.NODE_ENV = previousNodeEnv;
            }
            fs.rmSync(buildDir, { force: true, recursive: true });
        }
    });

    it('removes a stale ads.txt when AdSense is no longer configured', async () => {
        const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cst-generated-assets-'));
        const previousClientId = process.env.CST_ADSENSE_CLIENT_ID;
        const previousNodeEnv = process.env.NODE_ENV;
        // Seed a stale record from a previous build that had AdSense configured.
        const staleAdsTxtPath = path.join(buildDir, 'ads.txt');
        fs.mkdirSync(buildDir, { recursive: true });
        fs.writeFileSync(staleAdsTxtPath, 'google.com, pub-9999999999999999, DIRECT, f08c47fec0942fa0\n');
        process.env.NODE_ENV = 'production';
        delete process.env.CST_ADSENSE_CLIENT_ID;

        try {
            const result = await writeGeneratedSiteAssets({ buildDir, resolveLastmod: () => null });

            expect(result.adsTxtPath).toBeNull();
            expect(fs.existsSync(staleAdsTxtPath)).toBe(false);
        } finally {
            if (typeof previousClientId === 'undefined') {
                delete process.env.CST_ADSENSE_CLIENT_ID;
            } else {
                process.env.CST_ADSENSE_CLIENT_ID = previousClientId;
            }
            if (typeof previousNodeEnv === 'undefined') {
                delete process.env.NODE_ENV;
            } else {
                process.env.NODE_ENV = previousNodeEnv;
            }
            fs.rmSync(buildDir, { force: true, recursive: true });
        }
    });

    it('uses the default build directory when one is not provided', async () => {
        await withTemporaryBuildArtifacts(async ({ sitemapPath, robotsPath, llmsTxtPath }) => {
            const result = await writeGeneratedSiteAssets({
                resolveLastmod: () => null
            });

            expect(result.sitemapPath).toBe(sitemapPath);
            expect(result.robotsPath).toBe(robotsPath);
            expect(result.llmsTxtPath).toBe(llmsTxtPath);
            expect(fs.readFileSync(sitemapPath, 'utf8')).toContain('<urlset');
            expect(fs.readFileSync(robotsPath, 'utf8')).toContain('Sitemap: https://tools.codesamplez.com/sitemap.xml');
            expect(fs.readFileSync(llmsTxtPath, 'utf8')).toContain('## Metadata');
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
