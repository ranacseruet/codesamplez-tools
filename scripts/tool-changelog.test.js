// @ts-check

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    VISIBLE_VERSION_COUNT,
    getRecentToolChangelog,
    getToolChangelogFilePath,
    getToolChangelogUrl,
    readToolChangelog,
    renderToolChangelogMarkup
} = require('./tool-changelog');

describe('tool-changelog', () => {
    describe('readToolChangelog', () => {
        /** @type {string} */
        let tempDir;

        beforeEach(() => {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-changelog-test-'));
        });

        afterEach(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        const writeChangelog = (content) => {
            fs.writeFileSync(path.join(tempDir, 'CHANGELOG.md'), content);
        };

        it('returns sections newest-first with version, date, and notes', () => {
            writeChangelog([
                '# Changelog',
                '',
                '## [1.0.2] - 2026-09-21',
                '',
                '### Some Tool',
                '',
                '- Added the changelog section.',
                '- Fixed a bug.',
                '',
                '## [1.0.1] - 2026-09-20',
                '',
                '### Some Tool',
                '',
                '- Shipped the first fix.'
            ].join('\n'));

            // tool id must map to a real tool dir; json-formatter-tool's dir
            // hosts the real metadata, so stub via the file reader instead:
            const sections = parseSections(tempDir);

            expect(sections).toEqual([
                { version: '1.0.2', date: '2026-09-21', notes: ['Added the changelog section.', 'Fixed a bug.'] },
                { version: '1.0.1', date: '2026-09-20', notes: ['Shipped the first fix.'] }
            ]);
        });

        // The module resolves the changelog path from the real tool dir, so
        // the spy maps THAT path to the fixture content instead.
        function parseSections(dir) {
            const realExistsSync = fs.existsSync;
            const realReadFileSync = fs.readFileSync;
            const fixturePath = path.join(dir, 'CHANGELOG.md');
            const toolChangelogPath = getToolChangelogFilePath('json-formatter-tool');

            jest.spyOn(fs, 'existsSync').mockImplementation((target) => (
                String(target) === toolChangelogPath ? realExistsSync(fixturePath) : realExistsSync(target)
            ));
            jest.spyOn(fs, 'readFileSync').mockImplementation(((target, options) => (
                String(target) === toolChangelogPath ? realReadFileSync(fixturePath, options) : realReadFileSync(target, options)
            )));

            try {
                return readToolChangelog('json-formatter-tool');
            } finally {
                fs.existsSync.mockRestore();
                fs.readFileSync.mockRestore();
            }
        }

        it('tolerates sections without a date or notes', () => {
            writeChangelog('# Changelog\n\n## [2.0.0]\n\n## [1.0.0] - 2020-01-01\n');
            const sections = parseSections(tempDir);

            expect(sections).toEqual([
                { version: '2.0.0', date: null, notes: [] },
                { version: '1.0.0', date: '2020-01-01', notes: [] }
            ]);
        });

        it('drops the ### tool-title subheading from notes', () => {
            writeChangelog('# Changelog\n\n## [1.0.0] - 2020-01-01\n\n### Some Tool\n\n- Note one.\n');

            expect(parseSections(tempDir)[0].notes).toEqual(['Note one.']);
        });

        it('returns an empty array when the changelog file is missing', () => {
            const sections = parseSections(path.join(os.tmpdir(), 'tool-changelog-nonexistent-dir'));

            expect(sections).toEqual([]);
        });
    });

    describe('getRecentToolChangelog', () => {
        it('returns at most the visible version count, newest first', () => {
            const tool = require('./tool-manifest').getToolById('json-formatter-tool');
            expect(tool).toBeDefined();

            const recent = getRecentToolChangelog('json-formatter-tool');

            expect(recent.length).toBeLessThanOrEqual(VISIBLE_VERSION_COUNT);
            expect(recent.length).toBeGreaterThan(0);
            // File order is newest first; the first section must be the tool's
            // current version (1.0.2 at this point in the branch).
            expect(recent[0].version).toBe(tool.version);
        });
    });

    describe('getToolChangelogUrl', () => {
        it('deep-links the tool source root on the default branch', () => {
            expect(getToolChangelogUrl('json-formatter-tool')).toBe('https://github.com/ranacseruet/codesamplez-tools/blob/main/json-formatter/CHANGELOG.md');
        });
    });

    describe('renderToolChangelogMarkup', () => {
        it('renders the section with heading, versions, notes, and link', () => {
            const markup = renderToolChangelogMarkup('json-formatter-tool');

            expect(markup).toContain('<section class="c-tool-changelog" aria-labelledby="c-tool-changelog-heading">');
            expect(markup).toContain('<h3 class="c-tool-changelog__heading" id="c-tool-changelog-heading">Changelog</h3>');
            expect(markup).toContain('c-tool-changelog__version-block');
            expect(markup).toContain('<a class="c-tool-changelog__link" href="https://github.com/ranacseruet/codesamplez-tools/blob/main/json-formatter/CHANGELOG.md" rel="noopener">View full changelog on GitHub</a>');
        });

        it('escapes note copy so raw text cannot inject markup', () => {
            const markup = renderToolChangelogMarkup('json-formatter-tool');

            // Real notes contain <meta name="tool-version"> phrasing; it must
            // appear escaped, not as a live tag.
            expect(markup).not.toContain('<meta');
            expect(markup).toContain('&lt;meta name=&quot;tool-version&quot;&gt;');
        });
    });
});