# codesamplez-tools
![Build](https://github.com/ranacseruet/codesamplez-tools/actions/workflows/ci.yml/badge.svg) [![codecov](https://codecov.io/github/ranacseruet/codesamplez-tools/graph/badge.svg?token=REDACTED_CODECOV_TOKEN)](https://codecov.io/github/ranacseruet/codesamplez-tools)

A collection of browser-based developer utilities that run client-side and build into standalone static artifacts for deployment at [Codesamplez.com](https://codesamplez.com).

## Features

- Browser-based with no install required for end users
- Client-side processing for privacy-preserving workflows
- Shared responsive UI foundation across all tools
- Standalone build output per tool for stable deployment
- Automated validation, bundle budgets, and regression monitoring

## Tool Inventory

- `data-format-converter`
- `base64-converter-tool`
- `diff-checker-tool`
- `jwt-decoder-tool`
- `text-analyzer-tool`
- `js-minifier-tool`
- `json-formatter-tool`
- `jwt-builder-tool`
- `css-minifier-tool`
- `qr-code-generator`

## Browser Support

- Chrome: current and previous major
- Edge: current and previous major
- Firefox: current and previous major
- Safari: current and previous major
- iOS Safari: current and previous major
- Android Chrome: current and previous major

## Architecture

The repo is on a post-migration steady-state workflow.

- Runtime foundation: `preact`
- Shared shell/layout primitives: `common/app-shell`
- Shared bootstrap and prerender contracts: `common/tooling-contracts.ts`
- Shared design tokens and reusable primitives:
  - `common/material-theme.css`
  - `common/shared-styles.css`
- Prerender pipeline: `scripts/prerender-tool.js`
- Mixed TypeScript/JavaScript codebase with required repo-wide typecheck
- Stable per-tool production output contract:
  - `build/<tool>/index.html`
  - `build/<tool>/styles.main.css`
  - `build/<tool>/bundle.main.js`

Engineering constraints:

- Tools remain fully client-side and privacy-preserving
- Existing tool URLs and build output paths are stable deployment contracts
- Shared UI work should reuse existing tokens/primitives before adding new ones
- Directly executed helper entrypoints under `scripts/` stay on the current Node runtime path (`.js` / `.mjs`) and use `// @ts-check` plus typed JSDoc
- Shared importable runtime modules should prefer `.ts` / `.tsx` when practical

## Technologies

- Preact
- TypeScript + JavaScript
- Webpack
- Jest + JSDOM
- Playwright + axe-core
- HTML5 and CSS3

## Local Development

### Setup

1. Clone the repository.
2. Install dependencies with `npm install`.
3. Run the required validation gates:
   - `npm run typecheck`
   - `npm test`
   - `npm run audit:deps`
   - `npm run build`
   - `npm run verify-build`

### Build And Serve

- Production build: `npm run build`
- Verify build output: `npm run verify-build`
- Serve the production build locally: `npm start`
- Dev server: `npm run dev`

The build preserves the standalone deployment contract for each tool and prerenders supported tool UI into static HTML before client hydration.

## Quality Gates

Required local and CI gates:

- `npm run typecheck`
- `npm test`
- `npm run audit:deps`
- `npm run build`
- `npm run verify-build`
- `npm run bundle-budget-check`

Supporting and report-oriented checks:

- `npm run bundle-metrics`
- `npm run qa:a11y:foundation`
- `npm run qa:cross-browser`
- Review the PR visual diff workflow when a change affects UI or layout
- Review the main-branch visual baseline publish result when shared UI changes land

Visual baseline publishing and PR visual diffs are CI-managed workflows in this repository rather than local npm scripts.

## Contributing

1. Create a feature branch.
2. Install dependencies with `npm install`.
3. Make your changes.
4. Run the required gates:
   - `npm run typecheck`
   - `npm test`
   - `npm run audit:deps`
   - `npm run build`
   - `npm run verify-build`
5. Run any relevant supporting checks for your change:
   - `npm run bundle-budget-check`
   - `npm run qa:a11y:foundation`
   - `npm run qa:cross-browser` for browser-sensitive changes
   - Review the PR visual diff workflow when UI or layout changes are involved
6. Serve the production build locally with `npm start` when checking browser behavior.
7. Open a pull request with validation and user-impact notes.

Contributor references:

- [Contributing Guidelines](./CONTRIBUTING.md)
- [UI Styling Conventions](./docs/ui-styling-conventions.md)
- [Archived Docs Index](./docs/archive/README.md)

## Project Policies

- [Support](./SUPPORT.md)
- [Security Policy](./SECURITY.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [License](./LICENSE)

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
