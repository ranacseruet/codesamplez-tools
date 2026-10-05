# Changelog

All notable changes to this tool are documented in this file.

## [1.0.6] - 2026-09-24

### JSON Formatter

- Error-path stats describe the input that failed, not a later edit; Formatted Size no longer resets to 0 B when formatting right after typing; a schema passing under the Draft 7 fallback warns about Draft 2020-12 keywords it ignored; a multi-file drop says which file was loaded; size labels use the shared formatter.

## [1.0.5] - 2026-09-23

### JSON Formatter

- Preserve valid JSON strings during auto-fix.

## [1.0.4] - 2026-09-21

### JSON Formatter

- Fixed notification toasts: overlapping shows no longer cut each other short; warning/success/default types render their proper colors; toasts now appear top-right beneath the fixed app bar.

## [1.0.3] - 2026-09-21

### JSON Formatter

- Fixed: a formatting run superseded by a newer one (e.g. an indent change while a large worker format is in flight) no longer paints a transient 'Invalid JSON' error over the newer run's output or disables its Copy/Download/Expand/Collapse controls until the newer run completes.

## [1.0.2] - 2026-09-21

### JSON Formatter

- The tool's release version (v1.0.2) is now displayed directly under the tool workspace so users can report it in support tickets.

## [1.0.1] - 2026-09-20

### JSON Formatter

- Per-tool versioning rollout: every built tool page now stamps <meta name="tool-version"> and the build commit, and the site publishes versions.json for regression triage.

## [1.0.0] - 2026-09-20

### JSON Formatter

- Initial tracked release. Earlier history predates per-tool versioning; see the repository CHANGELOG.md and git history.