// @ts-check

const { getToolById } = require('./tool-manifest');
const { renderRelatedToolsPrerenderMarkup, renderToolPrerenderMarkup } = require('./prerender-tool');

/**
 * @typedef {import('./tool-manifest').ToolDefinition} ToolDefinition
 */

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeAttribute(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
}

/**
 * @param {string} baseUrl
 * @param {string} pathName
 * @returns {string}
 */
function joinUrl(baseUrl, pathName) {
    return new URL(pathName.replace(/^\.\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

/**
 * @param {ToolDefinition} tool
 * @param {string} prerenderedMarkup
 * @param {string} relatedToolsMarkup
 * @returns {string}
 */
function renderToolDocument(tool, prerenderedMarkup, relatedToolsMarkup = '') {
    const absolutePageUrl = joinUrl(tool.siteBaseUrl, tool.publicPath);
    const absoluteFeaturedImageUrl = joinUrl(tool.siteBaseUrl, `${tool.publicPath.replace(/\/$/, '')}/${tool.featuredImagePath}`);
    const escapedTitle = escapeAttribute(tool.title);
    const escapedDescription = escapeAttribute(tool.description);
    const escapedAppRootId = escapeAttribute(tool.appRootId);
    const escapedPageUrl = escapeAttribute(absolutePageUrl);
    const escapedFeaturedImagePath = escapeAttribute(tool.featuredImagePath);
    const escapedFeaturedImageUrl = escapeAttribute(absoluteFeaturedImageUrl);
    const escapedFeaturedAlt = escapeAttribute(`${tool.title} featured image`);
    const scriptTypeAttribute = tool.scriptType === 'module' ? ' type="module"' : '';

    return `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(tool.title)}</title>
    <meta name="description" content="${escapedDescription}">
    <link rel="canonical" href="${escapedPageUrl}">
    <link rel="stylesheet" href="styles.main.css">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapedTitle}">
    <meta property="og:description" content="${escapedDescription}">
    <meta property="og:url" content="${escapedPageUrl}">
    <meta property="og:image" content="${escapedFeaturedImageUrl}">
    <meta property="og:image:alt" content="${escapedFeaturedAlt}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapedTitle}">
    <meta name="twitter:description" content="${escapedDescription}">
    <meta name="twitter:image" content="${escapedFeaturedImageUrl}">
    <meta name="twitter:image:alt" content="${escapedFeaturedAlt}">
    <link rel="image_src" href="${escapedFeaturedImagePath}">
</head>

<body class="standalone-app">
    <div id="app-shell-header"></div>
    <div id="${escapedAppRootId}">${prerenderedMarkup}</div>
    ${relatedToolsMarkup}
    <div id="app-shell-footer"></div>
    <script src="bundle.main.js"${scriptTypeAttribute}></script>
</body>

</html>
`;
}

/**
 * @param {string} toolId
 * @returns {string}
 */
function generateToolDocument(toolId) {
    const tool = getToolById(toolId);
    if (!tool) {
        throw new Error(`Unknown tool id: ${toolId}`);
    }

    return renderToolDocument(tool, renderToolPrerenderMarkup(toolId), renderRelatedToolsPrerenderMarkup(toolId));
}

module.exports = {
    generateToolDocument,
    joinUrl,
    renderToolDocument
};
