# Migration Guide

## Current rollout path

1. Keep the repo-owned visual config in `.github/visual-regression.json`.
2. Keep app build/start logic in repo workflows.
3. Use `actions/publish-visual-baseline` for the main baseline-publish path.
4. Use `actions/run-visual-pr-diff` for the PR diff path.
5. Use the low-level actions only for advanced custom orchestration.
6. Validate the primary CI and PR paths directly once the repo switches over.

## Promotion path

When this module moves to a dedicated shared repo or to a repository-root workflow namespace:

1. Move the workflow templates from `visual-diff-github-action/.github/workflows/` into a GitHub-recognized `.github/workflows/` location.
2. Version the shared repo or tag the current repo.
3. Update consumer repos to reference the shared actions and reusable workflows by version.

Current status in this repo:

- the primary CI path calls `publish-visual-baseline`
- the primary PR path calls `run-visual-pr-diff`
- repo workflows still own startup readiness and app lifecycle
- the temporary canary path used during rollout has been removed after primary-path validation

## Consumer responsibilities

- install dependencies
- build the app if needed
- start the app locally in CI
- make the app reachable at `baseUrl`
- choose when to invoke the wrapper actions or staged workflows
