# Changelog

All notable changes to this tool are documented in this file.

## [1.0.4] - 2026-09-23

### JavaScript Minifier

- Use Babel AST parsing and generation to validate JavaScript modules and minify without corrupting comments, strings, regular expressions, or operator boundaries.
- Keep object destructuring keys and common built-in array methods intact when experimental property mangling is enabled.
- Require TypeScript and JSX to be transpiled before minification.

## [1.0.3] - 2026-09-21

### JavaScript Minifier

- Fixed notification toasts: overlapping shows no longer cut each other short; warning/success/default types render their proper colors; toasts now appear top-right beneath the fixed app bar.

## [1.0.2] - 2026-09-21

### JavaScript Minifier

- The tool's release version (v1.0.2) is now displayed directly under the tool workspace so users can report it in support tickets.

## [1.0.1] - 2026-09-20

### JavaScript Minifier

- Per-tool versioning rollout: every built tool page now stamps <meta name="tool-version"> and the build commit, and the site publishes versions.json for regression triage.

## [1.0.0] - 2026-09-20

### JavaScript Minifier

- Initial tracked release. Earlier history predates per-tool versioning; see the repository CHANGELOG.md and git history.
