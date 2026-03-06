# Migration Guide

## Phase 2 local rollout

1. Keep the repo-owned visual config in `.github/visual-regression.json`.
2. Keep app build/start logic in repo workflows.
3. Call the shared actions in `visual-diff-github-action/actions/` for route scoping, capture, compare, staging, and PR reporting.
4. Use the root canary workflow to validate the shared module before switching primary jobs.

After the primary jobs switch over:

1. Keep the canary workflow only as a narrow smoke path for shared action implementation changes.
2. Prefer the primary CI and PR workflows as the real validation signal for repo behavior.

## Promotion path

When this module moves to a dedicated shared repo or to a repository-root workflow namespace:

1. Move the workflow templates from `visual-diff-github-action/.github/workflows/` into a GitHub-recognized `.github/workflows/` location.
2. Version the shared repo or tag the current repo.
3. Update consumer repos to reference the shared actions and reusable workflows by version.

Current status in this repo:

- the primary CI and PR paths call the shared composite actions directly from repo-owned jobs
- repo workflows own startup readiness and pass config and selected route ids into the shared actions
- the canary workflow is intentionally narrowed so unrelated app changes do not keep triggering it
- after primary-path validation is fully complete, the canary workflow should be removed instead of being treated as permanent

## Consumer responsibilities

- install dependencies
- build the app if needed
- start the app locally in CI
- make the app reachable at `baseUrl`
- choose when to invoke the shared actions or workflows
