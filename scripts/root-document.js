// @ts-check

const { buildAbsoluteUrl } = require('./tool-manifest');
const { escapeAttribute, escapeHtml } = require('./document-helpers');
const { getGroupedToolDefinitions, loadManifest } = require('./tool-manifest');
const { renderRootPageIntro, renderRootPagePostIndexSections } = require('./root-page-content');
const { buildRootStructuredDataGraph, renderStructuredDataScript } = require('./structured-data');

const THEME_COLOR = '#f7f7fa';

// v2 design system: Geist webfonts + Lucide icons, loaded from CDN.
const DESIGN_SYSTEM_HEAD_ASSETS = `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap">
  <script src="https://unpkg.com/lucide@latest" defer></script>`;

/**
 * @typedef {import('./tool-manifest').ToolDefinition} ToolDefinition
 */

/**
 * @param {ToolDefinition} tool
 * @returns {string}
 */
function renderToolCard(tool) {
    return `      <article class="tool-card">
        <div class="tool-thumbnail">
          <img src="${escapeAttribute(tool.absoluteFeaturedImageUrl)}" alt="${escapeAttribute(`${tool.title} featured image`)}">
        </div>
        <div class="tool-content">
          <h3 class="tool-name">${escapeHtml(tool.title)}</h3>
          <p class="tool-description">${escapeHtml(tool.indexDescription)}</p>
          <a href="${escapeAttribute(tool.absolutePageUrl)}" class="cta-button">Try Tool<i data-lucide="arrow-right" class="cst-icon" aria-hidden="true"></i></a>
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
  <title>${escapeHtml(manifest.rootPage.title)}</title>
  <meta name="description" content="${escapedDescription}">
  <meta name="theme-color" content="${THEME_COLOR}">
  ${DESIGN_SYSTEM_HEAD_ASSETS}
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
  ${structuredDataScript}
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
