# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Each tool page displays the tool's release version as a small `v<x.y.z>`
  line directly under the tool workspace, emitted from `tool.meta.json` at
  document build time.
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

- GA4 and AdSense load only when the page hostname matches the host of
  `siteBaseUrl`. A production build served on localhost, `127.0.0.1`, or a
  CloudFront domain does not request analytics or ads.
- Google Analytics and AdSense IDs are no longer committed to
  `config/tooling-root.json`. Deployments inject them via the
  `CST_GA_MEASUREMENT_ID` and `CST_ADSENSE_CLIENT_ID` environment variables, so
  forks and self-hosters never inherit the upstream properties.
- Visual-diff, baseline, and health-monitoring workflows build with
  `CST_DISABLE_ANALYTICS=1` so screenshots stay ad-free and deterministic.

### Fixed

- Dependabot pull requests that change only `package.json` and
  `package-lock.json` pass the tool version-bump gate without a hand-applied
  label. The skip is the `dependabot[bot]` author plus those files.
  `.github/dependabot.yml` does not apply `skip-version-bump`, because that
  label would also skip a later commit that edits a tool file.

### Removed

- Internal planning and infrastructure documentation that is not relevant to
  contributors.
