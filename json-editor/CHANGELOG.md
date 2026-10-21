# Changelog

All notable changes to this tool are documented in this file.

## [1.0.12] - 2026-10-21

### JSON Editor

- Dev-dependency pin for follow-redirects and launch-editor. Not a user-facing behavior change.

## [1.0.11] - 2026-10-17

### JSON Editor

- Emit shared analytics events for copy, download, share link, file load, and related-tool clicks. No file names or URLs are sent.

## [1.0.10] - 2026-10-17

### JSON Editor

- Add contextual cross-links in the article and a compact Related tools row under the workspace.

## [1.0.9] - 2026-10-17

### JSON Editor

- Site footer links to the privacy policy. This tool's behavior is unchanged.

## [1.0.8] - 2026-10-17

### JSON Editor

- Analytics and ads on this page load only when it is served on the configured site host.

## [1.0.7] - 2026-10-17

### JSON Editor

- Footer tagline now says tool input is processed locally and is not uploaded.

## [1.0.6] - 2026-10-17

### JSON Editor

- Shortened the browser title so it stays within 60 characters.

## [1.0.5] - 2026-10-15

### JSON Editor

- Prevent copying or downloading serialization error text as JSON when tree serialization fails.

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
