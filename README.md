# codesamplez-tools
![Build](https://github.com/ranacseruet/codesamplez-tools/actions/workflows/ci.yml/badge.svg) [![codecov](https://codecov.io/github/ranacseruet/codesamplez-tools/graph/badge.svg?token=REDACTED_CODECOV_TOKEN)](https://codecov.io/github/ranacseruet/codesamplez-tools)

A collection of browser-based developer utilities that run client-side and build into standalone static artifacts for deployment at [Codesamplez.com](https://codesamplez.com).

## Features

- Browser-based with no install required for end users
- Client-side processing for privacy-preserving workflows
- Shared responsive UI foundation across all tools
- Keyboard-first UX: `?` opens a per-page shortcut reference on every page
- A "Recently used" row on the tools index, kept in your browser only
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
- Shared tool catalog + root-page metadata: tool-local `tool.meta.json` files plus `config/tooling-root.json`
- Shared design tokens and reusable primitives:
  - `common/material-theme.css`
  - `common/shared-styles.css`
- Shared input behaviours: `common/shortcut-utils.ts` (Cmd/Ctrl+Enter primary
  action, the `?` help trigger, and the shared `isEditableTarget` /
  `formatModifierChord` helpers) and `common/drop-zone.ts` (drag-and-drop file
  loading; files are read in the browser and never uploaded)
- Keyboard help: `common/shortcut-help.ts` renders the `?` overlay, listing only
  the shortcuts the current page actually has (it reads the search island, the
  primary-action button, and registered drop targets from the live DOM). It
  loads as a lazy chunk, and the shell header's `?` button opens the same thing
- Recently used tools: `common/recent-tools.ts` stores catalog ids in this
  browser's `localStorage` (never transmitted, capped at 8, malformed payloads
  discarded). `mountToolShell` records the visit; the landing hero renders the
  row via `common/app-shell/RecentTools.tsx`, with a Clear control
- Shared share/copy behaviours: `common/share-url.ts` (hash-fragment state
  links, never sent to a server) and `common/clipboard.ts` (one
  Clipboard-API-with-`execCommand`-fallback strategy, used by every copy
  affordance in the repo). Per-tool payload codecs
  live in each tool's `share-url.ts` and load as lazy chunks, since they pull
  `lz-string`
- Prerender pipeline: `scripts/prerender-tool.js`
- HTML document generation: `scripts/tool-document.js` and `scripts/root-document.js`
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
- Targeted production build: `npm run build -- --tool jwt-decoder-tool`
- Multi-tool production build: `npm run build -- --tools jwt-decoder-tool,json-formatter-tool`
- Verify build output: `npm run verify-build`
- Verify selected tool builds: `npm run verify-build -- --tools jwt-decoder-tool,json-formatter-tool`
- Serve the production build locally: `npm start`
- Dev server: `npm run dev` — serves every asset (stylesheets, bundles, fonts, images, favicons) from the local dev origin (`http://localhost:8081`), so local edits are reflected immediately. The production static root (`siteStaticRootUri`) is intentionally ignored in development; set `CST_SITE_STATIC_ROOT_URI` only if you need assets to resolve against a different origin.

The build preserves the standalone deployment contract for each tool, prerenders supported tool UI into static HTML before client hydration, and generates the root landing page from manifest metadata rather than a hand-authored source HTML file.

### Subdomain Deployment

Production deploys publish the static build to the `tools.codesamplez.com` S3 bucket behind CloudFront.

Directory-index routing is handled at the CloudFront viewer-request layer by the repo-managed `codesamplez-tools-rewrite-static-urls` CloudFront Function (owner-prefixed so it is unmistakable in the shared AWS account):

- The source lives at `infrastructure/cloudfront-functions/codesamplez-tools-rewrite-static-urls.js`.
- CI/CD deploys the function from source when it changes, publishes it to `LIVE`, verifies the live source, attaches it to the `tools.codesamplez.com` distribution's default cache behavior, and enforces `ViewerProtocolPolicy=redirect-to-https`.
- **The deploy step runs only for commits that touch the function source, `scripts/deploy-cloudfront-function.js`, or `.github/workflows/ci.yml`.** `package.json`/`package-lock.json` are deliberately excluded: the function is standalone CloudFront-JS with no npm dependencies, so dependency bumps cannot change it. CI invokes `node scripts/deploy-cloudfront-function.js` directly rather than via `npm run deploy:cloudfront-function`, so the `package.json` script entry cannot alter what CI deploys and that trigger list stays exhaustive. The npm script remains available for manual runs.
- **The deploy is idempotent.** Before mutating anything, the script compares the published `LIVE` source, `Comment`, and `Runtime` against the repo; when all three match it skips `update-function`/`test-function`/`publish-function` and only re-asserts the distribution association. This keeps repeat runs from burning CloudFront revisions.
- `update-function` retries on a stale ETag. CloudFront's control plane is eventually consistent, so a `describe-function` read taken shortly after someone else published can return an ETag that `UpdateFunction` then rejects with `PreconditionFailed`. The script re-reads the ETag and retries up to three times. The ETags used by `test-function`/`publish-function` come from the immediately preceding successful call in the same process, so they are not subject to the same staleness.
- The function redirects extensionless tool requests such as `/jwt-decoder` to the canonical trailing-slash URL `/jwt-decoder/` while preserving query string parameters, then rewrites trailing-slash requests such as `/` and `/jwt-decoder/` to `/index.html` and `/jwt-decoder/index.html` before the request reaches the S3 REST origin.
- The deployment script syncs each selected tool directory as-is, including `build/<tool>/index.html`; the sync uses `--delete`, so stale tool HTML objects are pruned along with stale JS, CSS, and image assets. The sync stamps the directory's JS/CSS with `Cache-Control: public, max-age=0, must-revalidate, s-maxage=86400`, then re-uploads `index.html` with `public, max-age=0, must-revalidate` so navigations always reflect the newest deploy.
- Root-level assets such as `index.html`, `404.html`, `robots.txt`, `sitemap.xml`, `llms.txt`, `og-home.png`, and `ads.txt` (when AdSense is configured) are copied through the root-assets path because they are not inside a tool directory. Each is stamped with a per-extension `Cache-Control` policy — fonts (`*.woff2`) get `max-age=31536000, immutable`, images one week, JS/CSS browser-revalidated with a one-day edge TTL, `robots.txt`/`sitemap.xml`/`llms.txt` one hour, and HTML `max-age=0, must-revalidate`.
- **CDN invalidation purges the edge on every deploy**, so the `max-age` values above only bound how long a *browser* may reuse a cached copy — the CDN is never stale. Without these headers the S3 objects shipped no `Cache-Control`, forcing a revalidation round-trip per asset on every visit.
- **JS/CSS deliberately revalidate rather than sitting on a browser `max-age`.** `bundle.main.js` and `styles.main.css` are **not content-hashed**, and HTML is served `must-revalidate`, so a browser `max-age` on the assets hands a returning visitor the *new* HTML against their *old* CSS/JS — a mismatched page rather than a uniformly stale one. This was observed in production after PR #487: the new markup rendered against the previous stylesheet, leaving the whole-card link inert until the browser cache expired. A CloudFront invalidation cannot fix it, because it purges the edge and not the browser. `s-maxage=86400` keeps CloudFront caching these for a day, so the browser's conditional request is answered at the edge for the cost of a 304. Restoring a long browser `max-age` requires content-hashed filenames first.

The canonical checked build path remains `build/<tool>/index.html`; directory-index behavior belongs in CloudFront rather than duplicate S3 object keys.

Production deploys are **serialized** via a `deploy-main` concurrency group (`cancel-in-progress: false`). Affected-target detection diffs against the immediate predecessor commit (`github.event.before`), so back-to-back merges must deploy one at a time and must never be cancelled — otherwise a commit's changes would be skipped. PR runs are deduplicated separately (stale commits cancelled); main builds still run independently.

Serialization prevents two deploys from writing concurrently, but it does **not** make CloudFront ETag reads safe on its own: the control plane is eventually consistent, so a deploy starting seconds after the previous one finished can still read a pre-publish ETag and fail with `PreconditionFailed`. That is why the function deploy is both narrowly triggered and idempotent (see above).

## Analytics & Ads

Google Analytics 4 and Google AdSense are injected into every generated page (the index and each tool page) from a single shared head builder, so both render paths stay in parity.

### Configuration

The IDs are **public** values embedded in client HTML — not secrets — so they live in `config/tooling-root.json`:

```json
"analytics": {
  "googleAnalyticsId": "G-XXXXXXXXXX",
  "adsenseClientId": "ca-pub-XXXXXXXXXXXXXXXX"
}
```

- `googleAnalyticsId` — GA4 Measurement ID, validated against `^G-[A-Z0-9]+$`.
- `adsenseClientId` — AdSense Publisher ID, validated against `^ca-pub-\d+$`.

Each field is optional; leave a value empty to disable that channel. Environment variables override the config (useful for CI or staging): `CST_GA_MEASUREMENT_ID` and `CST_ADSENSE_CLIENT_ID`.

### Behavior

- **Production only.** Injection is disabled whenever `NODE_ENV=development`, so local/dev builds (`npm run dev`, `npm run build:dev`) never load trackers or ads — matching the existing `siteBaseUrl` gating.
- **AdSense uses Auto ads.** Only the AdSense head snippet is emitted; ad placement is managed from the AdSense dashboard, so no per-tool markup is required.
- **AdSense loads lazily.** Rather than requesting the ~290 KB `adsbygoogle.js` loader synchronously on load (the dominant page weight and main-thread cost), the head emits a tiny inline bootstrap that injects the loader on the first user interaction (`scroll`/`mousemove`/`keydown`/`touchstart`/`pointerdown`) or after a 3.5 s idle fallback — whichever comes first. Auto ads behave identically once the loader runs; this only keeps it off the critical render path. The ad/analytics origins are warmed with `<link rel="preconnect">` so the deferred request still connects quickly.
- **`ads.txt`** is generated into the build root (alongside `robots.txt`/`sitemap.xml`) **only when** an AdSense client id is configured, and is then auto-added to the deployable root assets. Its publisher record is derived from the client id: `google.com, pub-XXXX, DIRECT, f08c47fec0942fa0`.

### Manual dashboard steps (one-time)

These happen outside the repo, in the Google dashboards:

1. **AdSense** — add and verify `tools.codesamplez.com`, then enable **Auto ads**.
2. **AdSense privacy** — configure the GDPR/EU consent message (there is no in-repo consent banner; the site relies on AdSense's built-in message).
3. **GA4** — no extra setup beyond supplying the Measurement ID.

The CloudFront Function deployment uses the existing GitHub Actions AWS credentials and `CLOUDFRONT_DISTRIBUTION_ID` secret. Those credentials need permission for `cloudfront:DescribeFunction`, `cloudfront:CreateFunction`, `cloudfront:UpdateFunction`, `cloudfront:TestFunction`, `cloudfront:PublishFunction`, `cloudfront:GetFunction`, `cloudfront:GetDistributionConfig`, and `cloudfront:UpdateDistribution`.

## Social Sharing

Individual tool pages render a floating social share rail (`common/app-shell/ShareBar.tsx`) — X, LinkedIn, Reddit, Facebook, plus a copy-link button. It is theme-aware (reuses the shell's iris/dark tokens), fixed to the left edge on wide viewports, and collapses to a horizontal bar above the footer below 1200px.

- It is server-rendered into `#app-shell-share` by `scripts/tool-document.js` and re-rendered on the client by `common/app-shell/mountToolShell.tsx`, which derives the share URL from `window.location` (no per-tool config).
- The tools index has no share rail; the bar mounts only on standalone tool pages.

## SEO & Social Metadata

Every generated page ships a consistent SEO/social head, built server-side so crawlers see the full markup without executing JS.

- **`<title>`** carries an SEO/CTR variant distinct from the on-page `<h1>` and `og:title` (which stay the plain page name). Tool pages render `<SEO title> | Free Online Dev Tools by CodeSamplez`; the landing page renders `<Page title> | CodeSamplez`. The brand suffix comes from `organization.name` in `config/tooling-root.json`. By default the tool's `<SEO title>` is its plain name, but a tool can set an optional `seoTitle` in its `tool.meta.json` to render a keyword-rich title (e.g. diff-checker's `Diff Checker - Compare Text & Code Instantly`) without changing the visible `<h1>`, `og:title`, or structured-data names. The format lives in `formatToolDocumentTitle` / `formatRootDocumentTitle` (`scripts/document-helpers.js`).
- **Open Graph / Twitter cards** — both the landing page and every tool page emit `og:image`, `og:image:alt`, `og:image:width`/`height` (1200×630), and `twitter:card=summary_large_image` with `twitter:image`. Tool pages use their own `images/featured.png`; the landing page uses the root `og-home.png`.
- **Social card images** are generated by `npm run og:images` (`scripts/generate-og-images.mjs`) — a reproducible Playwright art step that renders branded 1200×630 cards for each tool plus the landing page (`og-home.png`). The PNGs are committed; CI never regenerates them. The landing card's filename is configured via `rootPage.image`.
- **Structured data (JSON-LD)** is assembled in `scripts/structured-data.js`:
  - A single `Organization` node (name, logo, `sameAs` social profiles) from `config/tooling-root.json` is emitted on every page and referenced as `publisher` by the `WebSite`, `CollectionPage`, and tool `WebPage` nodes, giving search engines a stable brand entity.
  - Tool pages add `WebPage` + `WebApplication`/`SoftwareApplication` (an optional `featureList` can be attached) + `BreadcrumbList` (+ `FAQPage` when FAQ items exist, + `HowTo` when step-by-step data exists); the landing page adds `CollectionPage` + `ItemList` over all tools. A tool opts into `FAQPage`/`HowTo`/`featureList` by exporting `FAQ_ITEMS`/`HOWTO_STEPS`/`FEATURE_LIST` from its `content.tsx` and registering them in `scripts/tool-faq-metadata.js` / `scripts/tool-howto-metadata.js` / `scripts/tool-feature-metadata.js`.
- **Canonical, sitemap, robots, llms.txt** — each page self-references `<link rel="canonical">`; `sitemap.xml` lists the landing page and every tool URL; `robots.txt` allows all and points at the sitemap; `llms.txt` gives AI assistants and generative-search crawlers a plain-text manifest of every live tool page, grouped by catalog group (crawler policy in `docs/ai-crawler-policy.md`). All three are generated by `scripts/generated-site-assets.js`.
- **Image sitemap** — each `sitemap.xml` URL carries an `<image:image>` entry (the page's social/featured image with title + caption) under the `sitemap-image` namespace, surfacing the cards to Google Images. Built in `scripts/generated-site-assets.js`.
- **Branded 404** — `scripts/error-document.js` generates a `404.html` (emitted beside the root `index.html` by the generated-HTML plugin and shipped as a root asset). It reuses the landing-page shell (header/footer hydrate from the root-shell bundle), is marked `noindex, follow`, and carries no canonical/structured-data of its own. GA still loads so soft-404 hits are tracked.
  - **CloudFront wiring (one-time, outside the repo):** the distribution needs custom error responses mapping **403** and **404** origin responses to `/404.html` with response code `404`. The S3 REST origin returns 403/404 for unmatched keys, so without this the user sees a raw S3 error instead of the branded page. This mirrors the other one-time dashboard steps (AdSense/GA) — the repo only ships the page and the `codesamplez-tools-rewrite-static-urls` function.

## Tool Release Metadata

- List per-tool versions: `npm run tool:versions`
- Bump a tool version: `npm run tool:version:bump -- --tool jwt-decoder-tool --release patch`
- Create a release tag: `npm run tool:tag-release -- --tool jwt-decoder-tool`

Per-tool versions are tracked in tool-local `tool.meta.json` files as deployment release metadata, not as separate npm package versions.

## Quality Gates

Required local and CI gates:

- `npm run typecheck`
- `npm test`
- `npm run audit:deps`
- `npm run build`
- `npm run verify-build`
- `npm run bundle-budget-check` (enforces the main bundle per tool; worker/code-split chunks are reported in the `Async` column for visibility but not enforced)

Supporting and report-oriented checks:

- `npm run bundle-metrics` (reports main bundle, CSS, HTML, and worker/code-split `Async JS` chunk totals per tool)
- `npm run qa:a11y:foundation`
- `npm run qa:cross-browser`
- Review the PR visual diff workflow when a change affects UI or layout
- Review the main-branch visual baseline publish result when shared UI changes land

Visual baseline publishing and PR visual diffs are CI-managed workflows in this repository rather than local npm scripts. They run on the [snapdrift](https://github.com/ranacseruet/snapdrift) actions configured against snapdrift's **hosted Snap backend** (`provider: "snap"` in `.github/snapdrift.json`): baselines are stored durably in the hosted service (not as expiring GitHub artifacts), and each PR comment links to the Snap dashboard ("View in dashboard →") where the captured frames and diffs can be reviewed. The integration authenticates with the `SNAP_API_KEY` repository secret. The per-PR visual diff runs as a `visual-diff` job in the main CI workflow, gated on the `test-and-build` job passing — it won't run (or post a comment) until typecheck, tests, audit, budget, and build all succeed. After every successful `main` build, the dedicated baseline job performs a fresh unscoped build and captures all 22 configured route/viewport identities; only PR diffs may use route scoping. That is approximately 22 hosted renders per successful main merge, so the Snap project quota must cover the repository's merge rate. The job skips a stale branch-head candidate, and Snap's monotonic publication sequence prevents an older overlapping run from replacing a newer baseline. The scheduled health workflow intentionally performs a local report-only smoke capture and is not a hosted baseline publisher. An on-demand `PR Visual Diff (manual)` workflow is available via `workflow_dispatch` to force a diff without pushing a new commit. To validate UI changes before pushing, you can also run the `snapdrift` CLI locally (`npx snapdrift diff --open`) against a local `npm start`.

## Dependency Overrides

`package.json` carries an `overrides` block that forces patched versions of transitive
dependencies the direct dependency tree would otherwise resolve lower. Two rules apply
when editing it:

- **An override for a package that is also a direct dependency must use the `$name`
  reference form** (for example `"js-yaml": "$js-yaml"`), never a literal range. npm
  rejects a literal override whose spec differs from the direct dependency with
  `EOVERRIDE: Override for <pkg>@<version> conflicts with direct dependency`, which
  fails every Dependabot run that tries to bump that package. The `$name` form resolves
  to whatever the direct dependency declares, so the two can never drift apart.
- **Check what an override is holding up before removing it.** An entry that looks
  redundant next to a matching direct dependency is usually still pinning a transitive
  consumer. `js-yaml` is the current example: `@istanbuljs/load-nyc-config` requests
  `^3.13.1`, so dropping the override re-introduces a nested js-yaml 3.x alongside the
  direct 4.x. Verify with `npm ls <pkg> --all` before and after any change.

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
