// @ts-check

const { buildAbsoluteUrl, loadManifest } = require('./tool-manifest');
const { escapeAttribute, escapeHtml, formatRootDocumentTitle } = require('./document-helpers');
const { renderAnalyticsHeadMarkup } = require('./analytics');
const { renderInlineIcon } = require('./lucide-icons');

const THEME_COLOR = '#f7f7fa';

// Pre-paint theme init: apply the saved theme (default light) before CSS paints
// so the choice persists across pages with no flash. Must run before stylesheets.
const THEME_INIT_SCRIPT = `<script>(function(){try{var t=localStorage.getItem('cst-standalone-theme-mode');var m=t==='dark'?'dark':'light';var e=document.documentElement;e.setAttribute('data-theme',m);e.setAttribute('data-cst-theme',m);}catch(e){}})();</script>`;

const NOT_FOUND_TITLE = 'Page Not Found';
const NOT_FOUND_DESCRIPTION = 'The page you were looking for does not exist. Head back to the CodeSamplez developer tools to keep working.';

// v2 design system: self-hosted Geist fonts (icons are inlined SVGs — no CDN).
function renderFontPreloads(staticRootUri) {
    return ['Geist-Variable.woff2', 'GeistMono-Variable.woff2']
        .map((file) => `<link rel="preload" href="${escapeAttribute(buildAbsoluteUrl(staticRootUri, `/fonts/${file}`))}" as="font" type="font/woff2" crossorigin>`)
        .join('\n  ');
}

// Favicons resolve against the configured static-root absolute URL (same origin
// as the stylesheets/fonts). SVG is the primary icon; ICO/PNG are fallbacks.
function renderFaviconLinks(staticRootUri) {
    return [
        `<link rel="icon" href="${escapeAttribute(buildAbsoluteUrl(staticRootUri, '/favicon.ico'))}" sizes="any">`,
        `<link rel="icon" type="image/svg+xml" href="${escapeAttribute(buildAbsoluteUrl(staticRootUri, '/favicon.svg'))}">`,
        `<link rel="apple-touch-icon" href="${escapeAttribute(buildAbsoluteUrl(staticRootUri, '/apple-touch-icon.png'))}">`
    ].join('\n  ');
}

/**
 * Renders the branded 404 page served by CloudFront's custom error response for
 * unmatched paths. It reuses the landing-page shell (header/footer hydrate from
 * the root-shell bundle) but is marked noindex so search engines never index the
 * soft-404, and it carries no canonical/structured-data of its own.
 * @returns {string}
 */
function generateNotFoundDocument() {
    const manifest = loadManifest();
    const analyticsHeadMarkup = renderAnalyticsHeadMarkup(manifest.analytics);
    const documentTitle = formatRootDocumentTitle(NOT_FOUND_TITLE, manifest.organization.name);
    const escapedHomeUrl = escapeAttribute(manifest.rootPage.absoluteUrl);
    const escapedDescription = escapeAttribute(NOT_FOUND_DESCRIPTION);
    const escapedRootShellStylesUrl = escapeAttribute(buildAbsoluteUrl(manifest.siteStaticRootUri, '/root-shell/styles.main.css'));
    const escapedRootStylesUrl = escapeAttribute(buildAbsoluteUrl(manifest.siteStaticRootUri, '/styles.css'));
    const escapedRootShellBundleUrl = escapeAttribute(buildAbsoluteUrl(manifest.siteStaticRootUri, '/root-shell/bundle.main.js'));

    return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${THEME_INIT_SCRIPT}
  <title>${escapeHtml(documentTitle)}</title>
  <meta name="description" content="${escapedDescription}">
  <meta name="robots" content="noindex, follow">
  <meta name="theme-color" content="${THEME_COLOR}">
  ${renderFaviconLinks(manifest.siteStaticRootUri)}
  ${renderFontPreloads(manifest.siteStaticRootUri)}
  <link rel="stylesheet" href="${escapedRootShellStylesUrl}">
  <link rel="stylesheet" href="${escapedRootStylesUrl}">${analyticsHeadMarkup ? `\n  ${analyticsHeadMarkup}` : ''}
</head>
<body class="landing-page">
  <div id="app-shell-header"></div>

  <main class="main-container" aria-label="Page not found">
    <h1 class="main-title">404 — Page Not Found</h1>
    <p class="section-intro">${escapeHtml(NOT_FOUND_DESCRIPTION)}</p>
    <p><a href="${escapedHomeUrl}" class="cta-button">Browse all tools${renderInlineIcon('arrow-right')}</a></p>
  </main>

  <div id="app-shell-footer"></div>
  <script src="${escapedRootShellBundleUrl}" defer></script>
</body>
</html>
`;
}

module.exports = {
    generateNotFoundDocument
};
