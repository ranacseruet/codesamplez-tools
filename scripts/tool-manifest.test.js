const fs = require('fs');
const path = require('path');
const {
  DEFAULT_FEATURED_IMAGE_PATH,
  REPO_ROOT,
  ROOT_CONFIG_PATH,
  TOOL_METADATA_FILENAME,
  assertValidToolIds,
  dedupeToolIds,
  getCatalogGroups,
  getGroupedToolDefinitions,
  getRootAssets,
  getRelatedTools,
  getRootPageDefinition,
  getRootShellDefinition,
  getSiteBaseUrl,
  getSiteDescription,
  getSiteName,
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

const CATALOG_GROUPS = loadRootConfig().catalogGroups;
const SITE_DESCRIPTION = 'Client-side formatters, converters, token tools, and text utilities with a consistent privacy-preserving workflow.';

function createBaseTool(overrides = {}) {
  return {
    siteBaseUrl: 'https://codesamplez.com/tools',
    siteName: 'CodeSamplez Tools',
    siteDescription: SITE_DESCRIPTION,
    sourceRoot: 'jwt-decoder',
    outputDir: 'jwt-decoder',
    outputPath: 'build/jwt-decoder',
    version: '1.0.0',
    title: 'JWT Decoder & Validator',
    description: 'Decode and validate JWT tokens locally in your browser.',
    indexDescription: 'Decode and validate JWT tokens locally in your browser.',
    keywords: ['jwt', 'decode'],
    appRootId: 'jwt-decoder-app',
    publicPath: '/jwt-decoder/',
    absolutePageUrl: 'https://codesamplez.com/tools/jwt-decoder/',
    scriptType: 'module',
    featuredImagePath: DEFAULT_FEATURED_IMAGE_PATH,
    absoluteFeaturedImageUrl: 'https://codesamplez.com/tools/jwt-decoder/images/featured.png',
    catalogGroupId: 'encoders-decoders',
    catalogOrder: 1,
    dependencyScopes: ['build-system', 'shared-ui', 'shared-runtime'],
    relatedToolIds: ['jwt-builder-tool'],
    ...overrides
  };
}

function createMockRootConfig(overrides = {}) {
  return {
    siteBaseUrl: 'https://codesamplez.com/tools',
    siteName: 'CodeSamplez Tools',
    siteDescription: SITE_DESCRIPTION,
    rootPage: {
      title: 'CodeSamplez Tools',
      description: SITE_DESCRIPTION
    },
    catalogGroups: [
      { id: 'encoders-decoders', label: 'Encoders & Decoders' }
    ],
    rootShell: {
      id: 'root-shell',
      outputPath: 'build/root-shell'
    },
    rootAssets: ['index.html', 'styles.css', 'robots.txt'],
    ...overrides
  };
}

function createMockToolMetadata(overrides = {}) {
  return {
    id: 'fixture-tool',
    version: '1.0.0',
    title: 'Fixture Tool',
    description: 'Fixture description',
    indexDescription: 'Fixture description',
    catalogGroupId: 'encoders-decoders',
    catalogOrder: 1,
    appRootId: 'fixture-tool-app',
    publicPath: '/fixture-tool/',
    scriptType: 'module',
    dependencyScopes: ['build-system'],
    relatedToolIds: [],
    ...overrides
  };
}

function withMockedManifestFiles({ rootConfig = createMockRootConfig(), metadataBySourceRoot = {} }, run) {
  const metadataEntries = Object.entries(metadataBySourceRoot).map(([sourceRoot, rawContents]) => ([
    path.resolve(REPO_ROOT, sourceRoot, TOOL_METADATA_FILENAME),
    rawContents
  ]));
  const metadataByPath = new Map(metadataEntries);
  const actualReadFileSync = fs.readFileSync;
  const actualReaddirSync = fs.readdirSync;
  const actualExistsSync = fs.existsSync;

  const readdirSpy = jest.spyOn(fs, 'readdirSync').mockImplementation((targetPath, options) => {
    if (path.resolve(String(targetPath)) === REPO_ROOT && options && options.withFileTypes) {
      return Object.keys(metadataBySourceRoot).map((sourceRoot) => ({
        name: sourceRoot,
        isDirectory: () => true
      }));
    }

    return actualReaddirSync.call(fs, targetPath, options);
  });

  const existsSpy = jest.spyOn(fs, 'existsSync').mockImplementation((targetPath) => {
    const resolvedPath = path.resolve(String(targetPath));
    if (resolvedPath === ROOT_CONFIG_PATH || metadataByPath.has(resolvedPath)) {
      return true;
    }

    return actualExistsSync.call(fs, targetPath);
  });

  const readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((targetPath, options) => {
    const resolvedPath = path.resolve(String(targetPath));
    if (resolvedPath === ROOT_CONFIG_PATH) {
      return typeof rootConfig === 'string' ? rootConfig : JSON.stringify(rootConfig);
    }

    if (metadataByPath.has(resolvedPath)) {
      const rawMetadata = metadataByPath.get(resolvedPath);
      return typeof rawMetadata === 'string' ? rawMetadata : JSON.stringify(rawMetadata);
    }

    return actualReadFileSync.call(fs, targetPath, options);
  });

  try {
    return run();
  } finally {
    readFileSyncSpy.mockRestore();
    existsSpy.mockRestore();
    readdirSpy.mockRestore();
  }
}

describe('tool-manifest', () => {
  it('loads the shared root config', () => {
    expect(ROOT_CONFIG_PATH).toBe(path.resolve(__dirname, '../config/tooling-root.json'));
    expect(loadRootConfig()).toEqual({
      siteBaseUrl: 'https://codesamplez.com/tools',
      siteName: 'CodeSamplez Tools',
      siteDescription: 'Client-side formatters, converters, token tools, and text utilities with a consistent privacy-preserving workflow.',
      rootPage: {
        title: 'CodeSamplez Tools',
        description: 'Client-side formatters, converters, token tools, and text utilities with a consistent privacy-preserving workflow.'
      },
      catalogGroups: [
        { id: 'code-formatters', label: 'Code Formatters & Validators' },
        { id: 'encoders-decoders', label: 'Encoders & Decoders' },
        { id: 'text-analysis', label: 'Text Analysis & Diff Tools' }
      ],
      rootShell: {
        id: 'root-shell',
        outputPath: 'build/root-shell'
      },
      rootAssets: ['index.html', 'styles.css', 'robots.txt']
    });
  });

  it('rejects malformed root config fields', () => {
    expect(() => withMockedManifestFiles({
      rootConfig: '"bad-config"'
    }, () => loadRootConfig())).toThrow('Root config must be an object');

    expect(() => withMockedManifestFiles({
      rootConfig: createMockRootConfig({ siteName: '   ' })
    }, () => loadRootConfig())).toThrow('Root siteName must be a non-empty string');

    expect(() => withMockedManifestFiles({
      rootConfig: createMockRootConfig({ siteBaseUrl: 'not-a-url' })
    }, () => loadRootConfig())).toThrow('Root siteBaseUrl must be a valid absolute URL: not-a-url');

    expect(() => withMockedManifestFiles({
      rootConfig: createMockRootConfig({ rootPage: undefined })
    }, () => loadRootConfig())).toThrow('Root rootPage must be an object');

    expect(() => withMockedManifestFiles({
      rootConfig: createMockRootConfig({ rootShell: undefined })
    }, () => loadRootConfig())).toThrow('Root rootShell must be an object');

    expect(() => withMockedManifestFiles({
      rootConfig: createMockRootConfig({ catalogGroups: [] })
    }, () => loadRootConfig())).toThrow('Root catalogGroups must be a non-empty array');

    expect(() => withMockedManifestFiles({
      rootConfig: createMockRootConfig({ catalogGroups: [null] })
    }, () => loadRootConfig())).toThrow('Root catalogGroups[0] must be an object');

    expect(() => withMockedManifestFiles({
      rootConfig: createMockRootConfig({
        catalogGroups: [
          { id: 'encoders-decoders', label: 'Encoders & Decoders' },
          { id: 'encoders-decoders', label: 'Duplicate Group' }
        ]
      })
    }, () => loadRootConfig())).toThrow('Duplicate catalog group id detected: encoders-decoders');

    expect(() => withMockedManifestFiles({
      rootConfig: createMockRootConfig({
        rootAssets: /** @type {any} */ ('index.html')
      })
    }, () => loadRootConfig())).toThrow('Root rootAssets must be an array');
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
        indexDescription: 'Decode and validate JWT tokens locally in your browser.',
        keywords: ['jwt', 'decode', 'validate', 'token', 'auth'],
        appRootId: 'jwt-decoder-app',
        publicPath: '/jwt-decoder/',
        absolutePageUrl: 'https://codesamplez.com/tools/jwt-decoder/',
        scriptType: 'module',
        featuredImagePath: DEFAULT_FEATURED_IMAGE_PATH,
        absoluteFeaturedImageUrl: 'https://codesamplez.com/tools/jwt-decoder/images/featured.png',
        siteBaseUrl: 'https://codesamplez.com/tools',
        siteName: 'CodeSamplez Tools',
        siteDescription: 'Client-side formatters, converters, token tools, and text utilities with a consistent privacy-preserving workflow.',
        catalogGroupId: 'encoders-decoders',
        catalogOrder: 2,
        dependencyScopes: ['build-system', 'shared-ui', 'shared-runtime'],
        relatedToolIds: ['jwt-builder-tool', 'base64-converter-tool', 'json-formatter-tool']
      })
    ]));
  });

  it('builds a normalized manifest view', () => {
    expect(loadManifest()).toEqual({
      siteBaseUrl: 'https://codesamplez.com/tools',
      siteName: 'CodeSamplez Tools',
      siteDescription: 'Client-side formatters, converters, token tools, and text utilities with a consistent privacy-preserving workflow.',
      rootPage: {
        title: 'CodeSamplez Tools',
        description: 'Client-side formatters, converters, token tools, and text utilities with a consistent privacy-preserving workflow.',
        absoluteUrl: 'https://codesamplez.com/tools/'
      },
      catalogGroups: [
        { id: 'code-formatters', label: 'Code Formatters & Validators' },
        { id: 'encoders-decoders', label: 'Encoders & Decoders' },
        { id: 'text-analysis', label: 'Text Analysis & Diff Tools' }
      ],
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

  it('returns grouped tool definitions in catalog order', () => {
    expect(getCatalogGroups()).toEqual([
      { id: 'code-formatters', label: 'Code Formatters & Validators' },
      { id: 'encoders-decoders', label: 'Encoders & Decoders' },
      { id: 'text-analysis', label: 'Text Analysis & Diff Tools' }
    ]);

    expect(getGroupedToolDefinitions()).toEqual([
      expect.objectContaining({
        id: 'code-formatters',
        label: 'Code Formatters & Validators',
        tools: [
          expect.objectContaining({ id: 'json-formatter-tool', catalogOrder: 1 }),
          expect.objectContaining({ id: 'js-minifier-tool', catalogOrder: 2 }),
          expect.objectContaining({ id: 'css-minifier-tool', catalogOrder: 3 })
        ]
      }),
      expect.objectContaining({
        id: 'encoders-decoders',
        tools: [
          expect.objectContaining({ id: 'base64-converter-tool', catalogOrder: 1 }),
          expect.objectContaining({ id: 'jwt-decoder-tool', catalogOrder: 2 }),
          expect.objectContaining({ id: 'jwt-builder-tool', catalogOrder: 3 }),
          expect.objectContaining({ id: 'qr-code-generator', catalogOrder: 4 }),
          expect.objectContaining({ id: 'data-format-converter', catalogOrder: 5 })
        ]
      }),
      expect.objectContaining({
        id: 'text-analysis',
        tools: [
          expect.objectContaining({ id: 'diff-checker-tool', catalogOrder: 1 }),
          expect.objectContaining({ id: 'text-analyzer-tool', catalogOrder: 2 })
        ]
      })
    ]);
  });

  it('normalizes optional keywords and rejects malformed tool metadata', () => {
    expect(withMockedManifestFiles({
      metadataBySourceRoot: {
        fixture: createMockToolMetadata()
      }
    }, () => getToolDefinitions())).toEqual([
      expect.objectContaining({
        id: 'fixture-tool',
        keywords: [],
        absolutePageUrl: 'https://codesamplez.com/tools/fixture-tool/',
        absoluteFeaturedImageUrl: 'https://codesamplez.com/tools/fixture-tool/images/featured.png'
      })
    ]);

    expect(() => withMockedManifestFiles({
      metadataBySourceRoot: {
        fixture: '"bad-metadata"'
      }
    }, () => getToolDefinitions())).toThrow(
      `Tool metadata at ${path.resolve(REPO_ROOT, 'fixture', TOOL_METADATA_FILENAME)} must be an object`
    );

    expect(() => withMockedManifestFiles({
      metadataBySourceRoot: {
        fixture: createMockToolMetadata({
          catalogOrder: /** @type {any} */ ('1')
        })
      }
    }, () => getToolDefinitions())).toThrow('Tool catalogOrder must be a positive integer');

    expect(() => withMockedManifestFiles({
      metadataBySourceRoot: {
        fixture: createMockToolMetadata({
          catalogOrder: 0
        })
      }
    }, () => getToolDefinitions())).toThrow('Tool catalogOrder must be a positive integer');

    expect(() => withMockedManifestFiles({
      metadataBySourceRoot: {
        fixture: createMockToolMetadata({
          keywords: ['fixture', 'fixture']
        })
      }
    }, () => getToolDefinitions())).toThrow('Tool keywords contains a duplicate value: fixture');

    expect(() => withMockedManifestFiles({
      metadataBySourceRoot: {
        fixture: createMockToolMetadata({
          scriptType: /** @type {any} */ ('esm')
        })
      }
    }, () => getToolDefinitions())).toThrow('Tool fixture-tool scriptType must be "module" or "classic"');
  });

  it('returns tool ids, lookups, metadata paths, and root helpers', () => {
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

    expect(getRootAssets()).toEqual(['index.html', 'styles.css', 'robots.txt']);
    expect(getRootPageDefinition()).toEqual({
      title: 'CodeSamplez Tools',
      description: 'Client-side formatters, converters, token tools, and text utilities with a consistent privacy-preserving workflow.',
      absoluteUrl: 'https://codesamplez.com/tools/'
    });
    expect(getSiteBaseUrl()).toBe('https://codesamplez.com/tools');
    expect(getSiteName()).toBe('CodeSamplez Tools');
    expect(getSiteDescription()).toBe('Client-side formatters, converters, token tools, and text utilities with a consistent privacy-preserving workflow.');
    expect(getRootShellDefinition()).toEqual({
      id: 'root-shell',
      outputPath: 'build/root-shell'
    });
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
    expect(() => validateToolDefinitions([
      {
        ...createBaseTool(),
        id: 'jwt-decoder-tool',
        relatedToolIds: /** @type {any} */ (undefined)
      },
      createBaseTool({
        id: 'jwt-builder-tool',
        sourceRoot: 'jwt-builder',
        outputDir: 'jwt-builder',
        outputPath: 'build/jwt-builder',
        title: 'JWT Builder',
        description: 'Create and sign JWT tokens locally with standard and custom claims.',
        indexDescription: 'Create and sign JWT tokens locally with standard and custom claims.',
        appRootId: 'jwt-builder-app',
        publicPath: '/jwt-builder/',
        absolutePageUrl: 'https://codesamplez.com/tools/jwt-builder/',
        absoluteFeaturedImageUrl: 'https://codesamplez.com/tools/jwt-builder/images/featured.png',
        catalogOrder: 2,
        relatedToolIds: ['jwt-decoder-tool']
      })
    ], CATALOG_GROUPS)).toThrow('must define relatedToolIds as an array');

    expect(() => validateToolDefinitions([
      createBaseTool({
        id: 'jwt-decoder-tool',
        relatedToolIds: ['']
      }),
      createBaseTool({
        id: 'jwt-builder-tool',
        sourceRoot: 'jwt-builder',
        outputDir: 'jwt-builder',
        outputPath: 'build/jwt-builder',
        title: 'JWT Builder',
        description: 'Create and sign JWT tokens locally with standard and custom claims.',
        indexDescription: 'Create and sign JWT tokens locally with standard and custom claims.',
        appRootId: 'jwt-builder-app',
        publicPath: '/jwt-builder/',
        absolutePageUrl: 'https://codesamplez.com/tools/jwt-builder/',
        absoluteFeaturedImageUrl: 'https://codesamplez.com/tools/jwt-builder/images/featured.png',
        catalogOrder: 2,
        relatedToolIds: ['jwt-decoder-tool']
      })
    ], CATALOG_GROUPS)).toThrow('contains an invalid related tool id');

    expect(() => validateToolDefinitions([
      createBaseTool({
        id: 'jwt-decoder-tool',
        relatedToolIds: ['jwt-decoder-tool']
      }),
      createBaseTool({
        id: 'jwt-builder-tool',
        sourceRoot: 'jwt-builder',
        outputDir: 'jwt-builder',
        outputPath: 'build/jwt-builder',
        title: 'JWT Builder',
        description: 'Create and sign JWT tokens locally with standard and custom claims.',
        indexDescription: 'Create and sign JWT tokens locally with standard and custom claims.',
        appRootId: 'jwt-builder-app',
        publicPath: '/jwt-builder/',
        absolutePageUrl: 'https://codesamplez.com/tools/jwt-builder/',
        absoluteFeaturedImageUrl: 'https://codesamplez.com/tools/jwt-builder/images/featured.png',
        catalogOrder: 2,
        relatedToolIds: ['jwt-decoder-tool']
      })
    ], CATALOG_GROUPS)).toThrow('cannot reference itself');

    expect(() => validateToolDefinitions([
      createBaseTool({
        id: 'jwt-decoder-tool',
        relatedToolIds: ['jwt-builder-tool', 'jwt-builder-tool']
      }),
      createBaseTool({
        id: 'jwt-builder-tool',
        sourceRoot: 'jwt-builder',
        outputDir: 'jwt-builder',
        outputPath: 'build/jwt-builder',
        title: 'JWT Builder',
        description: 'Create and sign JWT tokens locally with standard and custom claims.',
        indexDescription: 'Create and sign JWT tokens locally with standard and custom claims.',
        appRootId: 'jwt-builder-app',
        publicPath: '/jwt-builder/',
        absolutePageUrl: 'https://codesamplez.com/tools/jwt-builder/',
        absoluteFeaturedImageUrl: 'https://codesamplez.com/tools/jwt-builder/images/featured.png',
        catalogOrder: 2,
        relatedToolIds: ['jwt-decoder-tool']
      })
    ], CATALOG_GROUPS)).toThrow('duplicate related tool id');

    expect(() => validateToolDefinitions([
      createBaseTool({
        id: 'jwt-decoder-tool',
        relatedToolIds: ['not-a-real-tool']
      }),
      createBaseTool({
        id: 'jwt-builder-tool',
        sourceRoot: 'jwt-builder',
        outputDir: 'jwt-builder',
        outputPath: 'build/jwt-builder',
        title: 'JWT Builder',
        description: 'Create and sign JWT tokens locally with standard and custom claims.',
        indexDescription: 'Create and sign JWT tokens locally with standard and custom claims.',
        appRootId: 'jwt-builder-app',
        publicPath: '/jwt-builder/',
        absolutePageUrl: 'https://codesamplez.com/tools/jwt-builder/',
        absoluteFeaturedImageUrl: 'https://codesamplez.com/tools/jwt-builder/images/featured.png',
        catalogOrder: 2,
        relatedToolIds: ['jwt-decoder-tool']
      })
    ], CATALOG_GROUPS)).toThrow('unknown related tool id');
  });

  it('rejects duplicate public paths, output dirs, unknown groups, duplicate group ordering, and duplicate keywords', () => {
    const decoderTool = createBaseTool({
      id: 'jwt-decoder-tool',
      relatedToolIds: ['jwt-builder-tool']
    });
    const builderTool = createBaseTool({
      id: 'jwt-builder-tool',
      sourceRoot: 'jwt-builder',
      outputDir: 'jwt-builder',
      outputPath: 'build/jwt-builder',
      title: 'JWT Builder',
      description: 'Create and sign JWT tokens locally with standard and custom claims.',
      indexDescription: 'Create and sign JWT tokens locally with standard and custom claims.',
      appRootId: 'jwt-builder-app',
      publicPath: '/jwt-builder/',
      absolutePageUrl: 'https://codesamplez.com/tools/jwt-builder/',
      absoluteFeaturedImageUrl: 'https://codesamplez.com/tools/jwt-builder/images/featured.png',
      catalogOrder: 2,
      relatedToolIds: ['jwt-decoder-tool']
    });

    expect(() => validateToolDefinitions([
      decoderTool,
      {
        ...builderTool,
        publicPath: '/jwt-decoder/'
      }
    ], CATALOG_GROUPS)).toThrow('Duplicate tool publicPath detected for jwt-builder-tool: /jwt-decoder/');

    expect(() => validateToolDefinitions([
      decoderTool,
      {
        ...builderTool,
        outputDir: 'jwt-decoder',
        outputPath: 'build/jwt-decoder'
      }
    ], CATALOG_GROUPS)).toThrow('Duplicate tool outputDir detected for jwt-builder-tool: jwt-decoder');

    expect(() => validateToolDefinitions([
      decoderTool,
      {
        ...builderTool,
        catalogGroupId: 'not-a-real-group'
      }
    ], CATALOG_GROUPS)).toThrow('unknown catalog group id');

    expect(() => validateToolDefinitions([
      decoderTool,
      {
        ...builderTool,
        catalogOrder: 1
      }
    ], CATALOG_GROUPS)).toThrow('Duplicate catalogOrder 1 detected for catalog group encoders-decoders');

    expect(() => validateToolDefinitions([
      {
        ...decoderTool,
        keywords: ['jwt', 'jwt']
      },
      builderTool
    ], CATALOG_GROUPS)).toThrow('duplicate keyword');
  });

  it('rejects missing or invalid keyword arrays during validation', () => {
    const decoderTool = createBaseTool({
      id: 'jwt-decoder-tool',
      relatedToolIds: ['jwt-builder-tool']
    });
    const builderTool = createBaseTool({
      id: 'jwt-builder-tool',
      sourceRoot: 'jwt-builder',
      outputDir: 'jwt-builder',
      outputPath: 'build/jwt-builder',
      title: 'JWT Builder',
      description: 'Create and sign JWT tokens locally with standard and custom claims.',
      indexDescription: 'Create and sign JWT tokens locally with standard and custom claims.',
      appRootId: 'jwt-builder-app',
      publicPath: '/jwt-builder/',
      absolutePageUrl: 'https://codesamplez.com/tools/jwt-builder/',
      absoluteFeaturedImageUrl: 'https://codesamplez.com/tools/jwt-builder/images/featured.png',
      catalogOrder: 2,
      relatedToolIds: ['jwt-decoder-tool']
    });

    expect(() => validateToolDefinitions([
      {
        ...decoderTool,
        keywords: /** @type {any} */ (undefined)
      },
      builderTool
    ], CATALOG_GROUPS)).toThrow('Tool jwt-decoder-tool must define keywords as an array');

    expect(() => validateToolDefinitions([
      {
        ...decoderTool,
        keywords: ['']
      },
      builderTool
    ], CATALOG_GROUPS)).toThrow('Tool jwt-decoder-tool contains an invalid keyword');
  });
});
