# Changelog

All notable changes to this tool are documented in this file.

## [1.0.6] - 2026-09-26

### CSS Minifier

- calc()/min()/max()/clamp() math expressions are masked during whitespace stripping, so `calc(100% + 20px)` no longer becomes the invalid `calc(100%+20px)` that browsers drop.
- Named-color shortening no longer rewrites `green` to `#0f0` (which is lime); the keyword stays, which is both color-correct and byte-shortest.
- The selector-combining pass now walks rules in document order and recurses into nested at-rule blocks, so @supports/@keyframes/@layer/@container are no longer severed into orphan braces, @media overrides no longer get hoisted above the base rules they override (cascade inversion), and statement at-rules such as @import/@charset/@font-face are preserved instead of being silently dropped.

## [1.0.5] - 2026-09-24

### CSS Minifier

- One minification pipeline (minifyCSS) backs the UI; CSS validation no longer adds and removes a style element in the page; a multi-file drop says which file was loaded; size labels use the shared B/KiB/MB formatter.

## [1.0.4] - 2026-09-24

### CSS Minifier

- Preserve quoted strings throughout CSS minification.

## [1.0.3] - 2026-09-21

### CSS Minifier

- Fixed notification toasts: overlapping shows no longer cut each other short; warning/success/default types render their proper colors; toasts now appear top-right beneath the fixed app bar.

## [1.0.2] - 2026-09-21

### CSS Minifier

- The tool's release version (v1.0.2) is now displayed directly under the tool workspace so users can report it in support tickets.

## [1.0.1] - 2026-09-20

### CSS Minifier

- Per-tool versioning rollout: every built tool page now stamps <meta name="tool-version"> and the build commit, and the site publishes versions.json for regression triage.

## [1.0.0] - 2026-09-20

### CSS Minifier

- Initial tracked release. Earlier history predates per-tool versioning; see the repository CHANGELOG.md and git history.
