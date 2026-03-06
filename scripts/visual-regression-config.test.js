/** @jest-environment node */

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

/**
 * @returns {import('../types/qa-script-types').VisualRegressionConfig}
 */
function makeConfig() {
    return {
        baselineArtifactName: 'ui-foundation-visual-baseline',
        workingDirectory: 'apps/site',
        baseUrl: 'http://127.0.0.1:8080',
        readyUrl: 'http://127.0.0.1:8080/ready',
        readyTimeoutSeconds: 45,
        resultsFile: 'qa-artifacts/visual-baselines/current/visual-baseline-results.json',
        manifestFile: 'qa-artifacts/visual-baselines/current/visual-screenshot-manifest.json',
        screenshotsRoot: 'qa-artifacts/visual-baselines/current',
        selection: {
            sharedPrefixes: ['common/', 'public-path.'],
            sharedExact: ['styles.css']
        },
        routes: [
            { id: 'root-index-desktop', path: '/', viewport: 'desktop' },
            { id: 'root-index-mobile', path: '/', viewport: 'mobile' },
            { id: 'tool-desktop', path: '/tool/', viewport: 'desktop', changePaths: ['tool/'] }
        ],
        diff: {
            threshold: 0.01,
            mode: 'report-only'
        }
    };
}

describe('visual regression config helpers', () => {
    let tempDir;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'visual-regression-config-'));
    });

    afterEach(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it('loads a valid config and resolves its path', async () => {
        const { loadVisualRegressionConfig } = await import('./visual-regression-config.mjs');
        const configPath = path.join(tempDir, 'visual-regression.json');
        const config = makeConfig();

        await fs.writeFile(configPath, JSON.stringify(config));

        const loaded = await loadVisualRegressionConfig(configPath);

        expect(loaded.config).toEqual(config);
        expect(loaded.configPath).toBe(configPath);
    });

    it('rejects an invalid config shape', async () => {
        const { loadVisualRegressionConfig } = await import('./visual-regression-config.mjs');
        const configPath = path.join(tempDir, 'invalid-visual-regression.json');

        await fs.writeFile(configPath, JSON.stringify({ baseUrl: 'http://127.0.0.1:8080' }));

        await expect(loadVisualRegressionConfig(configPath)).rejects.toThrow(
            `Invalid visual regression config at ${configPath}.`
        );
    });

    it('parses comma-separated lists and resolves working-directory paths', async () => {
        const { splitCommaList, resolveFromWorkingDirectory } = await import('./visual-regression-config.mjs');
        const config = makeConfig();

        expect(splitCommaList(' one, two ,, three ')).toEqual(['one', 'two', 'three']);
        expect(splitCommaList(undefined)).toEqual([]);
        expect(resolveFromWorkingDirectory(config, 'qa-artifacts/output.json')).toBe(
            path.resolve('apps/site', 'qa-artifacts/output.json')
        );
    });

    it('selects all configured routes when no subset is requested', async () => {
        const { selectConfiguredRoutes } = await import('./visual-regression-config.mjs');
        const config = makeConfig();

        const selected = selectConfiguredRoutes(config, []);

        expect(selected.selectedRouteIds).toEqual(['root-index-desktop', 'root-index-mobile', 'tool-desktop']);
        expect(selected.routes).toHaveLength(3);
    });

    it('selects only the requested routes and rejects unknown ids', async () => {
        const { selectConfiguredRoutes } = await import('./visual-regression-config.mjs');
        const config = makeConfig();

        const selected = selectConfiguredRoutes(config, ['tool-desktop', 'root-index-mobile']);
        expect(selected.selectedRouteIds).toEqual(['root-index-mobile', 'tool-desktop']);

        expect(() => selectConfiguredRoutes(config, ['missing-route'])).toThrow(
            'Unknown visual regression route ids: missing-route'
        );
    });

    it('scopes runs for shared changes, route changes, unrelated changes, and empty diffs', async () => {
        const { selectRoutesForChangedFiles } = await import('./visual-regression-config.mjs');
        const config = makeConfig();

        expect(selectRoutesForChangedFiles(config, ['styles.css'])).toEqual({
            shouldRun: true,
            reason: 'shared_visual_change',
            selectedRouteIds: ['root-index-desktop', 'root-index-mobile', 'tool-desktop']
        });

        expect(selectRoutesForChangedFiles(config, ['tool/src/index.ts'])).toEqual({
            shouldRun: true,
            reason: 'scoped_visual_change',
            selectedRouteIds: ['tool-desktop']
        });

        expect(selectRoutesForChangedFiles(config, ['docs/readme.md'])).toEqual({
            shouldRun: false,
            reason: 'no_visual_relevant_changes',
            selectedRouteIds: []
        });

        expect(selectRoutesForChangedFiles(config, [])).toEqual({
            shouldRun: false,
            reason: 'no_changed_files',
            selectedRouteIds: []
        });
    });
});
