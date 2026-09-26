# Changelog

All notable changes to this tool are documented in this file.

## [1.0.6] - 2026-09-26

### Diff Checker

- Housekeeping patch bump for the shared common/Base64Codec fix (unpadded Base64URL acceptance); this tool does not bundle the codec and its behavior is unchanged.

## [1.0.5] - 2026-09-24

### Diff Checker

- Word-level highlights are built from ranges rather than re-parsed markup, so text that looks like a highlight span shows as text; the line-number gutter keeps one width past line 999; a multi-file drop says which file was loaded.

## [1.0.4] - 2026-09-21

### Diff Checker

- Fixed notification toasts: overlapping shows no longer cut each other short; warning/success/default types render their proper colors; toasts now appear top-right beneath the fixed app bar.

## [1.0.3] - 2026-09-21

### Diff Checker

- Fixed: a compare run superseded by a newer one now drops its stale result or error instead of painting 'Error computing diff' over the newer run's output; the compare button is only restored by the current run.

## [1.0.2] - 2026-09-21

### Diff Checker

- The tool's release version (v1.0.2) is now displayed directly under the tool workspace so users can report it in support tickets.

## [1.0.1] - 2026-09-20

### Diff Checker

- Per-tool versioning rollout: every built tool page now stamps <meta name="tool-version"> and the build commit, and the site publishes versions.json for regression triage.

## [1.0.0] - 2026-09-20

### Diff Checker

- Initial tracked release. Earlier history predates per-tool versioning; see the repository CHANGELOG.md and git history.
