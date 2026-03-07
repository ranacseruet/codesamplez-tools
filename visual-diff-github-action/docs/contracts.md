# Contracts

## Config

The shared layer reads runtime visual regression behavior from `.github/visual-regression.json`.

Required fields:

- `workingDirectory`
- `baseUrl`
- `readyUrl`
- `readyTimeoutSeconds`
- `baselineArtifactName`
- `resultsFile`
- `manifestFile`
- `screenshotsRoot`
- `routes[]`
- `diff.threshold`
- `diff.mode`

Each route entry includes:

- `id`
- `path`
- `viewport`

Repo-local changed-file scoping metadata such as `selection` and `changePaths` is optional and not part of the shared capture/compare contract.

## Baseline artifact

The baseline artifact bundle contains:

- `visual-baseline-results.json`
- `visual-screenshot-manifest.json`
- `screenshots/*.png`

## PR diff artifact

The diff artifact bundle contains:

- `visual-diff-summary.json`
- `visual-diff-summary.md`
- `baseline-results.json`
- `current-results.json`
- `baseline-screenshot-manifest.json`
- `current-screenshot-manifest.json`
- `baseline-screenshots/*.png`
- `current-screenshots/*.png`

## Diff semantics

- screenshots are matched by `id`
- mismatch ratio is `different_pixels / total_pixels`
- dimension mismatches are incomplete comparison errors
- missing screenshots are counted separately from changed screenshots
- `diff.mode` controls enforcement, not summary generation

## Wrapper entrypoints

Primary integration path:

- `actions/publish-visual-baseline`
- `actions/run-visual-pr-diff`

The lower-level actions remain available for advanced consumers, but new consumers should prefer the wrapper actions.

## Skipped diff summaries

When a PR diff is intentionally skipped, the summary remains a partial `visual-diff-summary.json` with:

- `status`
- `reason`
- `message`
- `selectedRoutes`

Missing-baseline skips may also include:

- `baselineAvailable`
- `currentResultsPath`
