# Changelog

All notable changes to this tool are documented in this file.

## [1.0.7] - 2026-09-26

### QR Code Generator

- Housekeeping patch bump for the shared common/Base64Codec fix (unpadded Base64URL acceptance); this tool does not bundle the codec and its behavior is unchanged.

## [1.0.6] - 2026-09-25

### QR Code Generator

- Fixed Download PNG saving a text file containing the raw data URL instead of a valid binary PNG image (canvas is now exported via `toBlob`).
- Download PNG is disabled while the input is empty (including whitespace-only) or the QR library reports an error (e.g. data too long).
- The data-too-long error message now correctly suggests lowering the error correction level, which raises data capacity.
- Whitespace-only input is now treated as empty input (empty state shown instead of a QR code of spaces).
- Failed image export shows an error toast instead of silently doing nothing.

## [1.0.5] - 2026-09-24

### QR Code Generator

- Holding Cmd/Ctrl+Enter runs the primary action once instead of repeating.

## [1.0.4] - 2026-09-23

### QR Code Generator

- Use qrcode's supported color options for QR canvas output

## [1.0.3] - 2026-09-21

### QR Code Generator

- Fixed notification toasts: overlapping shows no longer cut each other short; warning/success/default types render their proper colors; toasts now appear top-right beneath the fixed app bar.

## [1.0.2] - 2026-09-21

### QR Code Generator

- The tool's release version (v1.0.2) is now displayed directly under the tool workspace so users can report it in support tickets.

## [1.0.1] - 2026-09-20

### QR Code Generator

- Per-tool versioning rollout: every built tool page now stamps <meta name="tool-version"> and the build commit, and the site publishes versions.json for regression triage.

## [1.0.0] - 2026-09-20

### QR Code Generator

- Initial tracked release. Earlier history predates per-tool versioning; see the repository CHANGELOG.md and git history.
