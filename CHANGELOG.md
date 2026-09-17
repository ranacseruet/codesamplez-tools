# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
