const { getToolDefinitions, getToolIds, parseToolSelectionArgs } = require('./tool-manifest');
const { detectAffectedTargets } = require('./affected-tools');

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

  it('treats shared runtime changes as affecting all tools and root assets', () => {
    const result = detectAffectedTargets(['common/shared-styles.css']);

    expect(result.scope).toBe('all-tools');
    expect(result.affectedTools).toEqual(getToolIds());
    expect(result.includeRootShell).toBe(true);
    expect(result.includeRootAssets).toBe(true);
    expect(result.deployPaths).toEqual(expect.arrayContaining(['root-shell', 'index.html', 'styles.css', 'robots.txt']));
  });

  it('treats landing-page changes as root-only runtime changes', () => {
    expect(detectAffectedTargets(['index.html'])).toEqual({
      scope: 'root-only',
      changedFiles: ['index.html'],
      affectedTools: [],
      includeRootShell: true,
      includeRootAssets: true,
      shouldBuild: true,
      shouldDeploy: true,
      deployPaths: ['index.html', 'robots.txt', 'root-shell', 'styles.css'],
      invalidationPaths: ['/', '/index.html', '/robots.txt', '/root-shell/', '/root-shell/*', '/styles.css']
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
});
