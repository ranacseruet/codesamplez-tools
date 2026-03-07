# Migration Guide

## Quick start

1. Add `.github/visual-regression.json` to your repo (see [contracts](contracts.md) for the schema).
2. In your main CI workflow, call `publish-visual-baseline` after starting the app.
3. In your PR workflow, call `run-visual-pr-diff` after starting the app.

That's it. The shared layer handles capture, compare, artifact staging, PR comments, and enforcement.

## Step-by-step

### 1. Create the config file

Create `.github/visual-regression.json` in your repo:

```json
{
  "baselineArtifactName": "my-app-visual-baseline",
  "workingDirectory": ".",
  "baseUrl": "http://127.0.0.1:3000",
  "readyUrl": "http://127.0.0.1:3000",
  "readyTimeoutSeconds": 45,
  "resultsFile": "qa-artifacts/visual-baselines/current/visual-baseline-results.json",
  "manifestFile": "qa-artifacts/visual-baselines/current/visual-screenshot-manifest.json",
  "screenshotsRoot": "qa-artifacts/visual-baselines/current",
  "routes": [
    { "id": "home-desktop", "path": "/", "viewport": "desktop" },
    { "id": "home-mobile", "path": "/", "viewport": "mobile" }
  ],
  "diff": {
    "threshold": 0.01,
    "mode": "report-only"
  }
}
```

Key decisions:
- Set `baselineArtifactName` to something unique per project.
- Set `baseUrl` to the local address your app will be reachable at in CI.
- Start with `report-only` mode and switch to `fail-on-changes` or `strict` once you're confident.
- Add routes for every page you want to capture, in both `desktop` and `mobile` viewports.

### 2. Publish the baseline from your main CI workflow

In the workflow that runs on `push` to `main`:

```yaml
jobs:
  visual-baseline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - run: npm run build

      - name: Start app
        run: |
          npm start &
          for i in $(seq 1 45); do
            curl -sf http://127.0.0.1:3000 && break || sleep 1
          done

      - name: Publish visual baseline
        uses: user/visual-diff-github-action/actions/publish-visual-baseline@v1
        with:
          repo-config-path: .github/visual-regression.json
          artifact-retention-days: '30'
```

Pin to a commit SHA or tag (e.g., `@v1`) instead of a moving branch for stability.

### 3. Add the PR visual diff workflow

Create `.github/workflows/pr-visual-diff.yml`:

```yaml
name: PR Visual Diff

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  actions: read
  issues: write
  pull-requests: write

jobs:
  visual-diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - run: npm run build

      - name: Start app
        run: |
          npm start &
          for i in $(seq 1 45); do
            curl -sf http://127.0.0.1:3000 && break || sleep 1
          done

      - name: Run visual PR diff
        uses: user/visual-diff-github-action/actions/run-visual-pr-diff@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          repo-config-path: .github/visual-regression.json
```

**Required permissions:**
- `actions: read` — to download the baseline artifact from the main branch workflow run.
- `issues: write` and `pull-requests: write` — to post and update the PR comment.

### 4. Optional: add changed-file scoping

To skip visual diff when only unrelated files change, add `selection` and `changePaths`:

```json
{
  "selection": {
    "sharedPrefixes": ["src/common/", "public/"],
    "sharedExact": ["package.json", "styles.css"]
  },
  "routes": [
    {
      "id": "about-desktop",
      "path": "/about/",
      "viewport": "desktop",
      "changePaths": ["src/about/"]
    }
  ]
}
```

- `selection.sharedPrefixes`/`sharedExact`: changes to these files trigger all routes.
- `changePaths` on a route: changes under these prefixes trigger only that route.

### 5. Optional: monorepo with non-root working directory

Set `workingDirectory` to the app subdirectory:

```json
{
  "workingDirectory": "apps/marketing",
  "baseUrl": "http://127.0.0.1:3100",
  "readyUrl": "http://127.0.0.1:3100"
}
```

All relative paths (`resultsFile`, `manifestFile`, `screenshotsRoot`) resolve from `workingDirectory`.

## Consumer responsibilities

Your repo owns:
- Checkout
- Node setup and dependency installation
- App build
- App startup and readiness wait
- App shutdown

The shared layer owns:
- Route selection and scope detection
- Screenshot capture (Playwright)
- Pixel-level comparison
- Summary and markdown generation
- Artifact staging and upload
- PR comment publication
- Enforcement mode evaluation

## Switching enforcement modes

1. Start with `report-only` to capture baselines and see diffs without failing builds.
2. Once baselines are stable, switch to `fail-on-changes` to catch regressions.
3. Use `strict` to also fail on missing screenshots and dimension changes.

## Upgrading

When the module moves to a dedicated repo or cuts a new version:

1. Update the `uses:` reference in your workflow to the new repo/tag.
2. Check the [CHANGELOG](../CHANGELOG.md) for any contract changes.
3. No changes to `.github/visual-regression.json` should be needed for minor versions.

## Troubleshooting

**"No non-expired visual baseline artifact was found"**
- The main CI workflow hasn't run successfully yet, or the artifact has expired.
- Run the main CI workflow on `main` and wait for it to complete.

**403 when posting PR comments**
- Add `issues: write` and `pull-requests: write` permissions to the PR workflow.

**Screenshots have different dimensions**
- This is expected when layout changes affect page height. The diff is recorded as a "dimension change" and pixel comparison is skipped.
- Merge the PR and let the main CI re-capture the baseline with the new dimensions.
