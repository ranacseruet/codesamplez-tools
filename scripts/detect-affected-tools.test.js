const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT_PATH = path.join(__dirname, 'detect-affected-tools.js');
// All-zero base is what GitHub passes as `github.event.before` on the first push
// to a branch (and on any push to a rewritten history).
const ZERO_SHA = '0000000000000000000000000000000000000000';

function runGit(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function initRepoWithSingleCommit() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cst-detect-affected-'));
  runGit(repoDir, ['init', '--quiet']);
  runGit(repoDir, ['config', 'user.email', 'test@example.com']);
  runGit(repoDir, ['config', 'user.name', 'Test']);
  runGit(repoDir, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(repoDir, 'README.md'), '# test\n');
  // A shared-runtime file so a full build is distinguishable from a doc-only
  // diff (README.md alone would classify as a no-op in both cases).
  fs.mkdirSync(path.join(repoDir, 'common'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'common', 'shared.ts'), 'export const x = 1;\n');
  runGit(repoDir, ['add', '.']);
  runGit(repoDir, ['commit', '--quiet', '-m', 'Initial commit']);
  return repoDir;
}

function detect(repoDir, base) {
  return spawnSync(process.execPath, [
    SCRIPT_PATH,
    '--base', base,
    '--head', 'HEAD',
    '--format', 'plain'
  ], {
    cwd: repoDir,
    encoding: 'utf8'
  });
}

describe('detect-affected-tools', () => {
  let repoDir;

  afterEach(() => {
    if (repoDir) {
      fs.rmSync(repoDir, { recursive: true, force: true });
      repoDir = null;
    }
  });

  it('does not crash when an all-zero base has no resolvable parent', () => {
    // A rewritten / single-commit history has no HEAD^, so the previous
    // `git rev-parse HEAD^` lookup failed and took CI down with it. The
    // fallback reports every tracked file as changed (a full build) instead.
    repoDir = initRepoWithSingleCommit();

    const result = detect(repoDir, ZERO_SHA);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('scope=');
  });

  it('still resolves the parent commit when an all-zero base does have one', () => {
    repoDir = initRepoWithSingleCommit();
    // Second commit only adds a tool README, so the diff is doc-only (a no-op
    // build) — proving the parent was diffed rather than the whole tree.
    fs.mkdirSync(path.join(repoDir, 'jwt-decoder'));
    fs.writeFileSync(path.join(repoDir, 'jwt-decoder', 'README.md'), '# docs\n');
    runGit(repoDir, ['add', '.']);
    runGit(repoDir, ['commit', '--quiet', '-m', 'Add docs']);

    const result = detect(repoDir, ZERO_SHA);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('scope=none');
  });

  it('falls back to a full build when the base commit is not reachable', () => {
    // A force-push reports the pre-rewrite tip as `before`; that commit is gone
    // from the runner's history, so the diff must not be attempted blindly.
    repoDir = initRepoWithSingleCommit();

    const result = detect(repoDir, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef');

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('scope=');
  });

  it('does a full build when the base is not an ancestor of head (force-push)', () => {
    // Rewriting history makes `before` a sibling, not an ancestor. Diffing the
    // two would report a partial set, and whether the old object is even
    // fetchable differs per job — which once made test-and-build skip the build
    // while deploy demanded artifacts that were never produced.
    repoDir = initRepoWithSingleCommit();
    const oldTip = runGit(repoDir, ['rev-parse', 'HEAD']);

    // Rewrite the single commit: amend it, so HEAD and oldTip share no ancestry.
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# rewritten\n');
    runGit(repoDir, ['add', '.']);
    runGit(repoDir, ['commit', '--quiet', '--amend', '-m', 'Initial commit']);

    const result = detect(repoDir, oldTip);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    // Full build: README.md is reported even though the amend only touched it.
    expect(result.stdout).toContain('scope=all-tools');
  });
});
