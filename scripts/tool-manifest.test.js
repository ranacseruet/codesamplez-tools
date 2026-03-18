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
  getToolByOutputDir,
  getToolDefinitions,
  getToolIds,
  getToolMetadataPath,
  getOutputDirFromPublicPath,
  loadManifest,
  loadRootConfig,
  normalizeSelection,
  normalizePublicPath,
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
        sourceRoot: 'jwt-decoder',
        outputDir: 'jwt-decoder',
        outputPath: 'build/jwt-decoder',
        version: '1.0.0',
        title: 'JWT Decoder & Validator',
        description: 'Decode and validate JWT tokens locally in your browser.',
        appRootId: 'jwt-decoder-app',
        publicPath: '/jwt-decoder/',
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
      sourceRoot: 'jwt-decoder',
      outputDir: 'jwt-decoder',
      publicPath: '/jwt-decoder/'
    }));
    expect(getToolMetadataPath('jwt-decoder-tool')).toBe(
      path.resolve(__dirname, '../jwt-decoder', TOOL_METADATA_FILENAME)
    );
    expect(getToolById('data-format-converter')).toEqual(expect.objectContaining({
      id: 'data-format-converter',
      sourceRoot: 'data-format-converter',
      outputDir: 'data-format-converter',
      publicPath: '/data-format-converter/'
    }));
    expect(getToolById('qr-code-generator')).toEqual(expect.objectContaining({
      id: 'qr-code-generator',
      sourceRoot: 'qr-code-generator',
      outputDir: 'qr-code-generator',
      publicPath: '/qr-code-generator/'
    }));
    expect(getToolMetadataPath('data-format-converter')).toBe(
      path.resolve(__dirname, '../data-format-converter', TOOL_METADATA_FILENAME)
    );
    expect(getToolMetadataPath('qr-code-generator')).toBe(
      path.resolve(__dirname, '../qr-code-generator', TOOL_METADATA_FILENAME)
    );
    expect(() => getToolMetadataPath('not-a-real-tool')).toThrow('Unknown tool id');
  });

  it('normalizes public paths and output-dir lookups', () => {
    expect(normalizePublicPath(' jwt-decoder ')).toBe('/jwt-decoder/');
    expect(getOutputDirFromPublicPath('/jwt-decoder/')).toBe('jwt-decoder');
    expect(getToolByOutputDir('jwt-decoder')).toEqual(expect.objectContaining({
      id: 'jwt-decoder-tool',
      publicPath: '/jwt-decoder/'
    }));
    expect(getToolByOutputDir('not-a-real-output-dir')).toBeUndefined();
    expect(() => normalizePublicPath(42)).toThrow('Tool publicPath must be a string');
    expect(() => normalizePublicPath(' / ')).toThrow('Tool publicPath must contain a non-root path segment');
  });

  it('resolves related tool definitions for document rendering', () => {
    expect(getRelatedTools('jwt-decoder-tool')).toEqual([
      expect.objectContaining({ id: 'jwt-builder-tool', publicPath: '/jwt-builder/' }),
      expect.objectContaining({ id: 'base64-converter-tool', publicPath: '/base64-converter/' }),
      expect.objectContaining({ id: 'json-formatter-tool', publicPath: '/json-formatter/' })
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
      sourceRoot: 'jwt-decoder',
      outputDir: 'jwt-decoder',
      outputPath: 'build/jwt-decoder',
      version: '1.0.0',
      title: 'JWT Decoder & Validator',
      description: 'Decode and validate JWT tokens locally in your browser.',
      appRootId: 'jwt-decoder-app',
      publicPath: '/jwt-decoder/',
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
        sourceRoot: 'jwt-builder',
        outputDir: 'jwt-builder',
        outputPath: 'build/jwt-builder',
        appRootId: 'jwt-builder-app',
        publicPath: '/jwt-builder/',
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
        sourceRoot: 'jwt-builder',
        outputDir: 'jwt-builder',
        outputPath: 'build/jwt-builder',
        appRootId: 'jwt-builder-app',
        publicPath: '/jwt-builder/',
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
        sourceRoot: 'jwt-builder',
        outputDir: 'jwt-builder',
        outputPath: 'build/jwt-builder',
        appRootId: 'jwt-builder-app',
        publicPath: '/jwt-builder/',
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
        sourceRoot: 'jwt-builder',
        outputDir: 'jwt-builder',
        outputPath: 'build/jwt-builder',
        appRootId: 'jwt-builder-app',
        publicPath: '/jwt-builder/',
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
        sourceRoot: 'jwt-builder',
        outputDir: 'jwt-builder',
        outputPath: 'build/jwt-builder',
        appRootId: 'jwt-builder-app',
        publicPath: '/jwt-builder/',
        title: 'JWT Builder',
        description: 'Create and sign JWT tokens locally with standard and custom claims.',
        relatedToolIds: ['jwt-decoder-tool']
      }
    ])).toThrow('unknown related tool id');
  });

  it('rejects duplicate public paths and output dirs', () => {
    const decoderTool = {
      siteBaseUrl: 'https://tools.codesamplez.com',
      id: 'jwt-decoder-tool',
      sourceRoot: 'jwt-decoder',
      outputDir: 'jwt-decoder',
      outputPath: 'build/jwt-decoder',
      version: '1.0.0',
      title: 'JWT Decoder & Validator',
      description: 'Decode and validate JWT tokens locally in your browser.',
      appRootId: 'jwt-decoder-app',
      publicPath: '/jwt-decoder/',
      scriptType: 'module',
      featuredImagePath: DEFAULT_FEATURED_IMAGE_PATH,
      dependencyScopes: ['build-system', 'shared-ui', 'shared-runtime'],
      relatedToolIds: ['jwt-builder-tool']
    };
    const builderTool = {
      ...decoderTool,
      id: 'jwt-builder-tool',
      sourceRoot: 'jwt-builder',
      outputDir: 'jwt-builder',
      outputPath: 'build/jwt-builder',
      title: 'JWT Builder',
      description: 'Create and sign JWT tokens locally with standard and custom claims.',
      appRootId: 'jwt-builder-app',
      publicPath: '/jwt-builder/',
      relatedToolIds: ['jwt-decoder-tool']
    };

    expect(() => validateToolDefinitions([
      decoderTool,
      {
        ...builderTool,
        publicPath: '/jwt-decoder/'
      }
    ])).toThrow('Duplicate tool publicPath detected for jwt-builder-tool: /jwt-decoder/');

    expect(() => validateToolDefinitions([
      decoderTool,
      {
        ...builderTool,
        outputDir: 'jwt-decoder',
        outputPath: 'build/jwt-decoder'
      }
    ])).toThrow('Duplicate tool outputDir detected for jwt-builder-tool: jwt-decoder');
  });
});
