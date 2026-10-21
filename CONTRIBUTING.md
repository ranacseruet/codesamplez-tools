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
`<meta name="tool-version">` plus `data-build-commit` on `<html>`; each tool's
page also displays the version directly under the tool workspace as a small
`v<x.y.z>` line (prerendered static markup outside the app root, emitted from
`tool.version` at document build time); the deployed site also exposes
`versions.json` at the root listing every tool's live version and the build's
source commit.

**When to bump:** any PR that changes a tool's runtime output (code, styles,
prerendered copy, shared `common/` modules the tool consumes) must bump that
tool's version in the same PR. CI enforces this and fails with the list of
tools missing a bump. Docs-only or CI-only PRs can add the `skip-version-bump`
label to skip the check.

Dependabot pull requests that change only `package.json` and/or
`package-lock.json` pass the gate without anyone adding a label by hand.
The checker skips when the pull request author is `dependabot[bot]` and
every changed path is one of those two manifests. That is the weekly npm
update, which cannot bump each tool. `.github/dependabot.yml` does not apply
`skip-version-bump`. CI honors that label before it looks at the author and
the file list, so an automatic label would also skip a later commit that
edits a tool file. A Dependabot PR that edits any other file is checked like
any other PR. A `package.json` edit from anyone else still requires a bump
from every tool, or the same label when the edit cannot carry one.

A tool's version describes that tool, so a change to a `common/` source module
only requires a bump from the tools that import it, directly or through other
modules (`scripts/common-impact.js` reads the import graph; test files never
count). Shared inputs the import graph cannot attribute to particular tools
still require a bump from every tool: build config, `package.json` (except
the Dependabot manifest-only case above), shared scripts, `common/` CSS and
shims, and any `common/` module that scripts or config import directly, such
as the app shell.

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
- `npm test`: Jest unit/integration tests (requires Node 24; the `test` script runs `scripts/check-node-version.js` first and fails fast with setup guidance on older runtimes — Jest 30 needs Node >= 24.9 for native `require(esm)`).
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
- Dev server: `npm run dev` (serves tracker-free local dev at `http://localhost:8081`; unknown paths render the generated `404.html`, as CloudFront does in production)
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
- Emitted loaders still check `location.hostname` against the host of
  `siteBaseUrl` before requesting gtag.js, adsbygoogle.js, or preconnects.
  A production build opened on localhost, `127.0.0.1`, or a raw CloudFront
  domain does not send hits or load ads.
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

## Analytics events

Custom events go through `trackEvent(name, params)` in `common/analytics-events.ts`.
It calls `gtag('event', name, params)` only when `window.gtag` is already defined
by the production host gate. Local dev, tests, and any build with no measurement
id leave `gtag` undefined: the helper does nothing, does not throw, and does not
log.

### `tool_used`

This is the activation event. A weekly activated user is someone with at least
one `tool_used` event in the week.

| Param | Required | Values |
| --- | --- | --- |
| `tool_id` | yes | Tool slug. See the tool table below. |
| `action` | yes | The tool's action from the table below |
| `trigger` | yes | `user` (click, shortcut, typing, or file drop), `sample` (Load Sample), `share` (a shared link that runs the tool) |
| `outcome` | yes | `success` or `error` |
| `input_size_bucket` | no | `<1KB`, `1–10KB`, `10–100KB`, `>100KB` |
| `from` | no | Data Format Converter input format: `json`, `xml`, `yaml`, `properties` |
| `to` | no | Data Format Converter output format: `json`, `xml`, `yaml`, `properties` |
| `alg` | no | JWT Builder signing algorithm: `HS256`, `RS256` |
| `format` | no | Image Editor export format: `png`, `jpeg`, `webp` |

| Tool | Actions | Extra params |
| --- | --- | --- |
| `diff-checker` | `compare` | |
| `json-formatter` | `format`, `minify`, `validate` | |
| `base64-converter` | `encode`, `decode` | |
| `css-minifier` | `minify` | |
| `js-minifier` | `minify` | |
| `data-format-converter` | `convert` | `from`, `to` |
| `json-editor` | `import`, `edit`, `export` | |
| `jwt-builder` | `generate` | `alg` |
| `jwt-decoder` | `decode`, `verify` | |
| `qr-code-generator` | `generate` | |
| `text-analyzer` | `analyze` | |
| `image-editor` | `export` | `format` |

Rules:

- Do not send document text, file names, secrets, claims, keys, tokens, or any other user input. Params are an allowlist. Unknown keys and strings longer than 100 characters are dropped, not truncated. `from`, `to`, `alg`, and `format` accept only the enums above, so a claim or filename cannot pass.
- Tag every run. A Load Sample run is `trigger=sample`, a shared-link run is `trigger=share`, and a failed parse or conversion is `outcome=error`. Do not drop those events to keep the count “clean”. Unknown `trigger` or `outcome` values are dropped.
- Send at most one `tool_used` per 2 seconds for the same `tool_id` and `action`, so a live or auto-run tool does not emit one event per keystroke. Data Format Converter auto-convert, QR Code Generator, Text Analyzer, and JWT Decoder follow that shared dedupe.
- JSON Editor `edit` fires when a tree change is committed (blur, Enter, or a structure button), not on each keystroke of an inline field. Commits closer than 2 seconds still collapse to one `edit` event through the shared dedupe.
- JSON Formatter sends one action per run: `validate` when a schema is present, otherwise `minify` when indentation is Minified, otherwise `format`. The event is sent after the JSON has been parsed (or the parse has thrown), not before.
- JWT Builder and JWT Decoder never send claims, keys, or tokens. A page load that only shows the decoder's preloaded sample is not an activation; Load Sample is `trigger=sample`.
- QR Code Generator does not count the first automatic render of the default URL. A later edit or Load Sample does.

### Marking the key event in GA4

The owner does this in the GA4 property. It is not part of the build.

1. Admin → Events → mark `tool_used` as a key event.
2. Admin → Custom definitions → create event-scoped custom dimensions for `tool_id`, `action`, `trigger`, `outcome`, `from`, `to`, `alg`, and `format`, so each shows up in reports.

### Shared output and navigation events

These fire from shared components (`CopyButton`, `DownloadManager`, `ShareBar`,
`drop-zone` / `registerFileInput`, and related-tool links). The active
`tool_id` is resolved once when `mountToolShell` runs on a standalone tool page;
call sites do not pass it.

| Event | When | Params |
| --- | --- | --- |
| `copy_output` | User successfully copies tool output via the shared copy button | `tool_id` |
| `download_output` | User downloads output via the shared download helper | `tool_id`, `file_type` (extension or MIME subtype only) |
| `share_link_created` | User copies the canonical share link from the share rail | `tool_id` |
| `file_loaded` | A file is accepted from drag-and-drop or the shared file picker | `tool_id`, `method` (`drop` or `picker`), `file_type` |
| `related_tool_click` | User clicks a related-tool card or compact-row link | `tool_id`, `target_tool_id` (destination tool slug) |

Rules match `tool_used`: no file names, document text, secrets, or URLs; one
event per user action; unknown params are dropped.

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
