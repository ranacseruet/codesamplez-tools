# Changelog

All notable changes to this tool are documented in this file.

## [1.0.4] - 2026-09-24

### Base64 Converter

- Uploads and drops are capped at 25 MB with a clear error; a multi-file drop warns that only the first file was encoded; decoded text downloads as text/plain; file sizes use the shared B/KiB/MB formatter.

## [1.0.3] - 2026-09-21

### Base64 Converter

- Fixed notification toasts: overlapping shows no longer cut each other short; warning/success/default types render their proper colors; toasts now appear top-right beneath the fixed app bar.

## [1.0.2] - 2026-09-21

### Base64 Converter

- The tool's release version (v1.0.2) is now displayed directly under the tool workspace so users can report it in support tickets.

## [1.0.1] - 2026-09-20

### Base64 Converter

- Per-tool versioning rollout: every built tool page now stamps <meta name="tool-version"> and the build commit, and the site publishes versions.json for regression triage.

## [1.0.0] - 2026-09-20

### Base64 Converter

- Initial tracked release. Earlier history predates per-tool versioning; see the repository CHANGELOG.md and git history.
