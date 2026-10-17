# Changelog

All notable changes to this tool are documented in this file.

## [1.0.8] - 2026-10-17

### Text Analyzer

- Analytics and ads on this page load only when it is served on the configured site host.

## [1.0.7] - 2026-10-17

### Text Analyzer

- Privacy section now says tool input is processed in the browser and is not uploaded, and that the site uses Google Analytics and Google AdSense cookies.
- Footer tagline now says tool input is processed locally and is not uploaded.

## [1.0.6] - 2026-10-17

### Text Analyzer

- Shortened the browser title so it stays within 60 characters.

## [1.0.5] - 2026-10-14

### Text Analyzer

- Sentence counting no longer breaks sentences at common abbreviations (`Dr.`, `Mr.`, `Prof.`, `e.g.`, `i.e.`, `vs.`, `etc.`, `U.S.`, `D.C.`, `p.m.`, spaced initials), so Flesch Reading Ease and Flesch-Kincaid grade levels are no longer distorted by inflated sentence counts. Punctuation-only input (`...`) now reports 0 sentences instead of 1.
- Word counting now segments Chinese, Japanese, Thai, and other space-less scripts via `Intl.Segmenter`, fixing a whole paragraph being reported as one word; average word length and keyword detection are script-aware for non-Latin text. Mixed-script input containing those scripts is segmented as a whole, so hyphenated English compounds inside it count as their parts.

## [1.0.4] - 2026-09-24

### Text Analyzer

- Flesch Reading Ease is shown unclamped, so very dense text scores below 0 instead of a flat 0.00; a multi-file drop says which file was loaded.

## [1.0.3] - 2026-09-21

### Text Analyzer

- Fixed notification toasts: overlapping shows no longer cut each other short; warning/success/default types render their proper colors; toasts now appear top-right beneath the fixed app bar.

## [1.0.2] - 2026-09-21

### Text Analyzer

- The tool's release version (v1.0.2) is now displayed directly under the tool workspace so users can report it in support tickets.

## [1.0.1] - 2026-09-20

### Text Analyzer

- Per-tool versioning rollout: every built tool page now stamps <meta name="tool-version"> and the build commit, and the site publishes versions.json for regression triage.

## [1.0.0] - 2026-09-20

### Text Analyzer

- Initial tracked release. Earlier history predates per-tool versioning; see the repository CHANGELOG.md and git history.
