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
  getDevelopmentSiteBaseUrl,
  getSiteBaseUrl,
  getSiteStaticRootUri,
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
  resolveAnalyticsConfig,
  resolveSiteBaseUrl,
  resolveSiteStaticRootUri,
  selectTools,
  splitCsv,
  validateToolDefinitions
} = require('./tool-manifest');

const CATALOG_GROUPS = loadRootConfig().catalogGroups;
const PROD_SITE_BASE_URL = getSiteBaseUrl();
const PROD_SITE_STATIC_ROOT_URI = getSiteStaticRootUri();
const SITE_DESCRIPTION = 'Client-side formatters, converters, token tools, and text utilities with a consistent privacy-preserving workflow.';
const ROOT_PAGE_TITLE = 'Online Developer Tools';
const ROOT_PAGE_DESCRIPTION = 'Free online developer tools for debugging, formatting and validation needs. Access 12+ utilities to help boost your day-to-day productivity.';

function buildProdSiteHref(publicPath) {
  return new URL(publicPath.replace(/^\/+/, ''), `${PROD_SITE_BASE_URL}/`).toString();
}

function buildProdStaticAssetUri(pathName) {
  return new URL(pathName.replace(/^\/+/, ''), `${PROD_SITE_STATIC_ROOT_URI}/`).toString();
}

function createBaseTool(overrides = {}) {
  return {
    siteBaseUrl: PROD_SITE_BASE_URL,
    siteStaticRootUri: PROD_SITE_STATIC_ROOT_URI,
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
    absolutePageUrl: buildProdSiteHref('/jwt-decoder/'),
    scriptType: 'module',
    featuredImagePath: DEFAULT_FEATURED_IMAGE_PATH,
    absoluteFeaturedImageUrl: buildProdStaticAssetUri('/jwt-decoder/images/featured.png'),
    catalogGroupId: 'encoders-decoders',
    catalogOrder: 1,
    dependencyScopes: ['build-system', 'shared-ui', 'shared-runtime'],
    relatedToolIds: ['jwt-builder-tool'],
    ...overrides
  };
}

function createMockRootConfig(overrides = {}) {
  return {
    siteBaseUrl: PROD_SITE_BASE_URL,
    siteStaticRootUri: PROD_SITE_STATIC_ROOT_URI,
    siteName: 'CodeSamplez Tools',
    siteDescription: SITE_DESCRIPTION,
    organization: {
      name: 'CodeSamplez',
      url: 'https://codesamplez.com/',
      logo: 'https://tools.codesamplez.com/apple-touch-icon.png',
      sameAs: ['https://codesamplez.com/', 'https://github.com/ranacseruet/codesamplez-tools']
    },
    rootPage: {
      title: ROOT_PAGE_TITLE,
      description: ROOT_PAGE_DESCRIPTION,
      image: 'og-home.png'
    },
    catalogGroups: [
      { id: 'encoders-decoders', label: 'Encoders & Decoders' }
    ],
    rootShell: {
      id: 'root-shell',
      outputPath: 'build/root-shell'
    },
    rootAssets: ['index.html', '404.html', 'styles.css', 'og-home.png', 'robots.txt', 'sitemap.xml'],
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

function withEnv(overrides, run) {
  const originalEnv = { ...process.env };

  Object.keys(overrides).forEach((key) => {
    const value = overrides[key];
    if (typeof value === 'undefined') {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  });

  try {
    return run();
  } finally {
    process.env = originalEnv;
  }
}

describe('tool-manifest', () => {
  it('loads the shared root config', () => {
    expect(ROOT_CONFIG_PATH).toBe(path.resolve(__dirname, '../config/tooling-root.json'));
    // Production env: the configured analytics ids resolve only for
    // production builds (the gate fails closed everywhere else).
    expect(withEnv({ NODE_ENV: 'production' }, () => loadRootConfig())).toEqual({
      siteBaseUrl: PROD_SITE_BASE_URL,
      siteStaticRootUri: PROD_SITE_STATIC_ROOT_URI,
      siteName: 'CodeSamplez Tools',
      siteDescription: 'Client-side formatters, converters, token tools, and text utilities with a consistent privacy-preserving workflow.',
      organization: {
        name: 'CodeSamplez',
        url: 'https://codesamplez.com/',
        logo: 'https://tools.codesamplez.com/apple-touch-icon.png',
        sameAs: ['https://codesamplez.com/', 'https://github.com/ranacseruet/codesamplez-tools']
      },
      // Analytics ids ship empty so forks/self-hosters never inherit the
      // upstream GA/AdSense properties; deployments inject them via env.
      analytics: { googleAnalyticsId: null, adsenseClientId: null },
      rootPage: {
        title: ROOT_PAGE_TITLE,
        description: ROOT_PAGE_DESCRIPTION,
        image: 'og-home.png'
      },
      catalogGroups: [
        { id: 'code-formatters', label: 'Code Formatters & Validators' },
        { id: 'encoders-decoders', label: 'Encoders & Decoders' },
        { id: 'text-analysis', label: 'Text Analysis & Diff Tools' },
        { id: 'image-tools', label: 'Image Tools' }
      ],
      rootShell: {
        id: 'root-shell',
        outputPath: 'build/root-shell'
      },
      rootAssets: ['index.html', '404.html', 'styles.css', 'og-home.png', 'robots.txt', 'sitemap.xml', 'llms.txt', 'versions.json', 'BingSiteAuth.xml', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'fonts/Geist-Variable.woff2', 'fonts/GeistMono-Variable.woff2']
    });
  });

  it('resolves analytics ids from config with env overrides and validation', () => {
    expect(withEnv({
      NODE_ENV: 'production'
    }, () => resolveAnalyticsConfig({ googleAnalyticsId: 'G-CONFIG123', adsenseClientId: 'ca-pub-1111111111111111' })))
      .toEqual({ googleAnalyticsId: 'G-CONFIG123', adsenseClientId: 'ca-pub-1111111111111111' });

    expect(resolveAnalyticsConfig({})).toEqual({ googleAnalyticsId: null, adsenseClientId: null });
    expect(resolveAnalyticsConfig(undefined)).toEqual({ googleAnalyticsId: null, adsenseClientId: null });
    expect(withEnv({
      NODE_ENV: 'production'
    }, () => resolveAnalyticsConfig({ googleAnalyticsId: '', adsenseClientId: '' })))
      .toEqual({ googleAnalyticsId: null, adsenseClientId: null });

    expect(withEnv({
      NODE_ENV: 'production',
      CST_GA_MEASUREMENT_ID: 'G-ENVOVERRIDE',
      CST_ADSENSE_CLIENT_ID: 'ca-pub-2222222222222222'
    }, () => resolveAnalyticsConfig({ googleAnalyticsId: 'G-CONFIG123', adsenseClientId: 'ca-pub-1111111111111111' })))
      .toEqual({ googleAnalyticsId: 'G-ENVOVERRIDE', adsenseClientId: 'ca-pub-2222222222222222' });

    expect(withEnv({
      NODE_ENV: 'production'
    }, () => {
      expect(() => resolveAnalyticsConfig({ googleAnalyticsId: 'not-a-ga-id' }))
        .toThrow(/googleAnalyticsId/);
      expect(() => resolveAnalyticsConfig({ adsenseClientId: 'pub-missing-prefix' }))
        .toThrow(/adsenseClientId/);
    })).toBeUndefined();
  });

  it('disables analytics entirely in development builds', () => {
    expect(withEnv({
      NODE_ENV: 'development',
      CST_GA_MEASUREMENT_ID: 'G-ENVOVERRIDE',
      CST_ADSENSE_CLIENT_ID: 'ca-pub-2222222222222222'
    }, () => resolveAnalyticsConfig({ googleAnalyticsId: 'G-CONFIG123', adsenseClientId: 'ca-pub-1111111111111111' })))
      .toEqual({ googleAnalyticsId: null, adsenseClientId: null });
  });

  it('fails closed: analytics stays disabled for any non-production NODE_ENV', () => {
    const configured = { googleAnalyticsId: 'G-CONFIG123', adsenseClientId: 'ca-pub-1111111111111111' };

    // Unset, empty, test/CI, and staging-like values must all resolve to null
    // ids — only an explicit production build injects trackers.
    ['development', 'test', 'staging', '', undefined].forEach((nodeEnv) => {
      expect(withEnv({
        NODE_ENV: nodeEnv,
        CST_GA_MEASUREMENT_ID: 'G-ENVOVERRIDE',
        CST_ADSENSE_CLIENT_ID: 'ca-pub-2222222222222222'
      }, () => resolveAnalyticsConfig(configured)))
        .toEqual({ googleAnalyticsId: null, adsenseClientId: null });
    });
  });

  it('honours the CST_DISABLE_ANALYTICS kill-switch even for production builds', () => {
    const configured = { googleAnalyticsId: 'G-CONFIG123', adsenseClientId: 'ca-pub-1111111111111111' };

    ['1', 'true', 'TRUE', 'yes', ' Yes '].forEach((killSwitch) => {
      expect(withEnv({
        NODE_ENV: 'production',
        CST_DISABLE_ANALYTICS: killSwitch
      }, () => resolveAnalyticsConfig(configured)))
        .toEqual({ googleAnalyticsId: null, adsenseClientId: null });
    });

    // Falsy values leave production injection enabled.
    ['0', 'false', 'no', '', undefined].forEach((killSwitch) => {
      expect(withEnv({
        NODE_ENV: 'production',
        CST_DISABLE_ANALYTICS: killSwitch
      }, () => resolveAnalyticsConfig(configured)))
        .toEqual({ googleAnalyticsId: 'G-CONFIG123', adsenseClientId: 'ca-pub-1111111111111111' });
    });
  });

  it('resolves production, development, and explicit override site base urls', () => {
    expect(resolveSiteBaseUrl(PROD_SITE_BASE_URL)).toBe(PROD_SITE_BASE_URL);
    expect(resolveSiteStaticRootUri(undefined, PROD_SITE_BASE_URL)).toBe(PROD_SITE_BASE_URL);

    expect(withEnv({
      NODE_ENV: 'development',
      PORT: '8081',
      CST_SITE_BASE_URL: undefined
    }, () => resolveSiteBaseUrl(PROD_SITE_BASE_URL))).toBe('http://localhost:8081');

    expect(withEnv({
      NODE_ENV: 'development',
      PORT: '9090',
      CST_SITE_BASE_URL: undefined
    }, () => getDevelopmentSiteBaseUrl())).toBe('http://localhost:9090');

    expect(withEnv({
      NODE_ENV: 'development',
      PORT: '8081',
      CST_SITE_BASE_URL: 'https://preview.tools.codesamplez.com'
    }, () => resolveSiteBaseUrl(PROD_SITE_BASE_URL))).toBe('https://preview.tools.codesamplez.com');

    expect(resolveSiteStaticRootUri('https://static.example.test/tools-assets', PROD_SITE_BASE_URL))
      .toBe('https://static.example.test/tools-assets');

    expect(withEnv({
      CST_SITE_STATIC_ROOT_URI: 'https://cdn.example.test/tools'
    }, () => resolveSiteStaticRootUri('https://static.example.test/tools-assets', PROD_SITE_BASE_URL)))
      .toBe('https://cdn.example.test/tools');

    // In development the configured production static root is ignored so assets
    // resolve to the local dev origin and local edits are visible.
    expect(withEnv({
      NODE_ENV: 'development',
      CST_SITE_STATIC_ROOT_URI: undefined
    }, () => resolveSiteStaticRootUri('https://static.example.test/tools-assets', 'http://localhost:8081')))
      .toBe('http://localhost:8081');

    // An explicit override still wins, even in development.
    expect(withEnv({
      NODE_ENV: 'development',
      CST_SITE_STATIC_ROOT_URI: 'https://cdn.example.test/tools'
    }, () => resolveSiteStaticRootUri('https://static.example.test/tools-assets', 'http://localhost:8081')))
      .toBe('https://cdn.example.test/tools');
  });

  it('uses the development site base url in root config and tool definitions when NODE_ENV=development', () => {
    expect(withEnv({
      NODE_ENV: 'development',
      PORT: '8081',
      CST_SITE_BASE_URL: undefined
    }, () => loadRootConfig().siteBaseUrl)).toBe('http://localhost:8081');

    expect(withEnv({
      NODE_ENV: 'development',
      PORT: '8081',
      CST_SITE_BASE_URL: undefined,
      CST_SITE_STATIC_ROOT_URI: undefined
    }, () => loadRootConfig().siteStaticRootUri)).toBe('http://localhost:8081');

    expect(withEnv({
      NODE_ENV: 'development',
      PORT: '8081',
      CST_SITE_BASE_URL: undefined,
      CST_SITE_STATIC_ROOT_URI: undefined
    }, () => {
      const tool = getToolById('jwt-decoder-tool');
      return {
        siteBaseUrl: tool.siteBaseUrl,
        siteStaticRootUri: tool.siteStaticRootUri,
        absolutePageUrl: tool.absolutePageUrl,
        absoluteFeaturedImageUrl: tool.absoluteFeaturedImageUrl
      };
    })).toEqual({
      siteBaseUrl: 'http://localhost:8081',
      siteStaticRootUri: 'http://localhost:8081',
      absolutePageUrl: 'http://localhost:8081/jwt-decoder/',
      absoluteFeaturedImageUrl: 'http://localhost:8081/jwt-decoder/images/featured.png'
    });
  });

  it('defaults the static root to the development site base url when config and env overrides are absent', () => {
    expect(withEnv({
      NODE_ENV: 'development',
      PORT: '8081',
      CST_SITE_BASE_URL: undefined,
      CST_SITE_STATIC_ROOT_URI: undefined
    }, () => withMockedManifestFiles({
      rootConfig: createMockRootConfig({ siteStaticRootUri: undefined })
    }, () => loadRootConfig().siteStaticRootUri))).toBe('http://localhost:8081');
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
      rootConfig: createMockRootConfig({ siteStaticRootUri: 'not-a-url' })
    }, () => loadRootConfig())).toThrow('Root siteStaticRootUri must be a valid absolute URL: not-a-url');

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

    expect(toolDefinitions).toHaveLength(12);
    expect(toolDefinitions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'image-editor',
        sourceRoot: 'image-editor',
        outputDir: 'image-editor',
        outputPath: 'build/image-editor',
        catalogGroupId: 'image-tools',
        catalogOrder: 1,
        appRootId: 'image-editor-app',
        publicPath: '/image-editor/'
      }),
      expect.objectContaining({
        id: 'jwt-decoder-tool',
        sourceRoot: 'jwt-decoder',
        outputDir: 'jwt-decoder',
        outputPath: 'build/jwt-decoder',
        version: '1.0.2',
        title: 'JWT Decoder & Validator',
        description: 'Free online JWT decoder – instantly reveal a token’s header, payload, and verify its signature. Paste your JWT to decode it now.',
        indexDescription: 'Decode and validate JSON Web Tokens (JWT). Inspect header, payload, and verify signatures with your secret key for token authenticity.',
        keywords: ['jwt', 'decode', 'validate', 'token', 'auth'],
        appRootId: 'jwt-decoder-app',
        publicPath: '/jwt-decoder/',
        absolutePageUrl: buildProdSiteHref('/jwt-decoder/'),
        scriptType: 'module',
        featuredImagePath: DEFAULT_FEATURED_IMAGE_PATH,
        absoluteFeaturedImageUrl: buildProdStaticAssetUri('/jwt-decoder/images/featured.png'),
        siteBaseUrl: PROD_SITE_BASE_URL,
        siteStaticRootUri: PROD_SITE_STATIC_ROOT_URI,
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
    // Production env: the manifest carries the configured analytics ids only
    // for production builds (the gate fails closed everywhere else).
    expect(withEnv({ NODE_ENV: 'production' }, () => loadManifest())).toEqual({
      siteBaseUrl: PROD_SITE_BASE_URL,
      siteStaticRootUri: PROD_SITE_STATIC_ROOT_URI,
      siteName: 'CodeSamplez Tools',
      siteDescription: 'Client-side formatters, converters, token tools, and text utilities with a consistent privacy-preserving workflow.',
      organization: {
        name: 'CodeSamplez',
        url: 'https://codesamplez.com/',
        logo: 'https://tools.codesamplez.com/apple-touch-icon.png',
        sameAs: ['https://codesamplez.com/', 'https://github.com/ranacseruet/codesamplez-tools']
      },
      // Analytics ids ship empty; deployments inject them via env (see above).
      analytics: { googleAnalyticsId: null, adsenseClientId: null },
      rootPage: {
        title: ROOT_PAGE_TITLE,
        description: ROOT_PAGE_DESCRIPTION,
        absoluteUrl: `${PROD_SITE_BASE_URL}/`,
        staticRootUri: `${PROD_SITE_STATIC_ROOT_URI}/`,
        imageUrl: `${PROD_SITE_STATIC_ROOT_URI}/og-home.png`
      },
      catalogGroups: [
        { id: 'code-formatters', label: 'Code Formatters & Validators' },
        { id: 'encoders-decoders', label: 'Encoders & Decoders' },
        { id: 'text-analysis', label: 'Text Analysis & Diff Tools' },
        { id: 'image-tools', label: 'Image Tools' }
      ],
      tools: expect.arrayContaining([
        expect.objectContaining({ id: 'base64-converter-tool' }),
        expect.objectContaining({ id: 'jwt-decoder-tool' }),
        expect.objectContaining({ id: 'image-editor' })
      ]),
      rootShell: {
        id: 'root-shell',
        outputPath: 'build/root-shell'
      },
      rootAssets: ['index.html', '404.html', 'styles.css', 'og-home.png', 'robots.txt', 'sitemap.xml', 'llms.txt', 'versions.json', 'BingSiteAuth.xml', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'fonts/Geist-Variable.woff2', 'fonts/GeistMono-Variable.woff2']
    });
  });

  it('returns grouped tool definitions in catalog order', () => {
    expect(getCatalogGroups()).toEqual([
      { id: 'code-formatters', label: 'Code Formatters & Validators' },
      { id: 'encoders-decoders', label: 'Encoders & Decoders' },
      { id: 'text-analysis', label: 'Text Analysis & Diff Tools' },
      { id: 'image-tools', label: 'Image Tools' }
    ]);

    expect(getGroupedToolDefinitions()).toEqual([
      expect.objectContaining({
        id: 'code-formatters',
        label: 'Code Formatters & Validators',
        tools: [
          expect.objectContaining({ id: 'json-formatter-tool', catalogOrder: 1 }),
          expect.objectContaining({ id: 'js-minifier-tool', catalogOrder: 2 }),
          expect.objectContaining({ id: 'css-minifier-tool', catalogOrder: 3 }),
          expect.objectContaining({ id: 'json-editor-tool', catalogOrder: 4 })
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
      }),
      expect.objectContaining({
        id: 'image-tools',
        label: 'Image Tools',
        tools: [
          expect.objectContaining({ id: 'image-editor', catalogOrder: 1 })
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
        structuredData: { includeFaq: true, includeHowTo: true },
        absolutePageUrl: buildProdSiteHref('/fixture-tool/'),
        absoluteFeaturedImageUrl: buildProdStaticAssetUri('/fixture-tool/images/featured.png')
      })
    ]);

    expect(withMockedManifestFiles({
      metadataBySourceRoot: {
        fixture: createMockToolMetadata({
          structuredData: { includeFaq: false, includeHowTo: false }
        })
      }
    }, () => getToolDefinitions())).toEqual([
      expect.objectContaining({
        id: 'fixture-tool',
        structuredData: { includeFaq: false, includeHowTo: false }
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
          version: 'not-semver'
        })
      }
    }, () => getToolDefinitions())).toThrow('Tool version must be a semantic version (x.y.z), got: not-semver');

    expect(() => withMockedManifestFiles({
      metadataBySourceRoot: {
        fixture: createMockToolMetadata({
          version: '1.0.0-beta'
        })
      }
    }, () => getToolDefinitions())).toThrow('Tool version must be a semantic version (x.y.z), got: 1.0.0-beta');

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
          structuredData: { includeFaq: /** @type {any} */ ('false') }
        })
      }
    }, () => getToolDefinitions())).toThrow('Tool structuredData.includeFaq must be a boolean');

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
    expect(getToolById('json-editor-tool')).toEqual(expect.objectContaining({
      structuredData: { includeFaq: false, includeHowTo: false }
    }));
    expect(getToolById('json-formatter-tool')).toEqual(expect.objectContaining({
      structuredData: { includeFaq: true, includeHowTo: true }
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

    // ads.txt is appended dynamically only when AdSense is configured. The repo
    // config ships no ids, so it is the deploy-time env that turns it on — under
    // production env, which is the only gate that injects trackers.
    const baseRootAssets = ['index.html', '404.html', 'styles.css', 'og-home.png', 'robots.txt', 'sitemap.xml', 'llms.txt', 'versions.json', 'BingSiteAuth.xml', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'fonts/Geist-Variable.woff2', 'fonts/GeistMono-Variable.woff2'];
    expect(withEnv({
      NODE_ENV: 'production',
      CST_ADSENSE_CLIENT_ID: undefined
    }, () => getRootAssets())).toEqual(baseRootAssets);
    expect(withEnv({
      NODE_ENV: 'production',
      CST_ADSENSE_CLIENT_ID: 'ca-pub-1234567890123456'
    }, () => getRootAssets())).toEqual([...baseRootAssets, 'ads.txt']);
    expect(getRootPageDefinition()).toEqual({
      title: ROOT_PAGE_TITLE,
      description: ROOT_PAGE_DESCRIPTION,
      absoluteUrl: `${PROD_SITE_BASE_URL}/`,
      staticRootUri: `${PROD_SITE_STATIC_ROOT_URI}/`,
      imageUrl: `${PROD_SITE_STATIC_ROOT_URI}/og-home.png`
    });
    expect(getSiteBaseUrl()).toBe(PROD_SITE_BASE_URL);
    expect(getSiteStaticRootUri()).toBe(PROD_SITE_STATIC_ROOT_URI);
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
        absolutePageUrl: buildProdSiteHref('/jwt-builder/'),
        absoluteFeaturedImageUrl: buildProdStaticAssetUri('/jwt-builder/images/featured.png'),
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
        absolutePageUrl: buildProdSiteHref('/jwt-builder/'),
        absoluteFeaturedImageUrl: buildProdStaticAssetUri('/jwt-builder/images/featured.png'),
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
        absolutePageUrl: buildProdSiteHref('/jwt-builder/'),
        absoluteFeaturedImageUrl: buildProdStaticAssetUri('/jwt-builder/images/featured.png'),
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
        absolutePageUrl: buildProdSiteHref('/jwt-builder/'),
        absoluteFeaturedImageUrl: buildProdStaticAssetUri('/jwt-builder/images/featured.png'),
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
        absolutePageUrl: buildProdSiteHref('/jwt-builder/'),
        absoluteFeaturedImageUrl: buildProdStaticAssetUri('/jwt-builder/images/featured.png'),
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
      absolutePageUrl: buildProdSiteHref('/jwt-builder/'),
      absoluteFeaturedImageUrl: buildProdStaticAssetUri('/jwt-builder/images/featured.png'),
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
      absolutePageUrl: buildProdSiteHref('/jwt-builder/'),
      absoluteFeaturedImageUrl: buildProdStaticAssetUri('/jwt-builder/images/featured.png'),
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
