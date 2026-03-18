const path = require('path');
const {
  DEFAULT_FEATURED_IMAGE_PATH,
  ROOT_CONFIG_PATH,
  TOOL_METADATA_FILENAME,
  assertValidToolIds,
  dedupeToolIds,
  getRootAssets,
  getRelatedTools,
  getRootShellDefinition,
  getSiteBaseUrl,
  getToolById,
  getToolDefinitions,
  getToolIds,
  getToolMetadataPath,
  loadManifest,
  loadRootConfig,
  normalizeSelection,
  parseToolSelectionArgs,
  selectTools,
  splitCsv,
  validateToolDefinitions
} = require('./tool-manifest');

describe('tool-manifest', () => {
  it('loads the shared root config', () => {
    expect(ROOT_CONFIG_PATH).toBe(path.resolve(__dirname, '../config/tooling-root.json'));
    expect(loadRootConfig()).toEqual({
      siteBaseUrl: 'https://tools.codesamplez.com',
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
        title: 'JWT Decoder & Validator',
        description: 'Decode and validate JWT tokens locally in your browser.',
        appRootId: 'jwt-decoder-app',
        publicPath: '/jwt-decoder-tool/',
        scriptType: 'module',
        featuredImagePath: DEFAULT_FEATURED_IMAGE_PATH,
        siteBaseUrl: 'https://tools.codesamplez.com',
        dependencyScopes: ['build-system', 'shared-ui', 'shared-runtime'],
        relatedToolIds: ['jwt-builder-tool', 'base64-converter-tool', 'json-formatter-tool']
      })
    ]));
  });

  it('builds a normalized manifest view', () => {
    expect(loadManifest()).toEqual({
      siteBaseUrl: 'https://tools.codesamplez.com',
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
      sourceRoot: 'jwt-decoder-tool',
      publicPath: '/jwt-decoder-tool/'
    }));
    expect(getToolMetadataPath('jwt-decoder-tool')).toBe(
      path.resolve(__dirname, '../jwt-decoder-tool', TOOL_METADATA_FILENAME)
    );
    expect(() => getToolMetadataPath('not-a-real-tool')).toThrow('Unknown tool id');
  });

  it('resolves related tool definitions for document rendering', () => {
    expect(getRelatedTools('jwt-decoder-tool')).toEqual([
      expect.objectContaining({ id: 'jwt-builder-tool', publicPath: '/jwt-builder-tool/' }),
      expect.objectContaining({ id: 'base64-converter-tool', publicPath: '/base64-converter-tool/' }),
      expect.objectContaining({ id: 'json-formatter-tool', publicPath: '/json-formatter-tool/' })
    ]);
  });

  it('rejects related-tool lookups for unknown tool ids', () => {
    expect(() => getRelatedTools('not-a-real-tool')).toThrow('Unknown tool id: not-a-real-tool');
  });

  it('surfaces the defensive missing-related-tool guard when map lookup fails', () => {
    const originalGet = Map.prototype.get;
    const getSpy = jest.spyOn(Map.prototype, 'get').mockImplementation(function (key) {
      if (key === 'jwt-builder-tool') {
        return undefined;
      }

      return originalGet.call(this, key);
    });

    try {
      expect(() => getRelatedTools('jwt-decoder-tool'))
        .toThrow('Tool jwt-decoder-tool references an unknown related tool id: jwt-builder-tool');
    } finally {
      getSpy.mockRestore();
    }
  });

  it('exposes root assets and root shell helpers', () => {
    expect(getRootAssets()).toEqual(['index.html', 'styles.css', 'robots.txt']);
    expect(getSiteBaseUrl()).toBe('https://tools.codesamplez.com');
    expect(getRootShellDefinition()).toEqual({
      id: 'root-shell',
      outputPath: 'build/root-shell'
    });
  });

  it('supports CSV splitting, dedupe, and validation helpers', () => {
    expect(splitCsv(undefined)).toEqual([]);
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

    expect(normalizeSelection({
      requestedTools: ['jwt-decoder-tool'],
      includeRootShell: true,
      includeRootAssets: true
    })).toEqual({
      requestedTools: ['jwt-decoder-tool'],
      includeRootShell: true,
      includeRootAssets: true
    });
  });

  it('rejects missing --tool values during selection parsing', () => {
    expect(() => parseToolSelectionArgs(['--tool'])).toThrow('Unknown tool id(s): ');
  });

  it('parses the root-assets flag without requiring a tool selection', () => {
    expect(parseToolSelectionArgs(['--include-root-assets'])).toEqual({
      requestedTools: [],
      includeRootShell: false,
      includeRootAssets: true
    });
  });

  it('ignores unrelated arguments during selection parsing', () => {
    expect(parseToolSelectionArgs(['--not-a-real-flag'])).toEqual({
      requestedTools: [],
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

  it('rejects invalid related tool references', () => {
    const baseTool = {
      siteBaseUrl: 'https://tools.codesamplez.com',
      sourceRoot: 'jwt-decoder-tool',
      outputPath: 'build/jwt-decoder-tool',
      version: '1.0.0',
      title: 'JWT Decoder & Validator',
      description: 'Decode and validate JWT tokens locally in your browser.',
      appRootId: 'jwt-decoder-app',
      publicPath: '/jwt-decoder-tool/',
      scriptType: 'module',
      featuredImagePath: DEFAULT_FEATURED_IMAGE_PATH,
      dependencyScopes: ['build-system', 'shared-ui', 'shared-runtime']
    };

    expect(() => validateToolDefinitions([
      {
        ...baseTool,
        id: 'jwt-decoder-tool'
      },
      {
        ...baseTool,
        id: 'jwt-builder-tool',
        sourceRoot: 'jwt-builder-tool',
        outputPath: 'build/jwt-builder-tool',
        appRootId: 'jwt-builder-app',
        publicPath: '/jwt-builder-tool/',
        title: 'JWT Builder',
        description: 'Create and sign JWT tokens locally with standard and custom claims.',
        relatedToolIds: ['jwt-decoder-tool']
      }
    ])).toThrow('must define relatedToolIds as an array');

    expect(() => validateToolDefinitions([
      {
        ...baseTool,
        id: 'jwt-decoder-tool',
        relatedToolIds: ['']
      },
      {
        ...baseTool,
        id: 'jwt-builder-tool',
        sourceRoot: 'jwt-builder-tool',
        outputPath: 'build/jwt-builder-tool',
        appRootId: 'jwt-builder-app',
        publicPath: '/jwt-builder-tool/',
        title: 'JWT Builder',
        description: 'Create and sign JWT tokens locally with standard and custom claims.',
        relatedToolIds: ['jwt-decoder-tool']
      }
    ])).toThrow('contains an invalid related tool id');

    expect(() => validateToolDefinitions([
      {
        ...baseTool,
        id: 'jwt-decoder-tool',
        relatedToolIds: ['jwt-decoder-tool']
      },
      {
        ...baseTool,
        id: 'jwt-builder-tool',
        sourceRoot: 'jwt-builder-tool',
        outputPath: 'build/jwt-builder-tool',
        appRootId: 'jwt-builder-app',
        publicPath: '/jwt-builder-tool/',
        title: 'JWT Builder',
        description: 'Create and sign JWT tokens locally with standard and custom claims.',
        relatedToolIds: ['jwt-decoder-tool']
      }
    ])).toThrow('cannot reference itself');

    expect(() => validateToolDefinitions([
      {
        ...baseTool,
        id: 'jwt-decoder-tool',
        relatedToolIds: ['jwt-builder-tool', 'jwt-builder-tool']
      },
      {
        ...baseTool,
        id: 'jwt-builder-tool',
        sourceRoot: 'jwt-builder-tool',
        outputPath: 'build/jwt-builder-tool',
        appRootId: 'jwt-builder-app',
        publicPath: '/jwt-builder-tool/',
        title: 'JWT Builder',
        description: 'Create and sign JWT tokens locally with standard and custom claims.',
        relatedToolIds: ['jwt-decoder-tool']
      }
    ])).toThrow('duplicate related tool id');

    expect(() => validateToolDefinitions([
      {
        ...baseTool,
        id: 'jwt-decoder-tool',
        relatedToolIds: ['not-a-real-tool']
      },
      {
        ...baseTool,
        id: 'jwt-builder-tool',
        sourceRoot: 'jwt-builder-tool',
        outputPath: 'build/jwt-builder-tool',
        appRootId: 'jwt-builder-app',
        publicPath: '/jwt-builder-tool/',
        title: 'JWT Builder',
        description: 'Create and sign JWT tokens locally with standard and custom claims.',
        relatedToolIds: ['jwt-decoder-tool']
      }
    ])).toThrow('unknown related tool id');
  });
});
