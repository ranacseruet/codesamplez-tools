/** @jest-environment node */

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { PNG } = require('pngjs');

/**
 * @param {string} filePath
 * @param {Array<[number, number, number, number]>} pixels
 * @returns {Promise<void>}
 */
async function writePng(filePath, pixels) {
    const png = new PNG({ width: 2, height: 2 });
    pixels.forEach((pixel, index) => {
        const offset = index * 4;
        png.data[offset] = pixel[0];
        png.data[offset + 1] = pixel[1];
        png.data[offset + 2] = pixel[2];
        png.data[offset + 3] = pixel[3];
    });
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, PNG.sync.write(png));
}

/**
 * @param {string} configPath
 * @param {Partial<import('../types/qa-script-types').VisualRegressionConfig>} [overrides]
 * @returns {Promise<void>}
 */
async function writeConfig(configPath, overrides = {}) {
    const config = {
        baselineArtifactName: 'ui-foundation-visual-baseline',
        workingDirectory: '.',
        baseUrl: 'http://127.0.0.1:8080',
        readyUrl: 'http://127.0.0.1:8080',
        readyTimeoutSeconds: 45,
        resultsFile: 'visual-baseline-results.json',
        manifestFile: 'visual-screenshot-manifest.json',
        screenshotsRoot: '.',
        routes: [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop'
            }
        ],
        diff: {
            threshold: 0.01,
            mode: 'report-only'
        },
        ...overrides
    };

    await fs.writeFile(configPath, JSON.stringify(config));
}

/**
 * @param {string} resultsPath
 * @param {Array<Record<string, unknown>>} routes
 * @returns {Promise<void>}
 */
async function writeResults(resultsPath, routes) {
    await fs.mkdir(path.dirname(resultsPath), { recursive: true });
    await fs.writeFile(
        resultsPath,
        JSON.stringify({
            startedAt: new Date().toISOString(),
            baseUrl: 'http://127.0.0.1:8080',
            suite: 'visual-regression-capture',
            routes
        })
    );
}

/**
 * @param {string} manifestPath
 * @param {Array<Record<string, unknown>>} screenshots
 * @returns {Promise<void>}
 */
async function writeManifest(manifestPath, screenshots) {
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(
        manifestPath,
        JSON.stringify({
            generatedAt: new Date().toISOString(),
            baseUrl: 'http://127.0.0.1:8080',
            screenshots
        })
    );
}

describe('visual diff report generation', () => {
    let tempDir;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'visual-diff-report-'));
    });

    afterEach(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it('matches baseline and current screenshots by manifest id even when artifact directories differ', async () => {
        const { generateVisualDiffReport } = await import('./visual-diff-ui-foundation.mjs');

        const configPath = path.join(tempDir, 'visual-regression.json');
        const baselineDownloadDir = path.join(tempDir, 'baseline-download', 'artifact-root', 'nested');
        const currentRunDir = path.join(tempDir, 'workspace');
        const baselinePng = path.join(baselineDownloadDir, 'root-index-desktop.png');
        const currentPng = path.join(currentRunDir, 'qa-artifacts', 'visual-baselines', 'current', 'screenshots', 'root-index-desktop.png');
        const baselineResultsPath = path.join(tempDir, 'baseline-download', 'artifact-root', 'visual-baseline-results.json');
        const baselineManifestPath = path.join(tempDir, 'baseline-download', 'artifact-root', 'visual-screenshot-manifest.json');
        const currentResultsPath = path.join(currentRunDir, 'qa-artifacts', 'visual-baselines', 'current', 'visual-baseline-results.json');
        const currentManifestPath = path.join(currentRunDir, 'qa-artifacts', 'visual-baselines', 'current', 'visual-screenshot-manifest.json');

        await writeConfig(configPath, {
            resultsFile: 'qa-artifacts/visual-baselines/current/visual-baseline-results.json',
            manifestFile: 'qa-artifacts/visual-baselines/current/visual-screenshot-manifest.json',
            screenshotsRoot: 'qa-artifacts/visual-baselines/current'
        });

        await writePng(baselinePng, [
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255]
        ]);
        await writePng(currentPng, [
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255]
        ]);

        await fs.mkdir(path.dirname(baselineResultsPath), { recursive: true });
        await fs.mkdir(path.dirname(currentResultsPath), { recursive: true });

        await writeResults(baselineResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'passed',
                durationMs: 1,
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeManifest(baselineManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            },
            {
                id: 'ignored-route',
                path: '/ignored/',
                viewport: 'desktop',
                imagePath: 'screenshots/ignored-route.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeResults(currentResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'passed',
                durationMs: 1,
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeManifest(currentManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            },
            {
                id: 'ignored-route',
                path: '/ignored/',
                viewport: 'desktop',
                imagePath: 'screenshots/ignored-route.png',
                width: 1440,
                height: 900
            }
        ]);

        await fs.symlink(
            path.join(currentRunDir, 'qa-artifacts', 'visual-baselines', 'current', 'screenshots', 'root-index-desktop.png'),
            path.join(currentRunDir, 'ignored-link.png')
        );

        const { summary, markdown } = await generateVisualDiffReport({
            configPath,
            baselineResultsPath,
            baselineManifestPath,
            currentResultsPath,
            currentManifestPath,
            baselineRunDir: path.join(tempDir, 'baseline-download'),
            currentRunDir,
            routeIds: ['root-index-desktop'],
            baselineArtifactName: 'ui-foundation-visual-baseline',
            baselineSourceSha: 'abc123'
        });

        expect(summary.status).toBe('clean');
        expect(summary.selectedRoutes).toEqual(['root-index-desktop']);
        expect(summary.totalScreenshots).toBe(1);
        expect(summary.matchedScreenshots).toBe(1);
        expect(summary.changedScreenshots).toBe(0);
        expect(summary.missingInBaseline).toBe(0);
        expect(summary.missingInCurrent).toBe(0);
        expect(summary.errors).toHaveLength(0);
        expect(markdown).toContain('- Status: clean');
        expect(markdown).toContain('- Baseline artifact: `ui-foundation-visual-baseline`');

        const secondRun = await generateVisualDiffReport({
            configPath,
            baselineResultsPath,
            baselineManifestPath,
            currentResultsPath,
            currentManifestPath,
            baselineRunDir: path.join(tempDir, 'baseline-download'),
            currentRunDir,
            routeIds: ['root-index-desktop'],
            baselineArtifactName: 'ui-foundation-visual-baseline',
            baselineSourceSha: 'abc123'
        });
        expect(secondRun.summary.status).toBe('clean');
    });

    it('marks screenshots as changed when the mismatch ratio exceeds the configured threshold', async () => {
        const { generateVisualDiffReport, shouldFailVisualDiff } = await import('./visual-diff-ui-foundation.mjs');

        const configPath = path.join(tempDir, 'visual-regression.json');
        const baselineRunDir = path.join(tempDir, 'baseline');
        const currentRunDir = path.join(tempDir, 'current');
        const baselineResultsPath = path.join(baselineRunDir, 'visual-baseline-results.json');
        const baselineManifestPath = path.join(baselineRunDir, 'visual-screenshot-manifest.json');
        const currentResultsPath = path.join(currentRunDir, 'visual-baseline-results.json');
        const currentManifestPath = path.join(currentRunDir, 'visual-screenshot-manifest.json');

        await writeConfig(configPath, {
            diff: {
                threshold: 0.1,
                mode: 'strict'
            }
        });

        await writePng(path.join(baselineRunDir, 'screenshots', 'root-index-desktop.png'), [
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255]
        ]);
        await writePng(path.join(currentRunDir, 'screenshots', 'root-index-desktop.png'), [
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [0, 0, 255, 255]
        ]);

        await fs.mkdir(baselineRunDir, { recursive: true });
        await fs.mkdir(currentRunDir, { recursive: true });

        await writeResults(baselineResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'passed',
                durationMs: 1,
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeResults(currentResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'passed',
                durationMs: 1,
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeManifest(baselineManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeManifest(currentManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);

        const { summary } = await generateVisualDiffReport({
            configPath,
            baselineResultsPath,
            baselineManifestPath,
            currentResultsPath,
            currentManifestPath,
            baselineRunDir,
            currentRunDir,
            routeIds: ['root-index-desktop']
        });

        expect(summary.status).toBe('changes-detected');
        expect(summary.changedScreenshots).toBe(1);
        expect(summary.changed[0].mismatchRatio).toBe(0.25);
        expect(shouldFailVisualDiff(summary)).toBe(true);
    });

    it('defaults current paths and current run dir from the visual regression config', async () => {
        const { generateVisualDiffReport } = await import('./visual-diff-ui-foundation.mjs');

        const configPath = path.join(tempDir, 'visual-regression.json');
        const baselineRunDir = path.join(tempDir, 'baseline');
        const workingDirectory = path.join(tempDir, 'workspace');
        const baselineResultsPath = path.join(baselineRunDir, 'visual-baseline-results.json');
        const baselineManifestPath = path.join(baselineRunDir, 'visual-screenshot-manifest.json');
        const currentResultsPath = path.join(workingDirectory, 'current-defaults', 'visual-baseline-results.json');
        const currentManifestPath = path.join(workingDirectory, 'current-defaults', 'visual-screenshot-manifest.json');

        await writeConfig(configPath, {
            workingDirectory,
            resultsFile: 'current-defaults/visual-baseline-results.json',
            manifestFile: 'current-defaults/visual-screenshot-manifest.json',
            screenshotsRoot: 'current-defaults'
        });

        await writePng(path.join(baselineRunDir, 'screenshots', 'root-index-desktop.png'), [
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255]
        ]);
        await writePng(path.join(workingDirectory, 'current-defaults', 'screenshots', 'root-index-desktop.png'), [
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255]
        ]);

        await writeResults(baselineResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'passed',
                durationMs: 1,
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeManifest(baselineManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeResults(currentResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'passed',
                durationMs: 1,
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeManifest(currentManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);

        const { summary } = await generateVisualDiffReport({
            configPath,
            baselineResultsPath,
            baselineManifestPath,
            baselineRunDir,
            routeIds: ['root-index-desktop']
        });

        expect(summary.status).toBe('clean');
        expect(summary.currentResultsPath).toBe(currentResultsPath);
        expect(summary.currentManifestPath).toBe(currentManifestPath);
    });

    it('records incomplete comparisons when both manifests omit a failed route', async () => {
        const { generateVisualDiffReport } = await import('./visual-diff-ui-foundation.mjs');
        const configPath = path.join(tempDir, 'visual-regression.json');
        const baselineResultsPath = path.join(tempDir, 'baseline', 'visual-baseline-results.json');
        const baselineManifestPath = path.join(tempDir, 'baseline', 'visual-screenshot-manifest.json');
        const currentResultsPath = path.join(tempDir, 'current', 'visual-baseline-results.json');
        const currentManifestPath = path.join(tempDir, 'current', 'visual-screenshot-manifest.json');

        await writeConfig(configPath, {
            diff: {
                threshold: 0.01,
                mode: 'fail-on-incomplete'
            }
        });
        await writeResults(baselineResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'failed',
                durationMs: 1,
                error: 'baseline failed'
            }
        ]);
        await writeResults(currentResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'failed',
                durationMs: 1,
                error: 'current failed'
            }
        ]);
        await writeManifest(baselineManifestPath, []);
        await writeManifest(currentManifestPath, []);

        const { summary, markdown } = await generateVisualDiffReport({
            configPath,
            baselineResultsPath,
            baselineManifestPath,
            currentResultsPath,
            currentManifestPath,
            baselineRunDir: path.join(tempDir, 'baseline'),
            currentRunDir: path.join(tempDir, 'current'),
            routeIds: ['root-index-desktop']
        });

        expect(summary.status).toBe('incomplete');
        expect(summary.errors).toHaveLength(1);
        expect(summary.errors[0].message).toContain('Screenshot missing from both manifests.');
        expect(summary.errors[0].message).toContain('Baseline capture failed: baseline failed');
        expect(summary.errors[0].message).toContain('Current capture failed: current failed');
        expect(markdown).toContain('## Comparison errors');
    });

    it('reports missing baseline and current captures separately', async () => {
        const { generateVisualDiffReport } = await import('./visual-diff-ui-foundation.mjs');
        const configPath = path.join(tempDir, 'visual-regression.json');
        const baselineResultsPath = path.join(tempDir, 'baseline', 'visual-baseline-results.json');
        const baselineManifestPath = path.join(tempDir, 'baseline', 'visual-screenshot-manifest.json');
        const currentResultsPath = path.join(tempDir, 'current', 'visual-baseline-results.json');
        const currentManifestPath = path.join(tempDir, 'current', 'visual-screenshot-manifest.json');

        await writeConfig(configPath, {
            routes: [
                { id: 'root-index-desktop', path: '/', viewport: 'desktop' },
                { id: 'root-index-mobile', path: '/', viewport: 'mobile' }
            ]
        });
        await writeResults(baselineResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'passed',
                durationMs: 1,
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeResults(currentResultsPath, [
            {
                id: 'root-index-mobile',
                path: '/',
                viewport: 'mobile',
                status: 'passed',
                durationMs: 1,
                imagePath: 'screenshots/root-index-mobile.png',
                width: 390,
                height: 844
            }
        ]);
        await writeManifest(baselineManifestPath, [
            {
                id: 'root-index-mobile',
                path: '/',
                viewport: 'mobile',
                imagePath: 'screenshots/root-index-mobile.png',
                width: 390,
                height: 844
            }
        ]);
        await writeManifest(currentManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);

        const { summary, markdown } = await generateVisualDiffReport({
            configPath,
            baselineResultsPath,
            baselineManifestPath,
            currentResultsPath,
            currentManifestPath,
            baselineRunDir: path.join(tempDir, 'baseline'),
            currentRunDir: path.join(tempDir, 'current'),
            routeIds: ['root-index-desktop', 'root-index-mobile']
        });

        expect(summary.missingInBaseline).toBe(1);
        expect(summary.missingInCurrent).toBe(1);
        expect(summary.missing).toEqual([
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                location: 'baseline',
                reason: 'missing baseline capture'
            },
            {
                id: 'root-index-mobile',
                path: '/',
                viewport: 'mobile',
                location: 'current',
                reason: 'missing current capture'
            }
        ]);
        expect(markdown).toContain('## Missing screenshots');
    });

    it('raises errors for duplicate manifest ids and dimension mismatches', async () => {
        const { generateVisualDiffReport } = await import('./visual-diff-ui-foundation.mjs');
        const configPath = path.join(tempDir, 'visual-regression.json');
        const baselineDir = path.join(tempDir, 'baseline');
        const currentDir = path.join(tempDir, 'current');
        const baselineResultsPath = path.join(baselineDir, 'visual-baseline-results.json');
        const baselineManifestPath = path.join(baselineDir, 'visual-screenshot-manifest.json');
        const currentResultsPath = path.join(currentDir, 'visual-baseline-results.json');
        const currentManifestPath = path.join(currentDir, 'visual-screenshot-manifest.json');

        await writeConfig(configPath);
        await writeResults(baselineResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'passed',
                durationMs: 1,
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeResults(currentResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'passed',
                durationMs: 1,
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);

        await writeManifest(baselineManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            },
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop-copy.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeManifest(currentManifestPath, []);

        await expect(
            generateVisualDiffReport({
                configPath,
                baselineResultsPath,
                baselineManifestPath,
                currentResultsPath,
                currentManifestPath,
                baselineRunDir: baselineDir,
                currentRunDir: currentDir,
                routeIds: ['root-index-desktop']
            })
        ).rejects.toThrow('Duplicate screenshot id root-index-desktop detected in visual screenshot manifest.');

        await writeManifest(baselineManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeManifest(currentManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writePng(path.join(baselineDir, 'screenshots', 'root-index-desktop.png'), [
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255]
        ]);
        const tallPng = new PNG({ width: 1, height: 2 });
        tallPng.data.fill(255);
        await fs.mkdir(path.join(currentDir, 'screenshots'), { recursive: true });
        await fs.writeFile(path.join(currentDir, 'screenshots', 'root-index-desktop.png'), PNG.sync.write(tallPng));

        const { summary } = await generateVisualDiffReport({
            configPath,
            baselineResultsPath,
            baselineManifestPath,
            currentResultsPath,
            currentManifestPath,
            baselineRunDir: baselineDir,
            currentRunDir: currentDir,
            routeIds: ['root-index-desktop']
        });

        expect(summary.status).toBe('incomplete');
        expect(summary.errors[0].message).toContain('Dimension mismatch');
    });

    it('resolves duplicate basenames by matching the manifest path suffix', async () => {
        const { generateVisualDiffReport } = await import('./visual-diff-ui-foundation.mjs');
        const configPath = path.join(tempDir, 'visual-regression.json');
        const baselineDir = path.join(tempDir, 'baseline');
        const currentDir = path.join(tempDir, 'current');
        const baselineResultsPath = path.join(baselineDir, 'visual-baseline-results.json');
        const baselineManifestPath = path.join(baselineDir, 'visual-screenshot-manifest.json');
        const currentResultsPath = path.join(currentDir, 'visual-baseline-results.json');
        const currentManifestPath = path.join(currentDir, 'visual-screenshot-manifest.json');

        await writeConfig(configPath);
        await writeResults(baselineResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'passed',
                durationMs: 1,
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeResults(currentResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'passed',
                durationMs: 1,
                imagePath: 'nested/target/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeManifest(baselineManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeManifest(currentManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'nested/target/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);

        await writePng(path.join(baselineDir, 'screenshots', 'root-index-desktop.png'), [
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255]
        ]);
        await writePng(path.join(currentDir, 'nested', 'other', 'artifacts', 'nested', 'other', 'root-index-desktop.png'), [
            [0, 0, 255, 255],
            [0, 0, 255, 255],
            [0, 0, 255, 255],
            [0, 0, 255, 255]
        ]);
        await writePng(path.join(currentDir, 'alternate-root', 'artifacts', 'nested', 'target', 'root-index-desktop.png'), [
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255]
        ]);

        const { summary } = await generateVisualDiffReport({
            configPath,
            baselineResultsPath,
            baselineManifestPath,
            currentResultsPath,
            currentManifestPath,
            baselineRunDir: baselineDir,
            currentRunDir: currentDir,
            routeIds: ['root-index-desktop']
        });

        expect(summary.status).toBe('clean');
        expect(summary.matchedScreenshots).toBe(1);
    });

    it('surfaces missing screenshot files as comparison errors', async () => {
        const { generateVisualDiffReport } = await import('./visual-diff-ui-foundation.mjs');
        const configPath = path.join(tempDir, 'visual-regression.json');
        const baselineDir = path.join(tempDir, 'baseline');
        const currentDir = path.join(tempDir, 'current');
        const baselineResultsPath = path.join(baselineDir, 'visual-baseline-results.json');
        const baselineManifestPath = path.join(baselineDir, 'visual-screenshot-manifest.json');
        const currentResultsPath = path.join(currentDir, 'visual-baseline-results.json');
        const currentManifestPath = path.join(currentDir, 'visual-screenshot-manifest.json');

        await writeConfig(configPath);
        await writeResults(baselineResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'passed',
                durationMs: 1,
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeResults(currentResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'passed',
                durationMs: 1,
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeManifest(baselineManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeManifest(currentManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writePng(path.join(baselineDir, 'screenshots', 'root-index-desktop.png'), [
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255]
        ]);

        const { summary } = await generateVisualDiffReport({
            configPath,
            baselineResultsPath,
            baselineManifestPath,
            currentResultsPath,
            currentManifestPath,
            baselineRunDir: baselineDir,
            currentRunDir: currentDir,
            routeIds: ['root-index-desktop']
        });

        expect(summary.status).toBe('incomplete');
        expect(summary.errors[0].message).toContain('Unable to locate screenshot screenshots/root-index-desktop.png');
    });

    it('reports load failures for missing manifest files', async () => {
        const { generateVisualDiffReport } = await import('./visual-diff-ui-foundation.mjs');
        const configPath = path.join(tempDir, 'visual-regression.json');
        const baselineDir = path.join(tempDir, 'baseline');
        const currentDir = path.join(tempDir, 'current');

        await writeConfig(configPath);
        await writeResults(path.join(baselineDir, 'visual-baseline-results.json'), []);
        await writeResults(path.join(currentDir, 'visual-baseline-results.json'), []);

        await expect(
            generateVisualDiffReport({
                configPath,
                baselineResultsPath: path.join(baselineDir, 'visual-baseline-results.json'),
                baselineManifestPath: path.join(baselineDir, 'missing-manifest.json'),
                currentResultsPath: path.join(currentDir, 'visual-baseline-results.json'),
                currentManifestPath: path.join(currentDir, 'missing-manifest.json'),
                baselineRunDir: baselineDir,
                currentRunDir: currentDir,
                routeIds: ['root-index-desktop']
            })
        ).rejects.toThrow(/Unable to load (baseline|current) screenshot manifest/);
    });

    it('handles strict and fail-on-changes status helpers directly', async () => {
        const { determineVisualDiffStatus, shouldFailVisualDiff, formatVisualDiffFailureMessage } = await import('./visual-diff-ui-foundation.mjs');

        expect(
            determineVisualDiffStatus({
                changedScreenshots: 0,
                missingInBaseline: 0,
                missingInCurrent: 0,
                errors: []
            })
        ).toBe('clean');
        expect(
            determineVisualDiffStatus({
                changedScreenshots: 1,
                missingInBaseline: 0,
                missingInCurrent: 0,
                errors: []
            })
        ).toBe('changes-detected');
        expect(
            determineVisualDiffStatus({
                changedScreenshots: 0,
                missingInBaseline: 1,
                missingInCurrent: 0,
                errors: []
            })
        ).toBe('incomplete');

        expect(shouldFailVisualDiff({
            diffMode: 'report-only',
            changedScreenshots: 1,
            missingInBaseline: 1,
            missingInCurrent: 1,
            errors: [{}]
        })).toBe(false);
        expect(shouldFailVisualDiff({
            diffMode: 'fail-on-changes',
            changedScreenshots: 1,
            missingInBaseline: 0,
            missingInCurrent: 0,
            errors: []
        })).toBe(true);
        expect(shouldFailVisualDiff({
            diffMode: 'fail-on-incomplete',
            changedScreenshots: 0,
            missingInBaseline: 1,
            missingInCurrent: 0,
            errors: []
        })).toBe(true);
        expect(shouldFailVisualDiff({
            diffMode: 'strict',
            changedScreenshots: 0,
            missingInBaseline: 0,
            missingInCurrent: 0,
            errors: [{}]
        })).toBe(true);
        expect(formatVisualDiffFailureMessage('fail-on-changes', { changedScreenshots: 2 })).toContain('2 screenshot(s)');
        expect(formatVisualDiffFailureMessage('fail-on-incomplete', {})).toContain('comparison was incomplete');
        expect(formatVisualDiffFailureMessage('strict', {})).toContain('strict mode');
    });

    it('runs the CLI entry point and writes summaries before failing', async () => {
        const configPath = path.join(tempDir, 'visual-regression.json');
        const baselineDir = path.join(tempDir, 'baseline');
        const currentDir = path.join(tempDir, 'current');
        const outDir = path.join(tempDir, 'out');
        const baselineResultsPath = path.join(baselineDir, 'visual-baseline-results.json');
        const baselineManifestPath = path.join(baselineDir, 'visual-screenshot-manifest.json');
        const currentResultsPath = path.join(currentDir, 'visual-baseline-results.json');
        const currentManifestPath = path.join(currentDir, 'visual-screenshot-manifest.json');
        const summaryJson = path.join(outDir, 'visual-diff-summary.json');
        const summaryMarkdown = path.join(outDir, 'visual-diff-summary.md');

        await writeConfig(configPath, {
            diff: {
                threshold: 0.1,
                mode: 'fail-on-changes'
            }
        });
        await writeResults(baselineResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'passed',
                durationMs: 1,
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeResults(currentResultsPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                status: 'passed',
                durationMs: 1,
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeManifest(baselineManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writeManifest(currentManifestPath, [
            {
                id: 'root-index-desktop',
                path: '/',
                viewport: 'desktop',
                imagePath: 'screenshots/root-index-desktop.png',
                width: 1440,
                height: 900
            }
        ]);
        await writePng(path.join(baselineDir, 'screenshots', 'root-index-desktop.png'), [
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255]
        ]);
        await writePng(path.join(currentDir, 'screenshots', 'root-index-desktop.png'), [
            [255, 0, 0, 255],
            [0, 0, 255, 255],
            [255, 0, 0, 255],
            [255, 0, 0, 255]
        ]);

        const { runVisualDiffCli } = await import('./visual-diff-ui-foundation.mjs');

        await expect(runVisualDiffCli({
            configPath,
            baselineResultsPath,
            baselineManifestPath,
            currentResultsPath,
            currentManifestPath,
            baselineRunDir: baselineDir,
            currentRunDir: currentDir,
            outDir,
            summaryPath: summaryJson,
            markdownPath: summaryMarkdown,
            routeIds: ['root-index-desktop']
        })).rejects.toThrow(
            'Visual diff failed because 1 screenshot(s) exceeded the mismatch threshold.'
        );
        expect(JSON.parse(await fs.readFile(summaryJson, 'utf8')).changedScreenshots).toBe(1);
        expect(await fs.readFile(summaryMarkdown, 'utf8')).toContain('# Visual Diff Summary');
    });
});
