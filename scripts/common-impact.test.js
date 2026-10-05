const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    buildReverseImportGraph,
    isResolvableCommonFile,
    resolveToolsReachedByCommonFile
} = require('./common-impact');
const { getToolDefinitions } = require('./tool-manifest');

describe('common-impact', () => {
    let root;

    const write = (relativePath, content = '') => {
        const absolute = path.join(root, relativePath);
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, content);
    };
    const toolIdForPath = (filePath) => {
        const match = /^(tool-[a-z]+)\//u.exec(filePath);
        return match ? match[1] : null;
    };
    const resolve = (filePath) => resolveToolsReachedByCommonFile(filePath, { rootDirectory: root, toolIdForPath });

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'common-impact-'));
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    describe('isResolvableCommonFile', () => {
        it.each([
            ['common/Base64Codec.ts', true],
            ['common/app-shell/AppShell.tsx', true],
            ['common/worker-thresholds.mjs', true],
            ['common/shared-styles.css', false],
            ['common/shims/process-browser.js', false],
            ['common/copy-button/README.md', false],
            ['tool-a/script.ts', false],
            ['scripts/tool-manifest.js', false]
        ])('classifies %s as %s', (filePath, expected) => {
            expect(isResolvableCommonFile(filePath)).toBe(expected);
        });
    });

    describe('resolveToolsReachedByCommonFile', () => {
        it('returns only the tools that import the module directly', () => {
            write('common/codec.ts', 'export const x = 1;');
            write('tool-a/script.ts', "import { x } from '../common/codec';");
            write('tool-b/script.ts', "import { y } from '../common/other';");
            write('common/other.ts', 'export const y = 2;');

            expect(resolve('common/codec.ts')).toEqual(['tool-a']);
        });

        it('follows imports transitively through other common modules', () => {
            write('common/leaf.ts');
            write('common/mid.ts', "export * from './leaf';");
            write('tool-a/script.ts', "import '../common/mid';");
            write('tool-b/script.ts', 'export {};');

            expect(resolve('common/leaf.ts')).toEqual(['tool-a']);
        });

        it('follows a tool importing another tool that uses the module', () => {
            write('common/leaf.ts');
            write('tool-a/core.ts', "import '../common/leaf';");
            write('tool-b/script.ts', "import '../tool-a/core';");

            expect(resolve('common/leaf.ts')).toEqual(['tool-a', 'tool-b']);
        });

        it.each([
            ["import('../common/leaf')", "const load = () => import('../common/leaf');"],
            ["require('../common/leaf')", "const leaf = require('../common/leaf');"],
            ["new URL('../common/leaf.ts', import.meta.url)", "new Worker(new URL('../common/leaf.ts', import.meta.url));"],
            ['bare side-effect import', "import '../common/leaf';"],
            ['.js specifier written for a .ts source', "import '../common/leaf.js';"]
        ])('detects %s', (_label, source) => {
            write('common/leaf.ts');
            write('tool-a/script.ts', source);

            expect(resolve('common/leaf.ts')).toEqual(['tool-a']);
        });

        it('resolves directory index imports', () => {
            write('common/widget/index.ts');
            write('tool-a/script.ts', "import '../common/widget';");

            expect(resolve('common/widget/index.ts')).toEqual(['tool-a']);
        });

        it('ignores test files as importers, so a module only tests use reaches no tool', () => {
            write('common/leaf.ts');
            write('tool-a/script.test.js', "import '../common/leaf';");
            write('common/leaf.test.js', "import './leaf';");

            expect(resolve('common/leaf.ts')).toEqual([]);
        });

        it('treats a deleted or renamed test file as reaching no tool, without the missing-file fallback', () => {
            write('common/leaf.ts');
            write('tool-a/script.ts', "import '../common/leaf';");

            expect(resolve('common/removed-helper.test.ts')).toEqual([]);
            expect(resolve('common/nested/old-name.test.js')).toEqual([]);
        });

        it('still falls back to every tool for a deleted non-test module', () => {
            write('common/leaf.ts');

            expect(resolve('common/removed-helper.ts')).toBeNull();
        });

        it('treats a test file itself as reaching no tool', () => {
            write('common/leaf.ts');
            write('common/leaf.test.js', "import './leaf';");
            write('tool-a/script.ts', "import '../common/leaf';");

            expect(resolve('common/leaf.test.js')).toEqual([]);
        });

        it('does not fan out to every tool through the prerender script that loads a tool entry', () => {
            write('common/leaf.ts');
            write('tool-a/script.ts', "import '../common/leaf';");
            write('tool-b/script.ts', 'export {};');
            write('scripts/prerender.js', "const entry = require('../tool-a/script');");

            expect(resolve('common/leaf.ts')).toEqual(['tool-a']);
        });

        it('falls back to every tool when scripts import the module directly', () => {
            write('common/leaf.ts');
            write('tool-a/script.ts', "import '../common/leaf';");
            write('scripts/build.js', "const leaf = require('../common/leaf');");

            expect(resolve('common/leaf.ts')).toBeNull();
        });

        it('falls back to every tool when build config at the repo root imports the module', () => {
            write('common/leaf.ts');
            write('webpack.config.js', "require('./common/leaf');");

            expect(resolve('common/leaf.ts')).toBeNull();
        });

        it('falls back for a module that only a script reaches through another common module', () => {
            write('common/leaf.ts');
            write('common/mid.ts', "import './leaf';");
            write('scripts/build.js', "require('../common/mid');");

            expect(resolve('common/leaf.ts')).toBeNull();
        });

        it.each([
            ['CSS', 'common/shared-styles.css'],
            ['shims', 'common/shims/process.js'],
            ['a file that no longer exists', 'common/deleted.ts'],
            ['a file outside common/', 'tool-a/script.ts']
        ])('falls back to every tool for %s', (_label, filePath) => {
            write('common/shared-styles.css');
            write('common/shims/process.js');
            write('tool-a/script.ts');

            expect(resolve(filePath)).toBeNull();
        });

        it('skips node_modules and build output when reading imports', () => {
            write('common/leaf.ts');
            write('node_modules/pkg/index.js', "require('../../common/leaf');");
            write('build/tool-a/bundle.js', "require('../../common/leaf');");

            expect(resolve('common/leaf.ts')).toEqual([]);
        });
    });

    describe('buildReverseImportGraph', () => {
        it('records importers by resolved repo-relative target and ignores unresolved specifiers', () => {
            write('common/leaf.ts');
            write('tool-a/script.ts', "import '../common/leaf'; import './missing'; import 'react';");

            const graph = buildReverseImportGraph(root);

            expect(Array.from(graph.get('common/leaf.ts'))).toEqual(['tool-a/script.ts']);
            expect(graph.size).toBe(1);
        });
    });

    describe('against the real repository', () => {
        it('attributes Base64Codec to the tools that import it and not to every tool', () => {
            const reached = resolveToolsReachedByCommonFile('common/Base64Codec.ts');

            expect(reached).toEqual(['base64-converter-tool', 'jwt-builder-tool', 'jwt-decoder-tool']);
            expect(reached.length).toBeLessThan(getToolDefinitions().length);
        });

        it('keeps the app shell, which every tool mounts, as an every-tool change', () => {
            expect(resolveToolsReachedByCommonFile('common/app-shell/AppShell.tsx')).toBeNull();
        });
    });
});
