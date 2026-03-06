/** @jest-environment node */

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

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

    it('matches baseline and PR screenshots by filename even when artifact directories differ', async () => {
        const { generateVisualDiffReport } = await import('./visual-diff-ui-foundation.mjs');

        const baselineDownloadDir = path.join(tempDir, 'baseline-download', 'artifact-root', 'nested');
        const currentRunDir = path.join(tempDir, 'workspace');
        const baselinePng = path.join(baselineDownloadDir, 'root-index-desktop.png');
        const currentPng = path.join(currentRunDir, 'qa-artifacts', 'visual-baselines', 'pr-current', 'root-index-desktop.png');
        const baselineResultsPath = path.join(tempDir, 'baseline-download', 'artifact-root', 'visual-baseline-results.json');
        const currentResultsPath = path.join(currentRunDir, 'qa-artifacts', 'visual-baselines', 'pr-current', 'visual-baseline-results.json');

        await fs.mkdir(path.dirname(baselinePng), { recursive: true });
        await fs.mkdir(path.dirname(currentPng), { recursive: true });
        await fs.writeFile(baselinePng, 'same-image-data');
        await fs.writeFile(currentPng, 'same-image-data');

        await fs.writeFile(
            baselineResultsPath,
            JSON.stringify({
                startedAt: new Date().toISOString(),
                baseUrl: 'http://127.0.0.1:8080',
                suite: 'visual-baseline',
                checks: [
                    {
                        name: 'root-index desktop baseline',
                        status: 'passed',
                        durationMs: 1,
                        screenshots: ['qa-artifacts/visual-baselines/ui-foundation/root-index-desktop.png']
                    }
                ]
            })
        );

        await fs.writeFile(
            currentResultsPath,
            JSON.stringify({
                startedAt: new Date().toISOString(),
                baseUrl: 'http://127.0.0.1:8080',
                suite: 'visual-baseline',
                checks: [
                    {
                        name: 'root-index desktop baseline',
                        status: 'passed',
                        durationMs: 1,
                        screenshots: ['qa-artifacts/visual-baselines/pr-current/root-index-desktop.png']
                    }
                ]
            })
        );

        const { summary, markdown } = await generateVisualDiffReport({
            baselineResultsPath,
            currentResultsPath,
            baselineRunDir: path.join(tempDir, 'baseline-download'),
            currentRunDir,
            allowedChecks: ['root-index desktop baseline'],
            baselineArtifactName: 'ui-foundation-visual-baseline',
            baselineSourceSha: 'abc123'
        });

        expect(summary.status).toBe('clean');
        expect(summary.totalScreenshots).toBe(1);
        expect(summary.matchedScreenshots).toBe(1);
        expect(summary.changedScreenshots).toBe(0);
        expect(summary.missingInBaseline).toBe(0);
        expect(summary.missingInCurrent).toBe(0);
        expect(summary.errors).toHaveLength(0);
        expect(markdown).toContain('- Status: clean');
        expect(markdown).toContain('- Baseline artifact: `ui-foundation-visual-baseline`');
    });
});
