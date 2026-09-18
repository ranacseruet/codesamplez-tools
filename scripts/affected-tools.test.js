const path = require('path');
const { readFileSync } = require('fs');
const { getToolDefinitions, getToolIds, parseToolSelectionArgs } = require('./tool-manifest');
const {
  buildReverseRelatedToolMap,
  detectAffectedTargets,
  isAllToolsTrigger,
  isRootOnlyTrigger,
  isToolMetadataPath
} = require('./affected-tools');

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

describe('parseToolSelectionArgs', () => {
  it('parses single and multi-tool selections with root flags', () => {
    expect(parseToolSelectionArgs([
      '--tool', 'jwt-decoder-tool',
      '--tools', 'json-formatter-tool,css-minifier-tool',
      '--include-root-shell',
      '--include-root-assets'
    ])).toEqual({
      requestedTools: ['jwt-decoder-tool', 'json-formatter-tool', 'css-minifier-tool'],
      includeRootShell: true,
      includeRootAssets: true
    });
  });

  it('rejects unknown tool ids', () => {
    expect(() => parseToolSelectionArgs(['--tool', 'not-a-real-tool'])).toThrow('Unknown tool id');
  });
});

describe('tool metadata discovery', () => {
  it('builds tool definitions from per-tool metadata files', () => {
    expect(getToolDefinitions()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'jwt-decoder-tool',
        sourceRoot: 'jwt-decoder',
        outputDir: 'jwt-decoder',
        outputPath: 'build/jwt-decoder',
        version: '1.0.0'
      })
    ]));
  });
});

describe('detectAffectedTargets', () => {
  it('narrows tool-local runtime changes to the matching tool', () => {
    expect(detectAffectedTargets(['jwt-decoder/script.tsx'])).toEqual({
      scope: 'selected-tools',
      changedFiles: ['jwt-decoder/script.tsx'],
      affectedTools: ['jwt-decoder-tool'],
      includeRootShell: false,
      includeRootAssets: false,
      shouldBuild: true,
      shouldDeploy: true,
      deployPaths: ['jwt-decoder'],
      invalidationPaths: ['/jwt-decoder/', '/jwt-decoder/*']
    });
  });

  it('maps renamed source directories back to their stable tool ids', () => {
    expect(detectAffectedTargets(['data-format-converter/script.tsx'])).toEqual({
      scope: 'selected-tools',
      changedFiles: ['data-format-converter/script.tsx'],
      affectedTools: ['data-format-converter'],
      includeRootShell: false,
      includeRootAssets: false,
      shouldBuild: true,
      shouldDeploy: true,
      deployPaths: ['data-format-converter'],
      invalidationPaths: ['/data-format-converter/', '/data-format-converter/*']
    });
  });

  it('treats tool metadata changes as affecting the tool, root shell, and root assets', () => {
    expect(isToolMetadataPath('jwt-decoder/tool.meta.json')).toBe(true);
    // Production env + a deploy-time AdSense id: ads.txt is part of the
    // deployable root assets only when AdSense is configured (the analytics
    // gate fails closed everywhere else).
    withEnv({ NODE_ENV: 'production', CST_ADSENSE_CLIENT_ID: 'ca-pub-1234567890123456' }, () => {
      expect(detectAffectedTargets(['jwt-builder/tool.meta.json'])).toEqual({
        scope: 'selected-tools',
        changedFiles: ['jwt-builder/tool.meta.json'],
        affectedTools: ['base64-converter-tool', 'jwt-builder-tool', 'jwt-decoder-tool'],
        includeRootShell: true,
        includeRootAssets: true,
        shouldBuild: true,
        shouldDeploy: true,
        deployPaths: ['404.html', 'BingSiteAuth.xml', 'ads.txt', 'apple-touch-icon.png', 'base64-converter', 'favicon.ico', 'favicon.svg', 'fonts/Geist-Variable.woff2', 'fonts/GeistMono-Variable.woff2', 'index.html', 'jwt-builder', 'jwt-decoder', 'llms.txt', 'og-home.png', 'robots.txt', 'root-shell', 'sitemap.xml', 'styles.css'],
        invalidationPaths: ['/', '/404.html', '/BingSiteAuth.xml', '/ads.txt', '/apple-touch-icon.png', '/base64-converter/', '/base64-converter/*', '/favicon.ico', '/favicon.svg', '/fonts/Geist-Variable.woff2', '/fonts/GeistMono-Variable.woff2', '/index.html', '/jwt-builder/', '/jwt-builder/*', '/jwt-decoder/', '/jwt-decoder/*', '/llms.txt', '/og-home.png', '/robots.txt', '/root-shell/', '/root-shell/*', '/sitemap.xml', '/styles.css']
      });
    });
  });

  it('escalates unknown tool metadata paths to an all-tools rebuild so add/remove cases do not drift', () => {
    expect(detectAffectedTargets(['future-tool/tool.meta.json'])).toEqual({
      scope: 'all-tools',
      changedFiles: ['future-tool/tool.meta.json'],
      affectedTools: getToolIds(),
      includeRootShell: true,
      includeRootAssets: true,
      shouldBuild: true,
      shouldDeploy: true,
      deployPaths: expect.arrayContaining(['index.html', 'root-shell', 'styles.css', 'robots.txt', 'sitemap.xml']),
      invalidationPaths: expect.arrayContaining(['/', '/index.html', '/root-shell/', '/root-shell/*', '/styles.css', '/robots.txt', '/sitemap.xml'])
    });
  });

  it('treats shared runtime changes as affecting all tools and root assets', () => {
    const result = detectAffectedTargets(['common/shared-styles.css']);

    expect(result.scope).toBe('all-tools');
    expect(result.affectedTools).toEqual(getToolIds());
    expect(result.includeRootShell).toBe(true);
    expect(result.includeRootAssets).toBe(true);
    expect(result.deployPaths).toEqual(expect.arrayContaining(['root-shell', 'index.html', 'styles.css', 'robots.txt', 'sitemap.xml']));
  });

  it('treats root stylesheet changes as root-only runtime changes', () => {
    withEnv({ NODE_ENV: 'production', CST_ADSENSE_CLIENT_ID: 'ca-pub-1234567890123456' }, () => {
      expect(detectAffectedTargets(['styles.css'])).toEqual({
        scope: 'root-only',
        changedFiles: ['styles.css'],
        affectedTools: [],
        includeRootShell: true,
        includeRootAssets: true,
        shouldBuild: true,
        shouldDeploy: true,
        deployPaths: ['404.html', 'BingSiteAuth.xml', 'ads.txt', 'apple-touch-icon.png', 'favicon.ico', 'favicon.svg', 'fonts/Geist-Variable.woff2', 'fonts/GeistMono-Variable.woff2', 'index.html', 'llms.txt', 'og-home.png', 'robots.txt', 'root-shell', 'sitemap.xml', 'styles.css'],
        invalidationPaths: ['/', '/404.html', '/BingSiteAuth.xml', '/ads.txt', '/apple-touch-icon.png', '/favicon.ico', '/favicon.svg', '/fonts/Geist-Variable.woff2', '/fonts/GeistMono-Variable.woff2', '/index.html', '/llms.txt', '/og-home.png', '/robots.txt', '/root-shell/', '/root-shell/*', '/sitemap.xml', '/styles.css']
      });
    });
  });

  it('treats the generated-site-assets script as a root-only trigger so sitemap/robots/llms.txt redeploy', () => {
    const result = detectAffectedTargets(['scripts/generated-site-assets.js']);

    expect(result.scope).toBe('root-only');
    expect(result.affectedTools).toEqual([]);
    expect(result.includeRootAssets).toBe(true);
    expect(result.shouldBuild).toBe(true);
    expect(result.shouldDeploy).toBe(true);
    expect(result.deployPaths).toEqual(expect.arrayContaining(['llms.txt', 'robots.txt', 'sitemap.xml']));
  });

  it('treats the shared analytics head builder as an all-tools rebuild trigger', () => {
    const result = detectAffectedTargets(['scripts/analytics.js']);

    expect(result.scope).toBe('all-tools');
    expect(result.affectedTools).toEqual(getToolIds());
    expect(result.includeRootShell).toBe(true);
    expect(result.includeRootAssets).toBe(true);
    expect(result.shouldBuild).toBe(true);
    expect(result.shouldDeploy).toBe(true);
  });

  it('treats the 404 document generator as an all-tools rebuild trigger so the root asset redeploys', () => {
    const result = detectAffectedTargets(['scripts/error-document.js']);

    expect(result.scope).toBe('all-tools');
    expect(result.includeRootAssets).toBe(true);
    expect(result.shouldBuild).toBe(true);
    expect(result.shouldDeploy).toBe(true);
  });

  it('treats the per-tool FAQ/HowTo/feature content registries as all-tools rebuild triggers', () => {
    ['scripts/tool-faq-metadata.js', 'scripts/tool-howto-metadata.js', 'scripts/tool-feature-metadata.js'].forEach((filePath) => {
      const result = detectAffectedTargets([filePath]);

      expect(result.scope).toBe('all-tools');
      expect(result.affectedTools).toEqual(getToolIds());
      expect(result.shouldBuild).toBe(true);
      expect(result.shouldDeploy).toBe(true);
    });
  });

  it('treats the related-tools copy and category-slug registries as all-tools rebuild triggers', () => {
    // Both are prerendered into every tool document. Without these triggers a
    // copy-only or accent-only edit is classified as a no-op, so nothing
    // rebuilds and production silently keeps serving the old markup.
    ['scripts/related-tools-metadata.js', 'scripts/tool-categories.js'].forEach((filePath) => {
      const result = detectAffectedTargets([filePath]);

      expect(result.scope).toBe('all-tools');
      expect(result.affectedTools).toEqual(getToolIds());
      expect(result.shouldBuild).toBe(true);
      expect(result.shouldDeploy).toBe(true);
    });
  });

  it('treats the asset deploy script as an all-tools trigger so policy changes reach production', () => {
    // The script stamps Cache-Control on every tool directory and root asset.
    // Without this trigger a header-policy change ships to the repo but never
    // re-uploads anything, so the old headers stay live — a change that looks
    // deployed and is not.
    const result = detectAffectedTargets(['scripts/deploy-affected-assets.js']);

    expect(result.scope).toBe('all-tools');
    expect(result.affectedTools).toEqual(getToolIds());
    expect(result.includeRootAssets).toBe(true);
    expect(result.shouldBuild).toBe(true);
    expect(result.shouldDeploy).toBe(true);
  });

  it('registers every generator input as a trigger for the surface it feeds', () => {
    // Guards the class of bug rather than individual instances of it: any
    // scripts/ module required by a document generator has to be a rebuild
    // trigger, because the failure mode when it is not is silent — the change
    // is classified as a no-op and production keeps serving the old HTML.
    //
    // Tool-document inputs must rebuild every tool; root-document inputs only
    // have to redeploy the root page, so either scope satisfies them.
    const localRequires = (entry) => {
      const source = readFileSync(path.resolve(__dirname, entry), 'utf8');
      return [...source.matchAll(/require\('\.\/([\w-]+)'\)/g)].map((m) => `scripts/${m[1]}.js`);
    };

    const toolInputs = new Set([...localRequires('./prerender-tool.js'), ...localRequires('./tool-document.js')]);
    const rootInputs = new Set(localRequires('./root-document.js'));

    toolInputs.forEach((filePath) => {
      expect({ filePath, triggersAllTools: isAllToolsTrigger(filePath) })
        .toEqual({ filePath, triggersAllTools: true });
    });

    rootInputs.forEach((filePath) => {
      expect({ filePath, triggersRebuild: isAllToolsTrigger(filePath) || isRootOnlyTrigger(filePath) })
        .toEqual({ filePath, triggersRebuild: true });
    });
  });

  it('skips docs-only changes', () => {
    expect(detectAffectedTargets(['README.md', 'jwt-decoder/README.md'])).toEqual({
      scope: 'none',
      changedFiles: ['README.md', 'jwt-decoder/README.md'],
      affectedTools: [],
      includeRootShell: false,
      includeRootAssets: false,
      shouldBuild: false,
      shouldDeploy: false,
      deployPaths: [],
      invalidationPaths: []
    });
  });

  it('surfaces the defensive missing-tool guard when finalizing selected tools', () => {
    jest.resetModules();

    jest.isolateModules(() => {
      jest.doMock('./tool-manifest', () => {
        const actual = jest.requireActual('./tool-manifest');
        return {
          ...actual,
          getToolById: jest.fn((toolId) => {
            if (toolId === 'jwt-decoder-tool') {
              return undefined;
            }

            return actual.getToolById(toolId);
          })
        };
      });

      const { detectAffectedTargets: detectAffectedTargetsWithMissingTool } = require('./affected-tools');

      expect(() => detectAffectedTargetsWithMissingTool(['jwt-decoder/script.tsx']))
        .toThrow('Unknown tool id: jwt-decoder-tool');
    });

    jest.dontMock('./tool-manifest');
    jest.resetModules();
  });

  it('tracks reverse related-tool metadata dependencies', () => {
    expect(buildReverseRelatedToolMap().get('jwt-builder-tool')).toEqual([
      'base64-converter-tool',
      'jwt-decoder-tool'
    ]);
  });
});
