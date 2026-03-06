# Migration Guide

## Phase 2 local rollout

1. Keep the repo-owned visual config in `.github/visual-regression.json`.
2. Keep app build/start logic in repo workflows.
3. Call the shared actions in `visual-diff-github-action/actions/` for route scoping, capture, compare, staging, and PR reporting.
4. Validate the primary CI and PR paths directly once the repo switches over.

## Promotion path

When this module moves to a dedicated shared repo or to a repository-root workflow namespace:

1. Move the workflow templates from `visual-diff-github-action/.github/workflows/` into a GitHub-recognized `.github/workflows/` location.
2. Version the shared repo or tag the current repo.
3. Update consumer repos to reference the shared actions and reusable workflows by version.

Current status in this repo:

- the primary CI and PR paths call the shared composite actions directly from repo-owned jobs
- repo workflows own startup readiness and pass config and selected route ids into the shared actions
- the temporary canary path used during rollout has been removed after primary-path validation

## Consumer responsibilities

- install dependencies
- build the app if needed
- start the app locally in CI
- make the app reachable at `baseUrl`
- choose when to invoke the shared actions or workflows
