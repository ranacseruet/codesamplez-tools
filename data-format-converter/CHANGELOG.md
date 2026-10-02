# Changelog

All notable changes to this tool are documented in this file.

## [1.0.7] - 2026-09-26

### Data Format Converter

- Housekeeping patch bump for the shared common/Base64Codec fix (unpadded Base64URL acceptance); this tool does not bundle the codec and its behavior is unchanged.

## [1.0.6] - 2026-09-26

### Data Format Converter

- XML attributes no longer gain a stray `_` on XML→JSON→XML round-trips (builder prefix now matches the parsers' `@_`).
- Converting nested objects/arrays to properties flattens them with dot-separated paths (`db.host=localhost`, `items.0=a`) instead of destroying values as `[object Object]`; `null` values render as empty.
- Auto-detection no longer misreads a properties file as YAML just because a value contains `: ` (e.g. `greeting=Hello: World`), nor a YAML file as properties just because of environment-list lines (`- NODE_ENV=production`); comment lines are ignored during detection. Root-level arrays flatten without a leading dot (`0=apple`, not `.0=apple`).

## [1.0.5] - 2026-09-24

### Data Format Converter

- A multi-file drop says which file was loaded and how many were ignored.

## [1.0.4] - 2026-09-24

### Data Format Converter

- Round-trip carriage returns and form-feeds, and decode Java Unicode escapes in properties files.

## [1.0.3] - 2026-09-21

### Data Format Converter

- Fixed notification toasts: overlapping shows no longer cut each other short; warning/success/default types render their proper colors; toasts now appear top-right beneath the fixed app bar.

## [1.0.2] - 2026-09-21

### Data Format Converter

- The tool's release version (v1.0.2) is now displayed directly under the tool workspace so users can report it in support tickets.

## [1.0.1] - 2026-09-20

### Data Format Converter

- Per-tool versioning rollout: every built tool page now stamps <meta name="tool-version"> and the build commit, and the site publishes versions.json for regression triage.

## [1.0.0] - 2026-09-20

### Data Format Converter

- Initial tracked release. Earlier history predates per-tool versioning; see the repository CHANGELOG.md and git history.
