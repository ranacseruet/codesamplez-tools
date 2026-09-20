// @ts-check

const {
    SKIP_LABEL,
    compareVersions,
    demandsVersionBump,
    findMissingBumps,
    readVersionAtRevision
} = require('./check-version-bumps');
const { detectAffectedTargets, getToolIdForPath } = require('./affected-tools');

// Version reader pinned to origin/main so unit tests exercise the real
// comparison logic without depending on the working tree's meta files.
const readVersionAtMain = (revision, toolId) => readVersionAtRevision('origin/main', toolId);

describe('check-version-bumps', () => {
    describe('compareVersions', () => {
        it.each([
            ['1.0.0', '1.0.0', 0],
            ['1.0.1', '1.0.0', 1],
            ['1.0.0', '1.0.1', -1],
            ['1.1.0', '1.0.9', 1],
            ['2.0.0', '1.9.9', 1],
            ['1.10.0', '1.9.0', 1]
        ])('compares %s vs %s', (versionA, versionB, expectedSign) => {
            const result = compareVersions(versionA, versionB);

            expect(Math.sign(result)).toBe(expectedSign);
        });
    });

    describe('demandsVersionBump', () => {
        it.each([
            ['base64-converter/script.tsx', true],
            ['base64-converter/json-format-core.ts', true],
            ['base64-converter/images/foo.png', true],
            ['base64-converter/README.md', false],
            ['json-formatter/tool.meta.json', false],
            ['common/clipboard.ts', true],
            ['scripts/check-version-bumps.js', false],
            ['scripts/tool-release.js', false],
            ['.github/workflows/ci.yml', false],
            ['scripts/root-page-content.js', false]
        ])('classifies %s as %s', (filePath, expected) => {
            expect(demandsVersionBump(filePath)).toBe(expected);
        });

        it('treats every all-tools trigger as demanding a bump from every tool', () => {
            const { isAllToolsTrigger } = require('./affected-tools');
            const sharedTriggers = ['package.json', 'webpack.config.js', 'scripts/tool-manifest.js', 'common/notification-manager.ts'];

            sharedTriggers.forEach((filePath) => {
                expect({ filePath, demands: demandsVersionBump(filePath), isShared: isAllToolsTrigger(filePath) })
                    .toEqual({ filePath, demands: true, isShared: true });
            });
        });
    });

    describe('readVersionAtRevision', () => {
        it('reads the base version from git history', () => {
            expect(readVersionAtRevision('origin/main', 'base64-converter-tool')).toBe('1.0.0');
        });

        it('returns null for an unknown revision', () => {
            expect(readVersionAtRevision('no-such-ref-exists', 'base64-converter-tool')).toBe(null);
        });
    });

    describe('findMissingBumps', () => {
        const toolId = getToolIdForPath('base64-converter/script.tsx');
        const workingVersions = { [toolId]: '1.0.0' };

        it('flags a tool whose runtime file changed without a bump', () => {
            const missing = findMissingBumps(['base64-converter/script.tsx'], 'any-base', {
                workingVersions,
                readVersionAt: readVersionAtMain
            });

            expect(missing).toEqual([toolId]);
        });

        it('passes when the tool bumped its version', () => {
            const missing = findMissingBumps(['base64-converter/script.tsx'], 'any-base', {
                workingVersions: { [toolId]: '1.0.1' },
                readVersionAt: readVersionAtMain
            });

            expect(missing).toEqual([]);
        });

        it('ignores doc-only changes within a tool directory', () => {
            const missing = findMissingBumps(['base64-converter/README.md'], 'any-base', {
                workingVersions,
                readVersionAt: readVersionAtMain
            });

            expect(missing).toEqual([]);
        });

        it('flags every affected tool for a shared runtime change', () => {
            const affectedTools = detectAffectedTargets(['common/clipboard.ts']).affectedTools;
            const missing = findMissingBumps(['common/clipboard.ts'], 'any-base', {
                workingVersions: Object.fromEntries(affectedTools.map((id) => [id, '1.0.0'])),
                readVersionAt: readVersionAtMain
            });

            expect(missing.sort()).toEqual([...affectedTools].sort());
        });

        it('passes for shared runtime changes when every affected tool bumped', () => {
            const affectedTools = detectAffectedTargets(['common/clipboard.ts']).affectedTools;
            const missing = findMissingBumps(['common/clipboard.ts'], 'any-base', {
                workingVersions: Object.fromEntries(affectedTools.map((id) => [id, '1.1.0'])),
                readVersionAt: readVersionAtMain
            });

            expect(missing).toEqual([]);
        });

        it('deduplicates candidates from multiple changed files of one tool', () => {
            const missing = findMissingBumps([
                'base64-converter/script.tsx',
                'base64-converter/clipboard.ts'
            ], 'any-base', {
                workingVersions,
                readVersionAt: readVersionAtMain
            });

            expect(missing).toEqual([toolId]);
        });
    });

    describe('SKIP_LABEL', () => {
        it('is the label the CI workflow checks', () => {
            expect(SKIP_LABEL).toBe('skip-version-bump');
        });
    });
});