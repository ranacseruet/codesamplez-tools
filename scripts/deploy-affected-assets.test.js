const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT_PATH = path.join(__dirname, 'deploy-affected-assets.js');

function createToolBuild(buildDir, outputDir) {
  const toolDir = path.join(buildDir, outputDir);
  fs.mkdirSync(toolDir, { recursive: true });
  fs.writeFileSync(path.join(toolDir, 'index.html'), '<!doctype html><title>Tool</title>');
  fs.writeFileSync(path.join(toolDir, 'bundle.main.js'), 'console.log("tool");');
}

describe('deploy-affected-assets', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesamplez-deploy-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('syncs tool HTML with other tool assets instead of copying it separately', () => {
    createToolBuild(tempDir, 'jwt-decoder');

    const result = spawnSync(process.execPath, [
      SCRIPT_PATH,
      '--bucket', 'tools.codesamplez.com',
      '--distribution-id', 'DIST123',
      '--build-dir', tempDir,
      '--tool', 'jwt-decoder-tool',
      '--dry-run'
    ], {
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain(`[dry-run] aws s3 sync ${path.join(tempDir, 'jwt-decoder')}/ s3://tools.codesamplez.com/jwt-decoder/ --delete`);
    expect(result.stdout).not.toContain('--exclude *.html');
    expect(result.stdout).not.toContain(`aws s3 cp ${path.join(tempDir, 'jwt-decoder', 'index.html')}`);
    expect(result.stdout).toContain('[dry-run] aws cloudfront create-invalidation --distribution-id DIST123 --paths /jwt-decoder/*');
  });
});
