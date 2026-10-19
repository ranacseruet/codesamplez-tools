# Changelog

All notable changes to this tool are documented in this file.

## [1.0.10] - 2026-10-17

### JWT Decoder & Validator

- Site footer links to the privacy policy. This tool's behavior is unchanged.

## [1.0.9] - 2026-10-17

### JWT Decoder & Validator

- Analytics and ads on this page load only when it is served on the configured site host.

## [1.0.8] - 2026-10-17

### JWT Decoder & Validator

- Footer tagline now says tool input is processed locally and is not uploaded.

## [1.0.7] - 2026-10-17

### JWT Decoder & Validator

- Shortened the browser title so it stays within 60 characters.

## [1.0.6] - 2026-10-14

### JWT Decoder & Validator

- Fixed a false "Signature is invalid" report for RS256 and other non-HS256 tokens: the tool cannot verify asymmetric signatures, so it now shows an explanatory warning ("Signature verification is only supported for HS256 (token uses …)") instead of claiming the signature is invalid.
- Added token validity evaluation for the standard `exp`, `nbf`, and `iat` claims: the Validation Result panel now shows whether a token is expired, not yet valid, or currently valid (with human-readable UTC dates) instead of leaving the raw epoch timestamps uninterpreted.

## [1.0.5] - 2026-09-26

### JWT Decoder & Validator

- Shared Base64Codec fix: unpadded URL-safe Base64 (RFC 4648 §5, e.g. JWT segments) is now accepted by validation and decoding instead of being rejected.

## [1.0.4] - 2026-09-24

### JWT Decoder & Validator

- A signature-verification runtime failure is logged once instead of twice; holding Cmd/Ctrl+Enter no longer repeats.

## [1.0.3] - 2026-09-21

### JWT Decoder & Validator

- Fixed notification toasts: overlapping shows no longer cut each other short; warning/success/default types render their proper colors; toasts now appear top-right beneath the fixed app bar.

## [1.0.2] - 2026-09-21

### JWT Decoder & Validator

- The tool's release version (v1.0.2) is now displayed directly under the tool workspace so users can report it in support tickets.

## [1.0.1] - 2026-09-20

### JWT Decoder & Validator

- Per-tool versioning rollout: every built tool page now stamps <meta name="tool-version"> and the build commit, and the site publishes versions.json for regression triage.

## [1.0.0] - 2026-09-20

### JWT Decoder & Validator

- Initial tracked release. Earlier history predates per-tool versioning; see the repository CHANGELOG.md and git history.
