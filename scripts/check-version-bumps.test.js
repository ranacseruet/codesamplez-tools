// @ts-check

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
    DEPENDABOT_LOGIN,
    SKIP_LABEL,
    compareVersions,
    demandsVersionBump,
    findMissingBumps,
    isDependabotManifestOnlyChange,
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

        describe('common/ modules resolved through the import graph', () => {
            const allToolIds = detectAffectedTargets(['common/clipboard.ts']).affectedTools;
            const versionsWith = (bumped) => Object.fromEntries(
                allToolIds.map((id) => [id, bumped.includes(id) ? '1.0.1' : '1.0.0'])
            );

            it('demands a bump only from the tools that import the changed module', () => {
                const importers = ['base64-converter-tool', 'jwt-builder-tool'];
                const missing = findMissingBumps(['common/Base64Codec.ts'], 'any-base', {
                    workingVersions: versionsWith([]),
                    readVersionAt: readVersionAtMergeBase,
                    resolveCommonImpact: () => importers
                });

                expect(missing).toEqual(importers);
            });

            it('passes when the importing tools bumped and unrelated tools did not', () => {
                const importers = ['base64-converter-tool', 'jwt-builder-tool'];
                const missing = findMissingBumps(['common/Base64Codec.ts'], 'any-base', {
                    workingVersions: versionsWith(importers),
                    readVersionAt: readVersionAtMergeBase,
                    resolveCommonImpact: () => importers
                });

                expect(missing).toEqual([]);
            });

            it('demands nothing for a common/ module that no tool imports', () => {
                const missing = findMissingBumps(['common/drop-zone-test-utils.ts'], 'any-base', {
                    workingVersions: versionsWith([]),
                    readVersionAt: readVersionAtMergeBase,
                    resolveCommonImpact: () => []
                });

                expect(missing).toEqual([]);
            });

            it('falls back to every tool when the impact cannot be resolved', () => {
                const missing = findMissingBumps(['common/shared-styles.css'], 'any-base', {
                    workingVersions: versionsWith([]),
                    readVersionAt: readVersionAtMergeBase,
                    resolveCommonImpact: () => null
                });

                expect(missing).toEqual([...allToolIds].sort());
            });

            it('never narrows non-common shared triggers such as build config', () => {
                const missing = findMissingBumps(['webpack.config.js'], 'any-base', {
                    workingVersions: versionsWith([]),
                    readVersionAt: readVersionAtMergeBase,
                    resolveCommonImpact: () => ['base64-converter-tool']
                });

                expect(missing).toEqual([...allToolIds].sort());
            });

            it('unions importers across several changed common/ modules and a tool file', () => {
                const missing = findMissingBumps(['common/a.ts', 'common/b.ts', 'diff-checker/diff.ts'], 'any-base', {
                    workingVersions: versionsWith([]),
                    readVersionAt: readVersionAtMergeBase,
                    resolveCommonImpact: (filePath) => (filePath === 'common/a.ts' ? ['jwt-builder-tool'] : ['jwt-decoder-tool'])
                });

                expect(missing).toEqual(['diff-checker-tool', 'jwt-builder-tool', 'jwt-decoder-tool']);
            });

            it('demands nothing when a common/ test file is deleted or renamed', () => {
                const missing = findMissingBumps(['common/removed-helper.test.ts'], 'any-base', {
                    workingVersions: versionsWith([]),
                    readVersionAt: readVersionAtMergeBase
                });

                expect(missing).toEqual([]);
            });

            it('resolves the real Base64Codec change to exactly its three importers', () => {
                const missing = findMissingBumps(['common/Base64Codec.ts', 'common/Base64Codec.test.js'], 'any-base', {
                    workingVersions: versionsWith([]),
                    readVersionAt: readVersionAtMergeBase
                });

                expect(missing).toEqual(['base64-converter-tool', 'jwt-builder-tool', 'jwt-decoder-tool']);
            });
        });

        describe('Dependabot dependency manifests', () => {
            const allToolIds = detectAffectedTargets(['package.json']).affectedTools;
            const unbumped = Object.fromEntries(allToolIds.map((id) => [id, '1.0.0']));

            it.each([
                [DEPENDABOT_LOGIN, ['package.json'], true],
                [DEPENDABOT_LOGIN, ['package-lock.json'], true],
                [DEPENDABOT_LOGIN, ['package.json', 'package-lock.json'], true],
                [DEPENDABOT_LOGIN, ['package.json', 'package.json'], true],
                [DEPENDABOT_LOGIN, ['package.json', 'base64-converter/script.tsx'], false],
                [DEPENDABOT_LOGIN, [], false],
                ['ranacseruet', ['package.json', 'package-lock.json'], false],
                ['', ['package.json'], false]
            ])('classifies author %s and %j as manifest-only %s', (author, files, expected) => {
                expect(isDependabotManifestOnlyChange(files, author)).toBe(expected);
            });

            it('passes a Dependabot change that only edits the dependency manifests', () => {
                const missing = findMissingBumps(['package.json', 'package-lock.json'], 'any-base', {
                    pullRequestAuthor: DEPENDABOT_LOGIN,
                    readVersionAt: () => {
                        throw new Error('manifest-only Dependabot diffs must not read tool versions');
                    }
                });

                expect(missing).toEqual([]);
            });

            it('flags every tool when a non-Dependabot change edits package.json', () => {
                const missing = findMissingBumps(['package.json', 'package-lock.json'], 'any-base', {
                    workingVersions: unbumped,
                    readVersionAt: readVersionAtMergeBase,
                    pullRequestAuthor: 'ranacseruet'
                });

                expect(missing.sort()).toEqual([...allToolIds].sort());
            });

            it('flags every tool for a manifest edit when no author is supplied', () => {
                const missing = findMissingBumps(['package.json'], 'any-base', {
                    workingVersions: unbumped,
                    readVersionAt: readVersionAtMergeBase
                });

                expect(missing.sort()).toEqual([...allToolIds].sort());
            });

            it('still flags a tool runtime edit from Dependabot', () => {
                const missing = findMissingBumps(['base64-converter/script.tsx'], 'any-base', {
                    workingVersions,
                    readVersionAt: readVersionAtMergeBase,
                    pullRequestAuthor: DEPENDABOT_LOGIN
                });

                expect(missing).toEqual([toolId]);
            });

            it('still flags every tool when a Dependabot PR also changes a runtime file', () => {
                const changed = ['package.json', 'base64-converter/script.tsx'];
                const affectedTools = detectAffectedTargets(changed).affectedTools;
                const missing = findMissingBumps(changed, 'any-base', {
                    workingVersions: Object.fromEntries(affectedTools.map((id) => [id, '1.0.0'])),
                    readVersionAt: readVersionAtMergeBase,
                    pullRequestAuthor: DEPENDABOT_LOGIN
                });

                expect(missing.sort()).toEqual([...affectedTools].sort());
            });

            it('skips enforcement for a Dependabot manifest-only CLI invocation', () => {
                const result = spawnSync(process.execPath, [
                    path.join(__dirname, 'run-version-bump-check.js'),
                    'deadbeef',
                    'package.json',
                    'package-lock.json'
                ], {
                    cwd: path.join(__dirname, '..'),
                    env: { ...process.env, PR_AUTHOR: DEPENDABOT_LOGIN },
                    encoding: 'utf8'
                });

                expect(result.status).toBe(0);
                expect(result.stdout).toMatch(/Dependabot manifest-only change \(package\.json \/ package-lock\.json\)/u);
            });
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

        it('passes the pull request author through to the Dependabot manifest skip', () => {
            const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');
            const runner = fs.readFileSync(path.join(__dirname, 'run-version-bump-check.js'), 'utf8');

            expect(workflow).toContain('PR_AUTHOR: ${{ github.event.pull_request.user.login }}');
            expect(runner).toContain('process.env.PR_AUTHOR');
            expect(runner).toContain('isDependabotManifestOnlyChange');
        });

        it('points Dependabot only at labels that exist, including the skip label', () => {
            // `dependencies` and `security` are not labels on this repo.
            // Dependabot drops unknown names, so a config that lists them
            // opens unlabeled PRs and the version-bump gate stays red.
            const dependabot = fs.readFileSync(path.join(__dirname, '..', '.github', 'dependabot.yml'), 'utf8');
            const labelsBlock = dependabot.match(/labels:\n((?:[ \t]*-[ \t]*\S+\n)+)/u);

            expect(labelsBlock).not.toBeNull();

            const labels = [...labelsBlock[1].matchAll(/-\s*(\S+)/gu)].map((match) => match[1]);
            const allowed = new Set([SKIP_LABEL]);

            expect(labels).toEqual([SKIP_LABEL]);
            expect(labels.every((label) => allowed.has(label))).toBe(true);
        });
    });
});