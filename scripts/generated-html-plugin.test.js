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
});
