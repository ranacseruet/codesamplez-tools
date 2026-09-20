// @ts-check

const fs = require('fs');
const path = require('path');
const {
    SKIP_LABEL,
    compareVersions,
    demandsVersionBump,
    findMissingBumps,
    readVersionAtRevision
} = require('./check-version-bumps');
const { detectAffectedTargets, getToolIdForPath } = require('./affected-tools');

// Version reader pinned to the PR's merge-base commit, not the live ref:
// origin/main moves when this PR merges, so a hardcoded expectation there
// breaks the first post-merge CI run. A fixed SHA is immutable.
const MERGE_BASE_COMMIT = 'd0dd57c9654ad630764a16859e0441dc5a7c084a';
const readVersionAtMergeBase = (revision, toolId) => readVersionAtRevision(MERGE_BASE_COMMIT, toolId);

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

        describe('tool.meta.json edits', () => {
            const metadataFixture = (overrides = {}) => JSON.stringify({
                id: 'base64-converter-tool',
                version: '1.0.0',
                title: 'Base64 Converter',
                description: 'Convert text',
                catalogGroupId: 'encoders-decoders',
                ...overrides
            });

            it('ignores the version bump itself (only the version field changed)', () => {
                const demands = demandsVersionBump('base64-converter/tool.meta.json', {
                    previousContent: metadataFixture({ version: '1.0.0' }),
                    currentContent: metadataFixture({ version: '1.0.1' })
                });

                expect(demands).toBe(false);
            });

            it('ignores a version bump that also rewrites dependencyScopes', () => {
                const demands = demandsVersionBump('base64-converter/tool.meta.json', {
                    previousContent: metadataFixture({ version: '1.0.0', dependencyScopes: ['shared-ui'] }),
                    currentContent: metadataFixture({ version: '1.0.1', dependencyScopes: ['shared-ui', 'shared-runtime'] })
                });

                expect(demands).toBe(false);
            });

            it('demands a bump when a content field like description changed', () => {
                const demands = demandsVersionBump('base64-converter/tool.meta.json', {
                    previousContent: metadataFixture(),
                    currentContent: metadataFixture({ description: 'Rewritten description' })
                });

                expect(demands).toBe(true);
            });

            it('demands a bump for an unreadable current file', () => {
                const demands = demandsVersionBump('base64-converter/tool.meta.json', {
                    previousContent: metadataFixture(),
                    currentContent: null
                });

                expect(demands).toBe(true);
            });

            it('demands a bump when a tool is newly added (no previous content)', () => {
                const demands = demandsVersionBump('new-tool/tool.meta.json', {
                    previousContent: null,
                    currentContent: metadataFixture()
                });

                expect(demands).toBe(true);
            });
        });
    });

    describe('readVersionAtRevision', () => {
        it('reads the base version from a pinned historical commit', () => {
            // The PR merge-base, not a moving ref: this commit pins
            // base64-converter-tool at 1.0.0 forever.
            expect(readVersionAtRevision(MERGE_BASE_COMMIT, 'base64-converter-tool')).toBe('1.0.0');
        });

        it('returns null for a file absent at the revision (new tool path shape)', () => {
            // 'future-tool/tool.meta.json' is a valid repo-relative metadata
            // path that does not exist at the pinned revision — the new-tool
            // case. The error-vs-absent split is what keeps enforcement
            // fail-closed everywhere else.
            const { readGitFileAt } = require('./check-version-bumps');

            expect(readGitFileAt(MERGE_BASE_COMMIT, 'future-tool/tool.meta.json')).toEqual({ status: 'absent' });
            expect(() => readVersionAtRevision(MERGE_BASE_COMMIT, 'json-formatter-tool')).not.toThrow();
        });

        it('throws for an unreachable revision instead of failing open', () => {
            expect(() => readVersionAtRevision('no-such-ref-exists', 'base64-converter-tool'))
                .toThrow(/Failed to read .* at no-such-ref-exists/u);
        });
    });

    describe('findMissingBumps', () => {
        const toolId = getToolIdForPath('base64-converter/script.tsx');
        const workingVersions = { [toolId]: '1.0.0' };

        it('flags a tool whose runtime file changed without a bump', () => {
            const missing = findMissingBumps(['base64-converter/script.tsx'], 'any-base', {
                workingVersions,
                readVersionAt: readVersionAtMergeBase
            });

            expect(missing).toEqual([toolId]);
        });

        it('passes when the tool bumped its version', () => {
            const missing = findMissingBumps(['base64-converter/script.tsx'], 'any-base', {
                workingVersions: { [toolId]: '1.0.1' },
                readVersionAt: readVersionAtMergeBase
            });

            expect(missing).toEqual([]);
        });

        it('flags a tool whose metadata description changed without a bump', () => {
            const missing = findMissingBumps(['base64-converter/tool.meta.json'], 'any-base', {
                workingVersions,
                readVersionAt: readVersionAtMergeBase,
                readFileAt: (revision) => (revision === 'any-base' ? JSON.stringify({ id: 'x', description: 'before' }) : JSON.stringify({ id: 'x', description: 'after' }))
            });

            expect(missing).toEqual([toolId]);
        });

        it('passes when a metadata edit only bumps the version', () => {
            const missing = findMissingBumps(['base64-converter/tool.meta.json'], 'any-base', {
                workingVersions,
                readVersionAt: readVersionAtMergeBase,
                readFileAt: (revision) => (revision === 'any-base' ? JSON.stringify({ id: 'x', version: '1.0.0' }) : JSON.stringify({ id: 'x', version: '1.0.1' }))
            });

            expect(missing).toEqual([]);
        });

        it('ignores doc-only changes within a tool directory', () => {
            const missing = findMissingBumps(['base64-converter/README.md'], 'any-base', {
                workingVersions,
                readVersionAt: readVersionAtMergeBase
            });

            expect(missing).toEqual([]);
        });

        it('flags every affected tool for a shared runtime change', () => {
            const affectedTools = detectAffectedTargets(['common/clipboard.ts']).affectedTools;
            const missing = findMissingBumps(['common/clipboard.ts'], 'any-base', {
                workingVersions: Object.fromEntries(affectedTools.map((id) => [id, '1.0.0'])),
                readVersionAt: readVersionAtMergeBase
            });

            expect(missing.sort()).toEqual([...affectedTools].sort());
        });

        it('passes for shared runtime changes when every affected tool bumped', () => {
            const affectedTools = detectAffectedTargets(['common/clipboard.ts']).affectedTools;
            const missing = findMissingBumps(['common/clipboard.ts'], 'any-base', {
                workingVersions: Object.fromEntries(affectedTools.map((id) => [id, '1.1.0'])),
                readVersionAt: readVersionAtMergeBase
            });

            expect(missing).toEqual([]);
        });

        it('deduplicates candidates from multiple changed files of one tool', () => {
            const missing = findMissingBumps([
                'base64-converter/script.tsx',
                'base64-converter/clipboard.ts'
            ], 'any-base', {
                workingVersions,
                readVersionAt: readVersionAtMergeBase
            });

            expect(missing).toEqual([toolId]);
        });
    });

    describe('SKIP_LABEL', () => {
        it('matches the label literal the CI workflow greps for', () => {
            // Asserts the actual coupling: ci.yml's grep literal must equal the
            // constant the error message tells contributors to add. A rename
            // touching only one side fails here instead of silently breaking
            // the escape hatch on every docs-only PR.
            const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');

            expect(workflow).toContain(`grep -Fxq '${SKIP_LABEL}'`);
        });
    });
});