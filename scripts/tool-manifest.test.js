const path = require('path');
const {
  ROOT_CONFIG_PATH,
  TOOL_METADATA_FILENAME,
  assertValidToolIds,
  dedupeToolIds,
  getRootAssets,
  getRootShellDefinition,
  getToolById,
  getToolDefinitions,
  getToolIds,
  getToolMetadataPath,
  loadManifest,
  loadRootConfig,
  normalizeSelection,
  parseToolSelectionArgs,
  selectTools,
  splitCsv
} = require('./tool-manifest');

describe('tool-manifest', () => {
  it('loads the shared root config', () => {
    expect(ROOT_CONFIG_PATH).toBe(path.resolve(__dirname, '../config/tooling-root.json'));
    expect(loadRootConfig()).toEqual({
      rootShell: {
        id: 'root-shell',
        outputPath: 'build/root-shell'
      },
      rootAssets: ['index.html', 'styles.css', 'robots.txt']
    });
  });

  it('discovers tool definitions from tool-local metadata files', () => {
    const toolDefinitions = getToolDefinitions();

    expect(toolDefinitions).toHaveLength(10);
    expect(toolDefinitions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'jwt-decoder-tool',
        sourceRoot: 'jwt-decoder-tool',
        outputPath: 'build/jwt-decoder-tool',
        version: '1.0.0',
        dependencyScopes: ['build-system', 'shared-ui', 'shared-runtime']
      })
    ]));
  });

  it('builds a normalized manifest view', () => {
    expect(loadManifest()).toEqual({
      tools: expect.arrayContaining([
        expect.objectContaining({ id: 'base64-converter-tool' }),
        expect.objectContaining({ id: 'jwt-decoder-tool' })
      ]),
      rootShell: {
        id: 'root-shell',
        outputPath: 'build/root-shell'
      },
      rootAssets: ['index.html', 'styles.css', 'robots.txt']
    });
  });

  it('returns tool ids, lookups, and metadata paths', () => {
    expect(getToolIds()).toContain('jwt-decoder-tool');
    expect(getToolById('jwt-decoder-tool')).toEqual(expect.objectContaining({
      id: 'jwt-decoder-tool',
      sourceRoot: 'jwt-decoder-tool'
    }));
    expect(getToolMetadataPath('jwt-decoder-tool')).toBe(
      path.resolve(__dirname, '../jwt-decoder-tool', TOOL_METADATA_FILENAME)
    );
    expect(() => getToolMetadataPath('not-a-real-tool')).toThrow('Unknown tool id');
  });

  it('exposes root assets and root shell helpers', () => {
    expect(getRootAssets()).toEqual(['index.html', 'styles.css', 'robots.txt']);
    expect(getRootShellDefinition()).toEqual({
      id: 'root-shell',
      outputPath: 'build/root-shell'
    });
  });

  it('supports CSV splitting, dedupe, and validation helpers', () => {
    expect(splitCsv('jwt-decoder-tool, json-formatter-tool ,')).toEqual([
      'jwt-decoder-tool',
      'json-formatter-tool'
    ]);
    expect(dedupeToolIds(['jwt-decoder-tool', 'jwt-decoder-tool', 'json-formatter-tool'])).toEqual([
      'jwt-decoder-tool',
      'json-formatter-tool'
    ]);
    expect(assertValidToolIds(['jwt-decoder-tool'])).toEqual(['jwt-decoder-tool']);
    expect(() => assertValidToolIds(['not-a-real-tool'])).toThrow('Unknown tool id');
  });

  it('parses and normalizes tool selection arguments', () => {
    expect(parseToolSelectionArgs([
      '--tool', 'jwt-decoder-tool',
      '--tools', 'json-formatter-tool,jwt-decoder-tool',
      '--include-root-shell',
      '--include-root-assets'
    ])).toEqual({
      requestedTools: ['jwt-decoder-tool', 'json-formatter-tool'],
      includeRootShell: true,
      includeRootAssets: true
    });

    expect(normalizeSelection({
      requestedTools: [],
      includeRootShell: false,
      includeRootAssets: false
    })).toEqual({
      requestedTools: getToolIds(),
      includeRootShell: false,
      includeRootAssets: false
    });
  });

  it('selects requested tool definitions', () => {
    expect(selectTools(['jwt-decoder-tool', 'json-formatter-tool'])).toEqual([
      expect.objectContaining({ id: 'json-formatter-tool' }),
      expect.objectContaining({ id: 'jwt-decoder-tool' })
    ]);
  });
});
