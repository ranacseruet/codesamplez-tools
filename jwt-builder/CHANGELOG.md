# Changelog

All notable changes to this tool are documented in this file.

## [1.0.4] - 2026-09-24

### JWT Builder

- Time claims reject short integers such as a bare year instead of reading them as 1970 timestamps; holding Cmd/Ctrl+Enter no longer repeats.

## [1.0.3] - 2026-09-21

### JWT Builder

- Fixed notification toasts: overlapping shows no longer cut each other short; warning/success/default types render their proper colors; toasts now appear top-right beneath the fixed app bar.

## [1.0.2] - 2026-09-21

### JWT Builder

- The tool's release version (v1.0.2) is now displayed directly under the tool workspace so users can report it in support tickets.

## [1.0.1] - 2026-09-20

### JWT Builder

- Per-tool versioning rollout: every built tool page now stamps <meta name="tool-version"> and the build commit, and the site publishes versions.json for regression triage.

## [1.0.0] - 2026-09-20

### JWT Builder

- Initial tracked release. Earlier history predates per-tool versioning; see the repository CHANGELOG.md and git history.
