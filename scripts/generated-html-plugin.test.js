/** @jest-environment node */

const { REPO_ROOT, ROOT_CONFIG_PATH, getToolMetadataPath } = require('./tool-manifest');
const {
  GeneratedHtmlPlugin,
  buildGeneratedHtmlAssets,
  getGeneratedHtmlDependencies,
  registerGeneratedHtmlDependencies
} = require('./generated-html-plugin');

describe('generated html plugin', () => {
  it('builds generated root and selected tool html assets without copy-plugin transforms', () => {
    expect(buildGeneratedHtmlAssets({
      includeRootAssets: true,
      rootHtmlAsset: '../index.html',
      toolHtmlAssets: {
        'jwt-decoder-tool': 'index.html',
        'json-formatter-tool': 'json-formatter/index.html'
      }
    })).toEqual([
      expect.objectContaining({
        filename: '../index.html',
        source: expect.stringContaining('<title>Online Developer Tools | CodeSamplez</title>')
      }),
      expect.objectContaining({
        filename: '../404.html',
        source: expect.stringContaining('<title>Page Not Found | CodeSamplez</title>')
      }),
      expect.objectContaining({
        filename: 'index.html',
        source: expect.stringContaining('JWT Decoder &amp; Validator')
      }),
      expect.objectContaining({
        filename: 'json-formatter/index.html',
        source: expect.stringContaining('JSON Formatter')
      })
    ]);
  });

  it('registers manifest files and repo context as compilation dependencies', () => {
    const compilation = {
      fileDependencies: new Set(),
      contextDependencies: new Set()
    };

    registerGeneratedHtmlDependencies(compilation);

    expect(compilation.fileDependencies.has(ROOT_CONFIG_PATH)).toBe(true);
    expect(compilation.fileDependencies.has(getToolMetadataPath('jwt-decoder-tool'))).toBe(true);
    expect(compilation.contextDependencies.has(REPO_ROOT)).toBe(true);
    expect(getGeneratedHtmlDependencies().fileDependencies).toEqual(
      expect.arrayContaining([ROOT_CONFIG_PATH, getToolMetadataPath('json-formatter-tool')])
    );
  });

  it('injects the app-shell catalog in node when the global is missing', () => {
    const previousCatalog = global.__CST_APP_SHELL_CATALOG__;

    delete global.__CST_APP_SHELL_CATALOG__;

    expect(buildGeneratedHtmlAssets()).toEqual([]);
    expect(global.__CST_APP_SHELL_CATALOG__).toEqual(expect.objectContaining({
      rootPage: expect.objectContaining({
        title: 'Online Developer Tools'
      })
    }));

    global.__CST_APP_SHELL_CATALOG__ = previousCatalog;
  });

  it('throws for unknown tool ids in requested html assets', () => {
    expect(() => buildGeneratedHtmlAssets({
      toolHtmlAssets: {
        'not-a-real-tool': 'index.html'
      }
    })).toThrow('Unknown tool id: not-a-real-tool');
  });

  it('generates tracker-free html for non-production builds', () => {
    // Jest runs with NODE_ENV=test, so this exercises the fail-closed guard:
    // the builder itself throws on tracker leakage outside production. Assert
    // the absence explicitly as well so the failure names the regression.
    const assets = buildGeneratedHtmlAssets({ includeRootAssets: true, rootHtmlAsset: 'index.html' });

    expect(assets.map(({ filename }) => filename)).toEqual(['index.html', '404.html']);
    assets.forEach(({ source }) => {
      expect(source).not.toContain('googletagmanager.com');
      expect(source).not.toContain('googlesyndication.com');
    });
  });

  it('emits generated html assets through the compilation hooks', () => {
    const processAssetsTaps = [];
    const compilation = {
      fileDependencies: new Set(),
      contextDependencies: new Set(),
      emitAsset: jest.fn(),
      hooks: {
        processAssets: {
          tap: jest.fn((options, handler) => {
            processAssetsTaps.push({ options, handler });
          })
        }
      }
    };
    const compiler = {
      hooks: {
        watchRun: { tap: jest.fn() },
        thisCompilation: {
          tap: jest.fn((name, handler) => {
            handler(compilation);
          })
        }
      }
    };

    new GeneratedHtmlPlugin({
      includeRootAssets: true,
      rootHtmlAsset: '../index.html',
      toolHtmlAssets: {
        'jwt-decoder-tool': 'index.html'
      }
    }).apply(compiler);

    expect(processAssetsTaps).toHaveLength(1);
    processAssetsTaps[0].handler();

    expect(compilation.emitAsset).toHaveBeenCalledTimes(3);
    expect(compilation.emitAsset.mock.calls[0][0]).toBe('../index.html');
    expect(String(compilation.emitAsset.mock.calls[0][1].source())).toContain('<title>Online Developer Tools | CodeSamplez</title>');
    expect(compilation.emitAsset.mock.calls[1][0]).toBe('../404.html');
    expect(String(compilation.emitAsset.mock.calls[1][1].source())).toContain('404 — Page Not Found');
    expect(compilation.emitAsset.mock.calls[2][0]).toBe('index.html');
    expect(String(compilation.emitAsset.mock.calls[2][1].source())).toContain('JWT Decoder &amp; Validator');
    expect(compilation.fileDependencies.has(ROOT_CONFIG_PATH)).toBe(true);
    expect(compilation.contextDependencies.has(REPO_ROOT)).toBe(true);
  });

  it('re-resolves the build commit on each watch-mode recompile', () => {
    jest.isolateModules(() => {
      const shas = ['a'.repeat(40), 'b'.repeat(40)];
      const execFileSync = jest.fn(() => `${shas.shift()}\n`);
      jest.doMock('child_process', () => ({ ...jest.requireActual('child_process'), execFileSync }));
      const { resolveBuildCommit } = require('./provenance-manifest');
      const { GeneratedHtmlPlugin: IsolatedPlugin } = require('./generated-html-plugin');
      let watchRunHandler = () => {};
      new IsolatedPlugin().apply({
        hooks: {
          watchRun: { tap: jest.fn((name, handler) => { watchRunHandler = handler; }) },
          thisCompilation: { tap: jest.fn() }
        }
      });

      // One build stamps one commit, however many documents ask for it.
      expect(resolveBuildCommit()).toBe('a'.repeat(40));
      expect(resolveBuildCommit()).toBe('a'.repeat(40));
      expect(execFileSync).toHaveBeenCalledTimes(1);

      // A commit landed while the watcher was running; the next rebuild sees it.
      watchRunHandler();
      expect(resolveBuildCommit()).toBe('b'.repeat(40));
    });
    jest.dontMock('child_process');
  });

  it('reads the root config once per generated-html pass, not once per getter', () => {
    const fs = require('fs');
    const actualReadFileSync = fs.readFileSync;
    const readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((...args) => actualReadFileSync(...args));
    const rootConfigReads = () => readFileSyncSpy.mock.calls.filter(([targetPath]) => targetPath === ROOT_CONFIG_PATH).length;

    try {
      buildGeneratedHtmlAssets({
        includeRootAssets: true,
        rootHtmlAsset: 'index.html',
        toolHtmlAssets: { 'jwt-decoder-tool': 'jwt-decoder/index.html' }
      });
      expect(rootConfigReads()).toBe(1);

      // The cache is scoped to the pass, so a later pass sees config edits.
      buildGeneratedHtmlAssets({ includeRootAssets: true, rootHtmlAsset: 'index.html' });
      expect(rootConfigReads()).toBe(2);
    } finally {
      readFileSyncSpy.mockRestore();
    }
  });
});
