# Contributing Guidelines

## Project Structure

The repo contains individual browser-based tools plus shared runtime, styling, and build infrastructure.

Typical tool structure:

- `tool-name/`
  - `index.html`
  - `styles.css`
  - `script.tsx` or `script.js`
  - optional logic modules such as `*.ts` or `*.js`
  - `README.md`
  - `images/`

Shared foundation:

- `common/`
  - shared shell components
  - shared design tokens and primitives
  - reusable browser-side utilities
- `scripts/`
  - build verification
  - prerender pipeline
  - bundle metrics and budget enforcement
  - accessibility, visual baseline, and cross-browser QA helpers

## Architecture Expectations

- Runtime foundation is `preact`.
- Shared shell/layout primitives live in `common/app-shell`.
- Shared bootstrap and prerender contracts live in `common/tooling-contracts.ts`.
- Shared design tokens and reusable primitives live in:
  - `common/material-theme.css`
  - `common/shared-styles.css`
- Tool logic should stay framework-agnostic where practical.
- Preserve the production output contract for every tool:
  - `build/<tool>/index.html`
  - `build/<tool>/styles.main.css`
  - `build/<tool>/bundle.main.js`

## Adding New Tools

1. Create a new tool directory.
2. Add the standard assets:
   - `index.html`
   - `styles.css`
   - `script.tsx` when JSX is used, otherwise `script.js` or `script.ts`
   - `README.md`
   - `images/` if needed
3. Reuse the shared shell and shared UI primitives before creating new local patterns.
4. Keep tool URLs, output shape, and standalone deployment assumptions consistent with existing tools.
5. Add the tool to the root landing page and any build/prerender registry locations required by the current architecture.

## Code Style

- Use consistent indentation and keep modules focused.
- Prefer TypeScript for new logic and runtime work when practical.
- Keep directly executed helper entrypoints on the current Node runtime path:
  - CommonJS helpers stay `.js`
  - ESM helpers stay `.mjs`
  - use `// @ts-check` plus typed JSDoc on those entrypoints instead of converting them to compiled script entry files
- Prefer `.ts` / `.tsx` for shared importable modules when practical.
- Use semantic HTML.
- Keep CSS scoped and reusable:
  - use shared primitives first
  - keep tool-local selectors limited to tool-specific behavior or layout
  - avoid generic selectors that leak outside the tool container
- Comment only where behavior is not self-evident.

## Testing And Validation

Required validation gates:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run verify-build`

Additional checks to run when relevant:

- `npm run bundle-budget-check`
- `npm run bundle-metrics`
- `npm run qa:a11y:foundation`
- `npm run qa:visual-baseline:foundation`
- `npm run qa:visual-diff:foundation`
- `npm run qa:cross-browser`

Notes:

- Jest runs in a JSDOM environment.
- Test files typically live alongside the corresponding tool or shared module.
- Playwright-based checks use the built site, usually served locally with `npm start`.
- `npm run qa:visual-diff:foundation` expects CI-style baseline artifacts by default. For local comparisons, either stage files under `baseline/qa-artifacts/...` or override the baseline/current result paths and run directories with the `QA_VISUAL_*` environment variables.

## Building

Production builds are created with `npm run build`.

The build:

- emits standalone production assets per tool
- prerenders supported tool UI into static HTML before hydration
- copies static assets into `build/`

Always run `npm run verify-build` after build changes or when touching output-affecting code.

## Documentation

- Keep tool-level `README.md` files current.
- Keep active contributor docs aligned with implemented behavior, not archived plans.
- Use these active references:
  - [README](/Users/mdaliahsanrana/Work/codesamplez/codesamplez-tools/README.md)
  - [UI Styling Conventions](/Users/mdaliahsanrana/Work/codesamplez/codesamplez-tools/docs/ui-styling-conventions.md)
  - [Archived Docs Index](/Users/mdaliahsanrana/Work/codesamplez/codesamplez-tools/docs/archive/README.md)
- Treat `docs/archive/` as historical reference only.

## Development Workflow

1. Start from an up-to-date branch off `main`.
2. Install dependencies with `npm install`.
3. Make focused changes.
4. Add or update tests as needed.
5. Run the required validation gates.
6. Run any relevant supporting QA checks for your change.
7. Update docs when user-visible behavior, contributor workflow, or shared architecture changes.
8. Open a pull request with validation evidence and user-impact notes.
