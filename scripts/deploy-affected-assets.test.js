const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { getRootAssets } = require('./tool-manifest');

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

  it('syncs the tool directory in one pass and stamps cache headers', () => {
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
    // Single sync (with --delete) keeps HTML and its sibling JS/CSS in lockstep,
    // tagged with the directory-level (bundle) cache policy. That policy must
    // make the browser revalidate: the filenames are not content-hashed and the
    // HTML is must-revalidate, so a browser max-age here serves new HTML against
    // old CSS/JS. `s-maxage` keeps the edge caching so revalidation costs a 304.
    expect(result.stdout).toContain(`[dry-run] aws s3 sync ${path.join(tempDir, 'jwt-decoder')}/ s3://tools.codesamplez.com/jwt-decoder/ --delete --cache-control public, max-age=0, must-revalidate, s-maxage=86400`);
    expect(result.stdout).not.toContain('--exclude *.html');
    // HTML is then re-stamped with the must-revalidate policy so navigations
    // always reflect the newest deploy.
    expect(result.stdout).toContain(`[dry-run] aws s3 cp ${path.join(tempDir, 'jwt-decoder', 'index.html')} s3://tools.codesamplez.com/jwt-decoder/index.html --content-type text/html --cache-control public, max-age=0, must-revalidate`);
    expect(result.stdout).toContain('[dry-run] aws cloudfront create-invalidation --distribution-id DIST123 --paths /jwt-decoder/*');
  });

  it('stamps root-level JS/CSS so the browser revalidates them too', () => {
    // Root assets go through the per-extension policy rather than the directory
    // one. They have the same un-hashed-filename problem, so the two paths must
    // agree — otherwise the landing page reintroduces the mismatch this guards.
    createToolBuild(tempDir, 'jwt-decoder');
    // The deploy asserts every configured root asset exists, so build the
    // fixture from the manifest rather than a hand-listed subset.
    getRootAssets().forEach((asset) => {
      const assetPath = path.join(tempDir, asset);
      fs.mkdirSync(path.dirname(assetPath), { recursive: true });
      fs.writeFileSync(assetPath, 'x');
    });
    fs.mkdirSync(path.join(tempDir, 'root-shell'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'root-shell', 'index.html'), '<!doctype html>');
    fs.writeFileSync(path.join(tempDir, 'index.html'), '<!doctype html><title>Index</title>');

    const result = spawnSync(process.execPath, [
      SCRIPT_PATH,
      '--bucket', 'tools.codesamplez.com',
      '--distribution-id', 'DIST123',
      '--build-dir', tempDir,
      '--include-root-assets',
      '--dry-run'
    ], {
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('styles.css s3://tools.codesamplez.com/styles.css --cache-control public, max-age=0, must-revalidate, s-maxage=86400');
    // Fonts keep their immutable policy — their filenames really never change.
    expect(result.stdout).not.toContain('styles.css --cache-control public, max-age=86400');
  });
});
