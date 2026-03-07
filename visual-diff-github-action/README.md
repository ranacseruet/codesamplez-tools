# Reusable Visual Diff GitHub Action

This module contains the shared visual regression implementation for `Node + Playwright` projects.

## What lives here

- `lib/`: shared config, capture, compare, staging, and skipped-summary logic
- `actions/`: cross-repo composite actions for baseline publishing and PR diffs
- `.github/workflows/`: staged reusable workflow templates for later promotion
- `docs/`: contracts and migration notes

## Current status

The primary CI and PR workflows in this repo now use the wrapper actions as the main integration path.

Because GitHub only recognizes reusable workflows from a repository root `.github/workflows/` directory, the workflow files under this module are still staged templates. The composite actions under `actions/` are the current cross-repo integration surface.

## Pilot Integration Guide (Temporary)

This section is pilot-specific documentation for the current cross-repo adoption model.

Clean this section up after the overall reusable visual diff plan is complete and the module is either promoted to a dedicated shared repo or moved into a repository-root reusable workflow location.

### Primary entrypoints

- `actions/publish-visual-baseline`
- `actions/run-visual-pr-diff`

Use these wrapper actions by cross-repo reference:

```yaml
- uses: ranacseruet/codesamplez-tools/visual-diff-github-action/actions/publish-visual-baseline@main
```

Pin to a commit SHA or tag instead of a moving branch when possible.

If this repo is private, enable GitHub Actions access from the consumer repo before testing cross-repo references.

### Consumer responsibilities

Consumer repos still own:

- checkout
- Node setup
- dependency installation
- app build
- app startup
- readiness wait
- app shutdown

The shared layer owns route selection, capture, compare, skipped-summary generation, artifact staging, artifact upload, PR comment publication, and diff-mode enforcement.

### Step 1: Add `.github/visual-regression.json`

Create `.github/visual-regression.json` in the consumer repo and make it the source of truth for route coverage, output paths, and enforcement mode.

Example:

```json
{
  "baselineArtifactName": "ui-foundation-visual-baseline",
  "workingDirectory": ".",
  "baseUrl": "http://127.0.0.1:8080",
  "readyUrl": "http://127.0.0.1:8080",
  "readyTimeoutSeconds": 45,
  "resultsFile": "qa-artifacts/visual-baselines/current/visual-baseline-results.json",
  "manifestFile": "qa-artifacts/visual-baselines/current/visual-screenshot-manifest.json",
  "screenshotsRoot": "qa-artifacts/visual-baselines/current",
  "routes": [
    {
      "id": "root-index-desktop",
      "path": "/",
      "viewport": "desktop"
    },
    {
      "id": "root-index-mobile",
      "path": "/",
      "viewport": "mobile"
    }
  ],
  "diff": {
    "threshold": 0.01,
    "mode": "report-only"
  }
}
```

If you want changed-file scoping, also add the optional `selection` block and per-route `changePaths` entries as shown in this repo's [`visual-regression.json`](/Users/mdaliahsanrana/Work/codesamplez/codesamplez-tools/.github/visual-regression.json).

### Step 2: Publish the baseline artifact from the main CI workflow

In the workflow that runs on `push` to `main`:

1. Check out the repo.
2. Set up Node and install dependencies.
3. Build the app if needed.
4. Start the app locally and wait until `baseUrl` is reachable.
5. Call `publish-visual-baseline`.

Example:

```yaml
- name: Publish main visual baseline
  uses: ranacseruet/codesamplez-tools/visual-diff-github-action/actions/publish-visual-baseline@main
  with:
    repo-config-path: .github/visual-regression.json
    artifact-retention-days: '30'
```

If you already have route selection logic, pass it through `route-ids`. Otherwise the wrapper captures all configured routes.

This repo's current reference implementation lives in [ci.yml](/Users/mdaliahsanrana/Work/codesamplez/codesamplez-tools/.github/workflows/ci.yml).

### Step 3: Add the PR visual diff workflow

The PR workflow must grant write permissions so the action can resolve baseline artifacts from another repo and post PR comments:

```yaml
permissions:
  contents: read
  actions: read
  issues: write
  pull-requests: write
```

`actions: read` is required to download the baseline artifact from the main branch workflow run. `issues: write` and `pull-requests: write` are required to post and update the PR comment. Without these, the action will fail with a 403.

In the PR workflow:

1. Check out the PR head commit.
2. Set up Node and install dependencies.
3. Build and start the app locally.
4. Call `run-visual-pr-diff`.

Example:

```yaml
- name: Run visual PR diff
  uses: ranacseruet/codesamplez-tools/visual-diff-github-action/actions/run-visual-pr-diff@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    repo-config-path: .github/visual-regression.json
```

The wrapper:

- resolves PR scope unless you explicitly pass `route-ids`
- downloads the latest successful `main` baseline artifact
- captures current routes
- writes skipped summaries when scope is irrelevant or the baseline is unavailable
- stages and uploads the diff artifact
- publishes the workflow summary
- comments on the PR by default when a PR number is available
- enforces `diff.mode` only after artifacts and comments are published

Useful overrides:

- `pr-number`: explicit PR number override
- `route-ids`: explicit route override that bypasses changed-file scope detection
- `force-run`: force a full run
- `baseline-repository`: fetch baselines from another repo
- `baseline-workflow-id`: override the publishing workflow id
- `baseline-branch`: override the publishing branch
- `comment-on-pr`: set to `false` to suppress the PR comment

This repo's current reference implementation lives in [pr-visual-diff.yml](/Users/mdaliahsanrana/Work/codesamplez/codesamplez-tools/.github/workflows/pr-visual-diff.yml).

### Advanced usage

The low-level actions remain available for advanced consumers, but they are now secondary building blocks:

- `actions/capture-visual-routes`
- `actions/compare-visual-results`
- `actions/determine-visual-diff-scope`
- `actions/evaluate-visual-diff-outcome`
- `actions/publish-visual-pr-comment`
- `actions/resolve-baseline-artifact`
- `actions/stage-visual-artifacts`

Use the low-level actions only when you need custom orchestration that the wrappers do not provide.

## Diff calculation limitations

The pixel diff engine has the following known limitations:

- **Viewport dimension changes skip diff**: When a PR changes page content such that the captured screenshot dimensions differ from the baseline (e.g., adding or removing sections that change page height), pixel-level comparison is skipped for that route. These are reported as "dimension changes" in the summary, not as errors. The recommended workflow is to merge the PR and let the main CI re-capture the baseline with the new dimensions.
- **Full-page capture dependency**: Screenshot dimensions depend on the full rendered page height at capture time. Any layout change that affects the document height — even outside the visually changed area — will trigger a dimension mismatch for that route.
- **No sub-region diffing**: The engine compares entire screenshots pixel-by-pixel. There is no support for cropping or masking specific regions before comparison.
- **Fixed viewport presets only**: v1 supports only `desktop` (1440x900) and `mobile` (390x844) presets. Custom viewport sizes are not supported.
- **Single threshold per config**: The mismatch threshold (`diff.threshold`) applies uniformly to all routes. Per-route thresholds are not supported in v1.

## Repo contract

Consumer repos provide `.github/visual-regression.json` and keep repo-specific app build/start logic outside the shared visual pipeline.

See [docs/contracts.md](/Users/mdaliahsanrana/Work/codesamplez/codesamplez-tools/visual-diff-github-action/docs/contracts.md) for the exact file contracts and [docs/migration-guide.md](/Users/mdaliahsanrana/Work/codesamplez/codesamplez-tools/visual-diff-github-action/docs/migration-guide.md) for the wrapper-first rollout path.
