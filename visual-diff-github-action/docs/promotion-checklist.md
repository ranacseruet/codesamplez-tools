# Repo Promotion Checklist

Step-by-step guide for extracting `visual-diff-github-action` from the `codesamplez-tools` monorepo into its own standalone GitHub repository.

---

## Pre-extraction (in `codesamplez-tools`)

Before touching the new repo, verify the module is in a clean, shippable state.

- [ ] All tests pass: `npm test --prefix visual-diff-github-action`
- [ ] No parent-directory escapes: no `../../` references in `lib/`, `tests/`, or `actions/`
- [ ] Template workflow paths use `./actions/...` (not `./visual-diff-github-action/actions/...`)
- [ ] `CHANGELOG.md` is up to date with anything notable since v1.0.0

---

## Step 1 — Create the new GitHub repo

- [ ] Create `<org>/visual-diff-github-action` on GitHub
- [ ] Set description: `Shared visual regression capture, compare, and reporting for GitHub Actions workflows`
- [ ] Add topics: `github-actions`, `visual-regression`, `playwright`, `screenshot-testing`, `visual-diff`
- [ ] Default branch: `main`
- [ ] Visibility: set to match intended audience (public for cross-org use)
- [ ] Disable "Projects" and "Wiki" unless needed; keep "Issues" enabled

---

## Step 2 — Extract the directory

Preserve git history by using `git subtree`:

```bash
# From the codesamplez-tools repo root
git subtree split --prefix visual-diff-github-action -b visual-diff-standalone

# In the new repo
git init
git pull /path/to/codesamplez-tools visual-diff-standalone
git remote add origin https://github.com/<org>/visual-diff-github-action.git
git push -u origin main
```

Alternatively, copy the directory contents directly and start fresh with an initial commit if history is not required.

---

## Step 3 — Update placeholders in the new repo

All `user/visual-diff-github-action` placeholders need to be replaced with the real `<org>/visual-diff-github-action`.

- [ ] `package.json` — `repository.url`, `homepage`, `bugs.url`
- [ ] `CONTRIBUTING.md` — `git clone` URL
- [ ] `README.md` — all `uses: user/visual-diff-github-action/actions/...@v1` references
- [ ] `SECURITY.md` — verify security contact email is correct

---

## Step 4 — Tidy up internal CI in the new repo

Minor inconsistencies noted during audit that are worth fixing at promotion time:

- [ ] `visual-diff-github-action/.github/workflows/ci.yml`: remove `--passWithNoTests` from the test step (tests exist, the flag is misleading)
- [ ] `visual-diff-github-action/.github/workflows/ci.yml`: align test command — use `npm test` instead of `NODE_OPTIONS='--experimental-vm-modules' npx jest` directly, since the `package.json` `test` script already sets `NODE_OPTIONS`

---

## Step 5 — GitHub repo settings

- [ ] Branch protection on `main`:
  - Require pull request before merging
  - Require status checks to pass (CI job)
  - Dismiss stale reviews on new pushes
- [ ] Allow GitHub Actions to create and approve pull requests: off (unless needed for automation)
- [ ] Add `CODEOWNERS` if multiple maintainers are expected
- [ ] Confirm Actions are enabled and the internal `ci.yml` runs on the first push

---

## Step 6 — Cut the v1 tag and release

- [ ] `git tag v1 && git push origin v1`
- [ ] Create a GitHub Release from the `v1` tag
- [ ] Use `CHANGELOG.md` v1.0.0 entry as the release notes body

---

## Step 7 — Update the consumer (`codesamplez-tools`)

With the new repo live and tagged, update every reference in `codesamplez-tools`.

### Workflow files — update `uses:` paths

| File | Old path | New path |
|:-----|:---------|:---------|
| `.github/workflows/ci.yml` | `./visual-diff-github-action/actions/publish-visual-baseline` | `<org>/visual-diff-github-action/actions/publish-visual-baseline@v1` |
| `.github/workflows/pr-visual-diff.yml` | `./visual-diff-github-action/actions/run-visual-pr-diff` | `<org>/visual-diff-github-action/actions/run-visual-pr-diff@v1` |
| `.github/workflows/health-monitoring.yml` | `./visual-diff-github-action/actions/publish-visual-baseline` | `<org>/visual-diff-github-action/actions/publish-visual-baseline@v1` |

### CI step — remove the local test run

In `.github/workflows/ci.yml`, remove:

```yaml
- name: Run shared visual diff action tests
  run: npm test --prefix visual-diff-github-action
```

### `package.json` — remove the ignore pattern

Remove `/visual-diff-github-action/` from `jest.testPathIgnorePatterns` (it becomes a no-op once the directory is gone, but clean it up).

### `tsconfig.json` — remove the include glob

Remove `"visual-diff-github-action/**/*.mjs"` from the `include` array.

### Delete the directory

```bash
git rm -r visual-diff-github-action/
git commit -m "Remove visual-diff-github-action: promoted to <org>/visual-diff-github-action"
```

---

## Step 8 — Validate end-to-end

- [ ] Push the consumer changes and verify `ci.yml` passes on `main`
- [ ] Open a test PR in `codesamplez-tools` and confirm the `pr-visual-diff.yml` workflow runs, resolves the baseline, and posts a PR comment
- [ ] Verify the scheduled `health-monitoring.yml` baseline capture step succeeds (or trigger it manually via `workflow_dispatch`)

---

## Post-promotion

- [ ] Update `docs/reusable-visual-diff-actions-plan.md` in `codesamplez-tools` to mark the promotion item as complete
- [ ] Archive or close any open issues/branches in `codesamplez-tools` that were specific to the local module phase
- [ ] Pin the `uses:` references in consumer workflows to a commit SHA (recommended for supply-chain safety) rather than a mutable `@v1` tag, once the initial wiring is confirmed working
