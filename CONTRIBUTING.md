# Contributing Guidelines

## Project Structure

The repo contains individual browser-based tools plus shared runtime, styling, and build infrastructure.

Typical tool structure:

- `tool-name/`
  - `tool.meta.json`
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

### Web Worker Offload Pipeline
For compute-intensive operations (such as text analysis, large diffs, or JSON formatting), offload CPU-bound work off the main thread:
- `common/worker-runner.ts`: Generic, typed runner wrapping dedicated workers behind a Promise API with an always-available main-thread fallback (if Worker is unsupported, fails to construct, or times out).
- `common/worker-harness.ts`: Wraps `self.onmessage` and error handling in dedicated workers (`*.worker.ts`).
- `common/lazy-runner.ts`: Lazily loads worker runner modules via dynamic `import()` to keep workers code-split from the initial bundle and off the SSR/prerender graph.

## UI, Styling & Design Conventions

- **Dark-First Iris Theme**: The default design language is dark-first. `:root` carries the dark palette; light mode is an override under `:root[data-theme="light"]`.
- **Design Tokens**: All colors, surfaces, and spacing use custom properties defined in `common/material-theme.css` (`--md-sys-color-primary`, `--cst-color-accent`, `--color-surface-subtle`, etc.).
- **Typography**: Uses Geist (`--cst-font-family-base`) for UI copy and Geist Mono (`--cst-font-family-mono`) for code, inputs, and numeric data.
- **CSS Architecture**: BEM / OOCSS naming convention (`.o-` for layout objects, `.c-` for components, `.u-` for utilities). Tool-local styles must be scoped to their tool container to prevent leaky selectors.
- **Mobile Viewport Protection**: Long strings, URLs, and code blocks inside `<pre>` or `<code>` must have `overflow-x: auto` and `overflow-wrap: anywhere` to prevent widening mobile layout viewports beyond 390px.

## Adding New Tools

1. Create a new tool directory (`tool-name/`).
2. Add standard assets:
   - `tool.meta.json`: Catalog metadata, title, description, category group, keywords.
   - `styles.css`: Tool-scoped styling overrides.
   - `script.tsx`: Preact component implementation and tool shell mount.
   - `content.tsx`: Documentation copy, FAQ items, and feature lists for prerendering.
   - `README.md`: Tool-specific documentation, usage guide, architecture, and tests.
   - `CHANGELOG.md`: Per-tool release history (see "Tool Versioning").
   - `images/featured.png`: Social card asset.
3. Reuse shared shell (`common/app-shell`) and shared UI primitives before creating new local patterns.
4. Keep tool URLs, output shape, and standalone deployment assumptions consistent.
5. Add the tool to `config/tooling-root.json` and manifest registries.

## Tool Versioning

Every tool is versioned independently so a regression on a deployed page can be
traced to an exact release. The version lives in `<tool>/tool.meta.json`
(`version`), must be semver (`x.y.z`), and is stamped into the built page as
`<meta name="tool-version">` plus `data-build-commit` on `<html>`; the deployed
site also exposes `versions.json` at the root listing every tool's live version
and the build's source commit.

**When to bump:** any PR that changes a tool's runtime output (code, styles,
prerendered copy, shared `common/` modules the tool consumes) must bump that
tool's version in the same PR. CI enforces this and fails with the list of
tools missing a bump. Docs-only or CI-only PRs can add the `skip-version-bump`
label to skip the check.

**Semver guidance:**

- **Patch** — bug fixes, copy tweaks, visual corrections: no behavioral surface changes.
- **Minor** — new features or options, backwards-compatible behavior.
- **Major** — changed or removed user-facing behavior, new requirements on inputs.

**Release flow:**

```sh
# 1. Document the change (creates/prepends the entry in <tool>/CHANGELOG.md)
npm run tool:version:note -- --tool <tool-id> --version <x.y.z> --note "What changed"

# 2. Bump the version in <tool>/tool.meta.json
npm run tool:version:bump -- --tool <tool-id> --release <patch|minor|major>

# 3. After the version is live on main, tag the release
npm run tool:tag-release -- --tool <tool-id>
```

Tags are annotated git tags named `<tool-id>/v<x.y.z>`. The `tag` command
refuses to run when the changelog has no entry for the version being tagged.
`npm run tool:versions` lists every tool's current version.

## Code Style

- Use consistent indentation and keep modules focused.
- Prefer TypeScript for new logic and runtime work when practical.
- Keep directly executed helper entrypoints on the current Node runtime path:
  - CommonJS helpers stay `.js`
  - ESM helpers stay `.mjs`
  - Use `// @ts-check` plus typed JSDoc on those entrypoints instead of converting them to compiled script entry files.
- Prefer `.ts` / `.tsx` for shared importable modules.
- Use semantic HTML and ensure all interactive controls have accessible names (`aria-label`).
- Comment only where behavior is not self-evident.

## Testing And Validation

Required validation gates:

- `npm run typecheck`: TypeScript compilation check across all tools and scripts.
- `npm test`: Jest unit/integration tests (requires Node 24).
- `npm run audit:deps`: Security vulnerability audit.
- `npm run build`: Production build of all tools and static assets.
- `npm run verify-build`: Checks that all required bundles, styles, and HTML files are emitted cleanly.

Additional checks:

- `npm run bundle-budget-check`: Enforces raw JS size budgets for main bundles.
- `npm run bundle-metrics`: Reports size metrics for JS, CSS, HTML, and async chunks.
- `npm run qa:a11y:foundation`: Automated accessibility scan via axe-core and Playwright.
- `npm run qa:cross-browser`: Playwright scenarios testing worker offloads and 390px mobile viewport overflow.

## Building

- Production build: `npm run build`
- Dev server: `npm run dev` (serves tracker-free local dev at `http://localhost:8081`)
- Serve production build locally: `npm start` (serves `build/` at `http://localhost:8080`)
- Targeted builds:
  - `npm run build -- --tool jwt-decoder-tool`
  - `npm run build -- --tools jwt-decoder-tool,json-formatter-tool`
  - `npm run verify-build -- --tools jwt-decoder-tool,json-formatter-tool`

## SEO, Metadata & Crawler Policy

- Pages are prerendered into static HTML with server-side JSON-LD structured data (`Organization`, `WebApplication`, `FAQPage`, `HowTo`).
- Static root assets (`sitemap.xml`, `robots.txt`, `llms.txt`) are generated from catalog metadata.
- Permissive Crawler Policy: AI search assistants and crawlers (Googlebot, Bingbot, GPTBot, ClaudeBot, PerplexityBot) are welcome to index and cite the client-side tools.

## Analytics & Ads (Deploy-Time Configuration)

Tracking is **off by default** and never wired from tracked config, so forks and
self-hosters never inherit the upstream Google Analytics or AdSense properties.

- The repo's `config/tooling-root.json` ships `analytics.googleAnalyticsId` and
  `analytics.adsenseClientId` as `null`.
- A deployment supplies them through environment variables, which take precedence
  over config:
  - `CST_GA_MEASUREMENT_ID` — GA4 measurement id (`G-XXXXXXXXXX`).
  - `CST_ADSENSE_CLIENT_ID` — AdSense client id (`ca-pub-XXXXXXXXXXXXXXXX`).
- Injection is **fail-closed**: only `NODE_ENV=production` builds emit trackers.
  Development, test, CI, staging, and an unset `NODE_ENV` all resolve empty ids.
- `CST_DISABLE_ANALYTICS` (`1`/`true`/`yes`) is a kill-switch that forces tracking
  off even for production builds. The visual-diff, baseline, and health-monitoring
  workflows set it so screenshots stay ad-free and deterministic.
- In this repository the ids live as **repository variables**
  (`vars.CST_GA_MEASUREMENT_ID`, `vars.CST_ADSENSE_CLIENT_ID`), injected into the
  build only on `main`. They are public values embedded in client HTML, so they
  are variables rather than secrets.

To enable tracking for your own deployment:

```bash
NODE_ENV=production \
CST_GA_MEASUREMENT_ID=G-XXXXXXXXXX \
CST_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX \
npm run build
```

## Documentation Standards

- Keep tool-level `README.md` files current whenever updating tool behavior or adding options.
- Document tool-specific algorithms, options, and limitations in the tool's own `README.md`.
- Keep top-level documentation aligned with active implementation.

## Development Workflow

1. Start from an up-to-date branch off `main`.
2. Install dependencies with `npm install`.
3. Make focused changes.
4. Add or update tests as needed.
5. Run the required validation gates (`npm run typecheck`, `npm test`, `npm run build`, `npm run verify-build`).
6. Update documentation for any user-visible or architectural changes.
7. Open a pull request with validation evidence and user-impact notes.
