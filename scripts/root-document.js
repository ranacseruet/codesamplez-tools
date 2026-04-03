// @ts-check

const { escapeAttribute, escapeHtml } = require('./document-helpers');
const { getGroupedToolDefinitions, loadManifest } = require('./tool-manifest');
const { buildRootStructuredDataGraph, renderStructuredDataScript } = require('./structured-data');

/**
 * @typedef {import('./tool-manifest').ToolDefinition} ToolDefinition
 */

/**
 * @param {ToolDefinition} tool
 * @returns {string}
 */
function getRootRelativeToolPath(tool) {
    return tool.publicPath.replace(/^\//, '');
}

/**
 * @param {ToolDefinition} tool
 * @returns {string}
 */
function renderToolCard(tool) {
    const relativeToolPath = getRootRelativeToolPath(tool);
    const imagePath = `${relativeToolPath}${tool.featuredImagePath}`;

    return `      <article class="tool-card">
        <div class="tool-thumbnail">
          <img src="${escapeAttribute(imagePath)}" alt="${escapeAttribute(`${tool.title} featured image`)}">
        </div>
        <div class="tool-content">
          <h3 class="tool-name">${escapeHtml(tool.title)}</h3>
          <p class="tool-description">${escapeHtml(tool.indexDescription)}</p>
          <a href="${escapeAttribute(relativeToolPath)}" class="cta-button">Try Tool</a>
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

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(manifest.rootPage.title)}</title>
  <meta name="description" content="${escapedDescription}">
  <link rel="canonical" href="${escapedCanonical}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  <meta property="og:url" content="${escapedCanonical}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDescription}">
  <link rel="stylesheet" href="root-shell/styles.main.css">
  <link rel="stylesheet" href="styles.css">
  ${structuredDataScript}
</head>
<body class="landing-page">
  <div id="app-shell-header"></div>

  <main class="main-container" aria-label="Tools index">
    <h2 class="main-title">${escapeHtml(manifest.rootPage.title)}</h2>
    
${groupedTools.map((group) => `    <section aria-labelledby="${escapeAttribute(`group-${group.id}`)}">
      <h2 class="section-title" id="${escapeAttribute(`group-${group.id}`)}">${escapeHtml(group.label)}</h2>
      <div class="tools-grid">
${group.tools.map((tool) => renderToolCard(tool)).join('\n')}
      </div>
    </section>`).join('\n\n')}

  </main>

  <div id="app-shell-footer"></div>
  <script src="root-shell/bundle.main.js" defer></script>
</body>
</html>
`;
}

module.exports = {
    generateRootDocument
};
