// @ts-check

const { buildAbsoluteUrl } = require('./tool-manifest');
const { escapeAttribute, escapeHtml } = require('./document-helpers');
const { getGroupedToolDefinitions, loadManifest } = require('./tool-manifest');
const { renderRootPageIntro, renderRootPagePostIndexSections } = require('./root-page-content');
const { buildRootStructuredDataGraph, renderStructuredDataScript } = require('./structured-data');
const { renderAnalyticsHeadMarkup } = require('./analytics');
const { renderInlineIcon } = require('./lucide-icons');

const THEME_COLOR = '#f7f7fa';

// Pre-paint theme init: apply the saved theme (default light) before CSS paints
// so the choice persists across pages with no flash. Must run before stylesheets.
const THEME_INIT_SCRIPT = `<script>(function(){try{var t=localStorage.getItem('cst-standalone-theme-mode');var m=t==='dark'?'dark':'light';var e=document.documentElement;e.setAttribute('data-theme',m);e.setAttribute('data-cst-theme',m);}catch(e){}})();</script>`;

// v2 design system: self-hosted Geist fonts (icons are inlined SVGs — no CDN).
// Preloads use the configured static-root absolute URL so they resolve to the
// same asset origin as the stylesheets (pages and assets can be cross-origin).
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
 * @typedef {import('./tool-manifest').ToolDefinition} ToolDefinition
 */

/**
 * @param {ToolDefinition} tool
 * @returns {string}
 */
function renderToolCard(tool) {
    const iconName = tool.icon || 'wrench';
    const isLive = tool.status !== 'soon';
    const statusLabel = isLive ? 'Live' : 'Soon';
    const statusModifier = isLive ? 'tool-status--live' : 'tool-status--soon';
    return `      <article class="tool-card">
        <div class="tool-card__head">
          <span class="tool-icon-tile" aria-hidden="true">${renderInlineIcon(iconName)}</span>
          <span class="tool-status ${statusModifier}">${escapeHtml(statusLabel)}</span>
        </div>
        <div class="tool-content">
          <h3 class="tool-name">${escapeHtml(tool.title)}</h3>
          <p class="tool-description">${escapeHtml(tool.indexDescription)}</p>
          <a href="${escapeAttribute(tool.absolutePageUrl)}" class="cta-button">Try Tool${renderInlineIcon('arrow-right')}</a>
        </div>
      </article>`;
}

/**
 * @returns {string}
 */
function generateRootDocument() {
    const manifest = loadManifest();
    const groupedTools = getGroupedToolDefinitions();
    const structuredDataScript = renderStructuredDataScript(buildRootStructuredDataGraph(manifest));
    const analyticsHeadMarkup = renderAnalyticsHeadMarkup(manifest.analytics);
    const escapedTitle = escapeAttribute(manifest.rootPage.title);
    const escapedDescription = escapeAttribute(manifest.rootPage.description);
    const escapedCanonical = escapeAttribute(manifest.rootPage.absoluteUrl);
    const escapedSiteName = escapeAttribute(manifest.siteName);
    const escapedRootShellStylesUrl = escapeAttribute(buildAbsoluteUrl(manifest.siteStaticRootUri, '/root-shell/styles.main.css'));
    const escapedRootStylesUrl = escapeAttribute(buildAbsoluteUrl(manifest.siteStaticRootUri, '/styles.css'));
    const escapedRootShellBundleUrl = escapeAttribute(buildAbsoluteUrl(manifest.siteStaticRootUri, '/root-shell/bundle.main.js'));

    return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${THEME_INIT_SCRIPT}
  <title>${escapeHtml(manifest.rootPage.title)}</title>
  <meta name="description" content="${escapedDescription}">
  <meta name="theme-color" content="${THEME_COLOR}">
  ${renderFaviconLinks(manifest.siteStaticRootUri)}
  ${renderFontPreloads(manifest.siteStaticRootUri)}
  <link rel="canonical" href="${escapedCanonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapedSiteName}">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  <meta property="og:url" content="${escapedCanonical}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDescription}">
  <link rel="stylesheet" href="${escapedRootShellStylesUrl}">
  <link rel="stylesheet" href="${escapedRootStylesUrl}">
  ${structuredDataScript}${analyticsHeadMarkup ? `\n  ${analyticsHeadMarkup}` : ''}
</head>
<body class="landing-page">
  <div id="app-shell-header"></div>

  <main class="main-container" aria-label="Tools index">
    <h1 class="main-title">${escapeHtml(manifest.rootPage.title)}</h1>

${renderRootPageIntro()}

${groupedTools.map((group) => `    <section aria-labelledby="${escapeAttribute(`group-${group.id}`)}">
      <h2 class="section-title" id="${escapeAttribute(`group-${group.id}`)}">${escapeHtml(group.label)}</h2>
      <div class="tools-grid">
${group.tools.map((tool) => renderToolCard(tool)).join('\n')}
      </div>
    </section>`).join('\n\n')}

${renderRootPagePostIndexSections()}

  </main>

  <div id="app-shell-footer"></div>
  <script src="${escapedRootShellBundleUrl}" defer></script>
</body>
</html>
`;
}

module.exports = {
    generateRootDocument
};
