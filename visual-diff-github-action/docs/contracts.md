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

## Diff summary shape

The `visual-diff-summary.json` includes:

- `status`: `clean`, `changes-detected`, `incomplete`, or `skipped`
- `selectedRoutes`: list of route ids included in the run
- `totalScreenshots`, `matchedScreenshots`, `changedScreenshots`
- `missingInBaseline`, `missingInCurrent`
- `changed[]`: changed screenshot details with `mismatchRatio`, `differentPixels`, `totalPixels`
- `missing[]`: missing screenshot entries with `location` and `reason`
- `errors[]`: comparison errors with `message`
- `dimensionChanges[]`: routes where baseline and current viewport dimensions differ (pixel diff is skipped for these)
- `baselineArtifactName`, `baselineSourceSha`: provenance metadata (optional)
- `diffMode`, `threshold`: enforcement config echoed from repo config

## Diff semantics

- screenshots are matched by `id`
- mismatch ratio is `different_pixels / total_pixels`
- viewport dimension mismatches (different width or height between baseline and current) skip pixel diff and are recorded in `dimensionChanges[]` with status `incomplete`
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
