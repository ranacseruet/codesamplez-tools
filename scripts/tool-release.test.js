// @ts-check

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    addChangelogNote,
    bumpVersion,
    changelogHasVersionEntry,
    getToolChangelogPath,
    listToolVersions,
    parseVersion,
    renderChangelogEntry,
    resolveSelectedTools
} = require('./tool-release');

describe('tool-release', () => {
    describe('parseVersion', () => {
        it.each([
            ['0.0.1', [0, 0, 1]],
            ['1.2.3', [1, 2, 3]],
            ['12.34.56', [12, 34, 56]]
        ])('parses %s', (version, expected) => {
            expect(parseVersion(version)).toEqual(expected);
        });

        it.each(['1.2', 'v1.2.3', '1.2.3.4', 'abc', ''])('rejects %s', (version) => {
            expect(() => parseVersion(version)).toThrow(/Unsupported version format/u);
        });
    });

    describe('bumpVersion', () => {
        it.each([
            ['1.2.3', 'patch', '1.2.4'],
            ['1.2.3', 'minor', '1.3.0'],
            ['1.2.3', 'major', '2.0.0'],
            ['0.0.0', 'patch', '0.0.1']
        ])('bumps %s via %s to %s', (current, bumpType, expected) => {
            expect(bumpVersion(current, bumpType)).toBe(expected);
        });
    });

    describe('resolveSelectedTools', () => {
        it('requires at least one tool', () => {
            expect(() => resolveSelectedTools([])).toThrow(/At least one tool/u);
        });

        it('rejects unknown tool ids', () => {
            expect(() => resolveSelectedTools(['not-a-tool'])).toThrow(/Unknown tool id/u);
        });

        it('accepts a known tool id', () => {
            expect(resolveSelectedTools(['json-formatter-tool'])).toEqual(['json-formatter-tool']);
        });
    });

    describe('listToolVersions', () => {
        it('lists every tool version', () => {
            const versions = listToolVersions({ tools: [{ id: 'a', version: '1.0.0' }, { id: 'b', version: '2.0.0' }] }, []);

            expect(versions).toEqual([
                { id: 'a', version: '1.0.0' },
                { id: 'b', version: '2.0.0' }
            ]);
        });

        it('filters to the selected tools', () => {
            const versions = listToolVersions(
                { tools: [{ id: 'a', version: '1.0.0' }, { id: 'b', version: '2.0.0' }] },
                ['b']
            );

            expect(versions).toEqual([{ id: 'b', version: '2.0.0' }]);
        });
    });

    describe('changelog helpers', () => {
        /** @type {string} */
        let tempDir;

        beforeEach(() => {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-release-test-'));
        });

        afterEach(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        describe('renderChangelogEntry', () => {
            it('renders a dated Keep-a-Changelog section for a real tool', () => {
                const entry = renderChangelogEntry('json-formatter-tool', '1.2.3', 'Fixed a bug');

                expect(entry).toContain('## [1.2.3] - ');
                expect(entry).toContain('### JSON Formatter');
                expect(entry).toContain('- Fixed a bug');
            });
        });

        describe('addChangelogNote', () => {
            it('creates a changelog with a header when none exists', () => {
                addChangelogNote('json-formatter-tool', '1.2.3', 'Created the file', false, { directory: tempDir });

                const content = fs.readFileSync(path.join(tempDir, 'CHANGELOG.md'), 'utf8');
                expect(content).toContain('# Changelog');
            });

            it('prepends the newest entry above existing ones', () => {
                const changelogPath = path.join(tempDir, 'CHANGELOG.md');
                fs.writeFileSync(changelogPath, '# Changelog\n\n## [1.0.0] - 2020-01-01\n\n### JSON Formatter\n\n- Initial\n');

                addChangelogNote('json-formatter-tool', '1.1.0', 'Added feature', false, { directory: tempDir });

                const content = fs.readFileSync(changelogPath, 'utf8');
                expect(content.indexOf('## [1.1.0]')).toBeGreaterThan(-1);
                expect(content.indexOf('## [1.1.0]')).toBeLessThan(content.indexOf('## [1.0.0]'));
                expect(content).toContain('# Changelog');
            });

            it('preserves the existing changelog header block when prepending', () => {
                const changelogPath = path.join(tempDir, 'CHANGELOG.md');
                const header = '# Changelog\n\nAll notable changes live here.\n';
                fs.writeFileSync(changelogPath, `${header}\n## [1.0.0] - 2020-01-01\n\n- Initial\n`);

                addChangelogNote('json-formatter-tool', '1.1.0', 'Added feature', false, { directory: tempDir });

                const content = fs.readFileSync(changelogPath, 'utf8');
                expect(content).toContain('All notable changes live here.');
                expect(content.indexOf('All notable changes live here.')).toBeLessThan(content.indexOf('## [1.1.0]'));
            });
        });

        describe('changelogHasVersionEntry', () => {
            it('matches the exact version heading', () => {
                const changelogPath = path.join(tempDir, 'CHANGELOG.md');
                fs.writeFileSync(changelogPath, '# Changelog\n\n## [1.0.1] - 2026-09-20\n\n- Note\n');

                expect(changelogHasVersionEntry('json-formatter-tool', '1.0.1', { directory: tempDir })).toBe(true);
                expect(changelogHasVersionEntry('json-formatter-tool', '1.0.10', { directory: tempDir })).toBe(false);
            });

            it('returns false when the changelog is missing', () => {
                expect(changelogHasVersionEntry('json-formatter-tool', '1.0.0', { directory: tempDir })).toBe(false);
            });
        });
    });
});