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
- Shared tool catalog + root-page metadata: tool-local `tool.meta.json` files plus `config/tooling-root.json`
- Shared design tokens and reusable primitives:
  - `common/material-theme.css`
  - `common/shared-styles.css`
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
- Dev server: `npm run dev`

The build preserves the standalone deployment contract for each tool, prerenders supported tool UI into static HTML before client hydration, and generates the root landing page from manifest metadata rather than a hand-authored source HTML file.

### Subdomain Deployment

Production deploys publish the static build to the `tools.codesamplez.com` S3 bucket behind CloudFront.

Directory-index routing is handled at the CloudFront viewer-request layer by the repo-managed `RewriteStaticURLs` CloudFront Function:

- The source lives at `infrastructure/cloudfront-functions/RewriteStaticURLs.js`.
- CI/CD deploys the function from source when it changes, publishes it to `LIVE`, verifies the live source, and attaches it to the `tools.codesamplez.com` distribution's default cache behavior.
- The function redirects extensionless tool requests such as `/jwt-decoder` to the canonical trailing-slash URL `/jwt-decoder/` while preserving query string parameters, then rewrites trailing-slash requests such as `/` and `/jwt-decoder/` to `/index.html` and `/jwt-decoder/index.html` before the request reaches the S3 REST origin.
- The deployment script syncs each selected tool directory as-is, including `build/<tool>/index.html`; the sync uses `--delete`, so stale tool HTML objects are pruned along with stale JS, CSS, and image assets.
- Root-level assets such as `index.html`, `robots.txt`, `sitemap.xml`, and `ads.txt` (when AdSense is configured) are copied through the root-assets path because they are not inside a tool directory.

The canonical checked build path remains `build/<tool>/index.html`; directory-index behavior belongs in CloudFront rather than duplicate S3 object keys.

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
- **`ads.txt`** is generated into the build root (alongside `robots.txt`/`sitemap.xml`) **only when** an AdSense client id is configured, and is then auto-added to the deployable root assets. Its publisher record is derived from the client id: `google.com, pub-XXXX, DIRECT, f08c47fec0942fa0`.

### Manual dashboard steps (one-time)

These happen outside the repo, in the Google dashboards:

1. **AdSense** — add and verify `tools.codesamplez.com`, then enable **Auto ads**.
2. **AdSense privacy** — configure the GDPR/EU consent message (there is no in-repo consent banner; the site relies on AdSense's built-in message).
3. **GA4** — no extra setup beyond supplying the Measurement ID.

The CloudFront Function deployment uses the existing GitHub Actions AWS credentials and `CLOUDFRONT_DISTRIBUTION_ID` secret. Those credentials need permission for `cloudfront:DescribeFunction`, `cloudfront:CreateFunction`, `cloudfront:UpdateFunction`, `cloudfront:TestFunction`, `cloudfront:PublishFunction`, `cloudfront:GetFunction`, `cloudfront:GetDistributionConfig`, and `cloudfront:UpdateDistribution`.

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
