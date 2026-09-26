# Changelog

All notable changes to this tool are documented in this file.

## [1.0.5] - 2026-09-26

### JSON Editor

- Housekeeping patch bump for the shared common/Base64Codec fix (unpadded Base64URL acceptance); this tool does not bundle the codec and its behavior is unchanged.

## [1.0.4] - 2026-09-24

### JSON Editor

- Holding Cmd/Ctrl+Enter runs the primary action once instead of repeating.

## [1.0.3] - 2026-09-21

### JSON Editor

- Fixed notification toasts: overlapping shows no longer cut each other short; warning/success/default types render their proper colors; toasts now appear top-right beneath the fixed app bar.

## [1.0.2] - 2026-09-21

### JSON Editor

- The tool's release version (v1.0.2) is now displayed directly under the tool workspace so users can report it in support tickets.

## [1.0.1] - 2026-09-20

### JSON Editor

- Per-tool versioning rollout: every built tool page now stamps <meta name="tool-version"> and the build commit, and the site publishes versions.json for regression triage.

## [1.0.0] - 2026-09-20

### JSON Editor

- Initial tracked release. Earlier history predates per-tool versioning; see the repository CHANGELOG.md and git history.
