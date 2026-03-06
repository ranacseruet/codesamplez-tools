# Reusable Visual Diff GitHub Action

This module contains the extracted shared visual regression implementation for `Node + Playwright` projects.

## What lives here

- `lib/`: shared config, capture, and compare logic
- `actions/`: composite actions that wrap the shared logic and standardize inputs and outputs
- `.github/workflows/`: reusable workflow templates prepared for promotion into a dedicated shared repo or repo-root workflow namespace
- `docs/`: contracts and migration notes

## Current status

The primary CI and PR workflows in this repo now call the shared actions directly from repo-owned jobs.

Because GitHub only recognizes reusable workflows from a repository root `.github/workflows/` directory, the workflow files under this module are staged templates for extraction and promotion. The shared actions under `actions/` are fully runnable in-place from this repo.

## Shared actions

- `actions/capture-visual-routes`
- `actions/compare-visual-results`
- `actions/determine-visual-diff-scope`
- `actions/resolve-baseline-artifact`
- `actions/stage-visual-artifacts`
- `actions/publish-visual-pr-comment`
- `actions/evaluate-visual-diff-outcome`

## Repo contract

Consumer repos provide `.github/visual-regression.json` and keep repo-specific app build/start logic outside the shared capture/compare implementation.

See [docs/contracts.md](/Users/mdaliahsanrana/Work/codesamplez/codesamplez-tools/visual-diff-github-action/docs/contracts.md) for the exact file contracts and [docs/migration-guide.md](/Users/mdaliahsanrana/Work/codesamplez/codesamplez-tools/visual-diff-github-action/docs/migration-guide.md) for the rollout path.
