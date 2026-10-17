# Changelog

All notable changes to this tool are documented in this file.

## [1.0.10] - 2026-10-17

### Image Editor

- Shortened the meta description so it stays within search-result snippet limits while keeping the local, private processing message.

## [1.0.9] - 2026-10-17

### Image Editor

- Site footer links to the privacy policy. This tool's behavior is unchanged.

## [1.0.8] - 2026-10-17

### Image Editor

- Analytics and ads on this page load only when it is served on the configured site host.

## [1.0.7] - 2026-10-17

### Image Editor

- Footer tagline now says tool input is processed locally and is not uploaded.

## [1.0.6] - 2026-10-17

### Image Editor

- Shortened the browser title so it stays within 60 characters.

## [1.0.5] - 2026-10-10

### Image Editor

- Fixed locked crop ratios breaking against the image bounds: a ratio-constrained selection that overflows the image now shrinks as a unit (a 1:1 box on an 800×400 photo becomes 400×400, not a distorted 500×400).
- JPEG exports now composite transparency onto a white background instead of pitch black; the output-size estimate mirrors this.

## [1.0.4] - 2026-09-24

### Image Editor

- Controls stay disabled until every overlapping load, bake, or export finishes; multi-file drops and multi-image pastes say which file was loaded; size labels use the shared formatter.

## [1.0.3] - 2026-09-21

### Image Editor

- Fixed notification toasts: overlapping shows no longer cut each other short; warning/success/default types render their proper colors; toasts now appear top-right beneath the fixed app bar.

## [1.0.2] - 2026-09-21

### Image Editor

- The tool's release version (v1.0.2) is now displayed directly under the tool workspace so users can report it in support tickets.

## [1.0.1] - 2026-09-20

### Image Editor

- Per-tool versioning rollout: every built tool page now stamps <meta name="tool-version"> and the build commit, and the site publishes versions.json for regression triage.

## [1.0.0] - 2026-09-20

### Image Editor

- Initial tracked release. Earlier history predates per-tool versioning; see the repository CHANGELOG.md and git history.
