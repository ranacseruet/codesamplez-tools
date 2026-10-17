# Changelog

All notable changes to this tool are documented in this file.

## [1.0.13] - 2026-10-17

### Base64 Converter

- Emit shared analytics events for copy, download, share link, file load, and related-tool clicks. No file names or URLs are sent.

## [1.0.12] - 2026-10-17

### Base64 Converter

- Add contextual cross-links in the article and a compact Related tools row under the workspace.

## [1.0.11] - 2026-10-17

### Base64 Converter

- Records a tool_used analytics event for Encode and Decode, tagged with trigger and outcome. The input text is not sent.

## [1.0.10] - 2026-10-17

### Base64 Converter

- Site footer links to the privacy policy. This tool's behavior is unchanged.

## [1.0.9] - 2026-10-17

### Base64 Converter

- Analytics and ads on this page load only when it is served on the configured site host.

## [1.0.8] - 2026-10-17

### Base64 Converter

- Footer tagline now says tool input is processed locally and is not uploaded.
- README privacy note now says tool input is processed locally and is not uploaded.

## [1.0.7] - 2026-10-17

### Base64 Converter

- Reworded the browser title to "Base64 Converter – Encode & Decode Online | CodeSamplez" so the primary keyword stays first, still within 60 characters.

## [1.0.6] - 2026-10-17

### Base64 Converter

- Shortened the browser title so it stays within 60 characters.

## [1.0.5] - 2026-09-26

### Base64 Converter

- Unpadded URL-safe Base64 (RFC 4648 §5 — no trailing `=`, as in JWT payloads) is now accepted: decode mode decodes it and auto mode decodes it instead of re-encoding it as if it were plain text. The codec's normalization now restores the omitted padding for every consumer (validation, decoding, preview, download).

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
