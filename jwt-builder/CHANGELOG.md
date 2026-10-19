# Changelog

All notable changes to this tool are documented in this file.

## [1.0.13] - 2026-10-19

### JWT Builder

- Copying the signing key no longer emits copy_output analytics (input, not tool output).

## [1.0.12] - 2026-10-17

### JWT Builder

- Emit shared analytics events for copy, download, share link, file load, and related-tool clicks. No file names or URLs are sent.

## [1.0.11] - 2026-10-17

### JWT Builder

- Add contextual cross-links in the article and a compact Related tools row under the workspace.

## [1.0.10] - 2026-10-17

### JWT Builder

- Site footer links to the privacy policy. This tool's behavior is unchanged.

## [1.0.9] - 2026-10-17

### JWT Builder

- Analytics and ads on this page load only when it is served on the configured site host.

## [1.0.8] - 2026-10-17

### JWT Builder

- Footer tagline now says tool input is processed locally and is not uploaded.
- Intro now says tool input is processed locally and is not uploaded.

## [1.0.7] - 2026-10-17

### JWT Builder

- Shortened the browser title so it stays within 60 characters.

## [1.0.6] - 2026-10-14

### JWT Builder

- Custom claim values are now parsed as JSON on every entry, so booleans (`true`/`false`), numbers, arrays, and objects keep their native types instead of being coerced to strings. Numeric literals whose exact value cannot be represented as a JavaScript number — in any notation (e.g. `9007199254740993`, `9007199254740993.0`, `9.007199254740993e15`) — keep their exact string form to avoid silent precision loss.
- `iss` and `exp` are no longer mandatory, per RFC 7519 §4.1: every registered claim is optional. Empty claims are omitted from the payload, and leaving `exp` empty builds a non-expiring token.
- RS256 signing now accepts PKCS#1 RSA private keys (`-----BEGIN RSA PRIVATE KEY-----`, the default `openssl genrsa` output) by converting them to PKCS#8 in the browser; PKCS#8 keys remain supported as before.

## [1.0.5] - 2026-09-26

### JWT Builder

- Shared Base64Codec fix: unpadded URL-safe Base64 (RFC 4648 §5, e.g. JWT segments) is now accepted by validation and decoding instead of being rejected.

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
