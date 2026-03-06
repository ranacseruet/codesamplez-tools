# Migration Guide

## Phase 2 local rollout

1. Keep the repo-owned visual config in `.github/visual-regression.json`.
2. Keep app build/start logic in repo workflows.
3. Call the shared actions in `visual-diff-github-action/actions/`.
4. Use the root canary workflow to validate the shared module before switching primary jobs.

## Promotion path

When this module moves to a dedicated shared repo or to a repository-root workflow namespace:

1. Move the workflow templates from `visual-diff-github-action/.github/workflows/` into a GitHub-recognized `.github/workflows/` location.
2. Version the shared repo or tag the current repo.
3. Update consumer repos to reference the shared actions and reusable workflows by version.

## Consumer responsibilities

- install dependencies
- build the app if needed
- start the app locally in CI
- make the app reachable at `baseUrl`
- choose when to invoke the shared actions or workflows
