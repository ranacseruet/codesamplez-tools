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
        sourceRoot: 'jwt-decoder-tool',
        outputPath: 'build/jwt-decoder-tool',
        version: '1.0.0'
      })
    ]));
  });
});

describe('detectAffectedTargets', () => {
  it('narrows tool-local runtime changes to the matching tool', () => {
    expect(detectAffectedTargets(['jwt-decoder-tool/script.tsx'])).toEqual({
      scope: 'selected-tools',
      changedFiles: ['jwt-decoder-tool/script.tsx'],
      affectedTools: ['jwt-decoder-tool'],
      includeRootShell: false,
      includeRootAssets: false,
      shouldBuild: true,
      shouldDeploy: true,
      deployPaths: ['jwt-decoder-tool'],
      invalidationPaths: ['/jwt-decoder-tool/', '/jwt-decoder-tool/*']
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
    expect(detectAffectedTargets(['README.md', 'jwt-decoder-tool/README.md'])).toEqual({
      scope: 'none',
      changedFiles: ['README.md', 'jwt-decoder-tool/README.md'],
      affectedTools: [],
      includeRootShell: false,
      includeRootAssets: false,
      shouldBuild: false,
      shouldDeploy: false,
      deployPaths: [],
      invalidationPaths: []
    });
  });
});
