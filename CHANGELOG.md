# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Tool footers show the tool's release version as a `v<x.y.z>` badge, rendered
  from the app-shell catalog so prerendered and hydrated markup cannot drift.
- Per-tool versioning: each tool's semver lives in its `tool.meta.json`, is
  stamped into built pages (`<meta name="tool-version">`,
  `data-build-commit` on `<html>`), and is published site-wide in
  `versions.json` for regression triage.
- `npm run tool:version:note` records release notes in `<tool>/CHANGELOG.md`;
  `npm run tool:tag-release` now refuses to tag a version without a changelog
  entry.
- CI fails PRs whose tool runtime changes ship without a version bump
  (`skip-version-bump` label skips the check for docs/CI-only PRs).
- Open-source project documentation: contributing guidelines, security policy,
  support guidelines, and a contributor covenant code of conduct.
- `.editorconfig`, `CODEOWNERS`, and this changelog.

### Changed

- Google Analytics and AdSense IDs are no longer committed to
  `config/tooling-root.json`. Deployments inject them via the
  `CST_GA_MEASUREMENT_ID` and `CST_ADSENSE_CLIENT_ID` environment variables, so
  forks and self-hosters never inherit the upstream properties.
- Visual-diff, baseline, and health-monitoring workflows build with
  `CST_DISABLE_ANALYTICS=1` so screenshots stay ad-free and deterministic.

### Removed

- Internal planning and infrastructure documentation that is not relevant to
  contributors.
