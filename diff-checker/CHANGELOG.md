# Changelog

All notable changes to this tool are documented in this file.

## [1.0.16] - 2026-10-19

### Diff Checker

- Accept converter format, JWT algorithm, and image export format names on shared tool_used events. This tool's actions are unchanged.

## [1.0.15] - 2026-10-19

### Diff Checker

- Shared CopyButton update (no user-visible change for this tool).

## [1.0.14] - 2026-10-17

### Diff Checker

- Emit shared analytics events for copy, download, share link, file load, and related-tool clicks. No file names or URLs are sent.

## [1.0.13] - 2026-10-17

### Diff Checker

- Add contextual cross-links in the article and a compact Related tools row under the workspace.

## [1.0.12] - 2026-10-17

### Diff Checker

- Added a "Compare Code Online" guide section and new FAQs for comparing two code files online and diff checker vs difference checker wording.

## [1.0.11] - 2026-10-17

### Diff Checker

- Records a tool_used analytics event when Compare runs, tagged with trigger and outcome. The compared text is not sent.

## [1.0.10] - 2026-10-17

### Diff Checker

- Site footer links to the privacy policy. This tool's behavior is unchanged.

## [1.0.9] - 2026-10-17

### Diff Checker

- Analytics and ads on this page load only when it is served on the configured site host.

## [1.0.8] - 2026-10-17

### Diff Checker

- Privacy section now says tool input is processed in the browser and is not uploaded, and that the site uses Google Analytics and Google AdSense cookies.
- Footer tagline now says tool input is processed locally and is not uploaded.

## [1.0.7] - 2026-10-17

### Diff Checker

- Shortened the browser title so it stays within 60 characters.

## [1.0.6] - 2026-10-08

### Diff Checker

- Fixed navigation reset to clear all highlight class variants (`current-diff-single`, `current-diff-start`, `current-diff-middle`, `current-diff-end`) rather than only `.current-diff`.
- Detect language once on full input text to maintain consistent syntax highlighting across all lines.
- Batch DOM insertions using DocumentFragment to prevent main thread freezing on large diffs, and added `DiffDisplay.render` alias.

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
