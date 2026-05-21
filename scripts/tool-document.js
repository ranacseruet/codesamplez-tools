// @ts-check

const { getToolById, loadManifest } = require('./tool-manifest');
const {
    renderRelatedToolsPrerenderMarkup,
    renderToolAfterAppPrerenderMarkup,
    renderToolBeforeAppPrerenderMarkup,
    renderToolPrerenderMarkup
} = require('./prerender-tool');
const { escapeAttribute, escapeHtml, joinUrl } = require('./document-helpers');
const { buildToolStructuredDataGraph, renderStructuredDataScript } = require('./structured-data');
const { getToolFaqItems } = require('./tool-faq-metadata');
const { ensureBabelRegister } = require('./register-node-transforms');

const THEME_COLOR = '#2563eb';

/**
 * @typedef {import('./tool-manifest').ToolDefinition} ToolDefinition
 */

/**
 * @param {ToolDefinition} tool
 * @param {string} prerenderedMarkup
 * @param {string} relatedToolsMarkup
 * @param {string} beforeAppMarkup
 * @param {string} afterAppMarkup
 * @returns {string}
 */
function renderToolDocument(tool, prerenderedMarkup, relatedToolsMarkup = '', beforeAppMarkup = '', afterAppMarkup = '') {
    const manifest = loadManifest();
    const absolutePageUrl = joinUrl(tool.siteBaseUrl, tool.publicPath);
    const absoluteFeaturedImageUrl = joinUrl(tool.siteStaticRootUri, `${tool.publicPath.replace(/\/$/, '')}/${tool.featuredImagePath}`);
    const absoluteStylesUrl = joinUrl(tool.siteStaticRootUri, `${tool.publicPath.replace(/\/$/, '')}/styles.main.css`);
    const absoluteBundleUrl = joinUrl(tool.siteStaticRootUri, `${tool.publicPath.replace(/\/$/, '')}/bundle.main.js`);
    const escapedTitle = escapeAttribute(tool.title);
    const escapedDescription = escapeAttribute(tool.description);
    const escapedAppRootId = escapeAttribute(tool.appRootId);
    const escapedSiteName = escapeAttribute(manifest.siteName);
    const escapedPageUrl = escapeAttribute(absolutePageUrl);
    const escapedStylesUrl = escapeAttribute(absoluteStylesUrl);
    const escapedBundleUrl = escapeAttribute(absoluteBundleUrl);
    const escapedFeaturedImageUrl = escapeAttribute(absoluteFeaturedImageUrl);
    const escapedFeaturedAlt = escapeAttribute(`${tool.title} featured image`);
    const structuredDataScript = renderStructuredDataScript(buildToolStructuredDataGraph(manifest, tool, {
        faqItems: getToolFaqItems(tool.id)
    }));
    const scriptTypeAttribute = tool.scriptType === 'module' ? ' type="module"' : '';
    const shellHeaderMarkup = renderToolShellHeaderMarkup(tool);
    const wrappedBeforeMarkup = beforeAppMarkup
        ? `<div class="c-tool-static-shell c-tool-static-shell--before">${beforeAppMarkup}</div>`
        : '';
    const wrappedAfterMarkup = afterAppMarkup
        ? `<div class="c-tool-static-shell c-tool-static-shell--after">${afterAppMarkup}</div>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(tool.title)}</title>
    <meta name="description" content="${escapedDescription}">
    <meta name="theme-color" content="${THEME_COLOR}">
    <link rel="canonical" href="${escapedPageUrl}">
    <link rel="stylesheet" href="${escapedStylesUrl}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapedSiteName}">
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
    <link rel="image_src" href="${escapedFeaturedImageUrl}">
    ${structuredDataScript}
</head>

<body class="standalone-app">
    <div id="app-shell-header">${shellHeaderMarkup}</div>
    ${wrappedBeforeMarkup}
    <div id="${escapedAppRootId}">${prerenderedMarkup}</div>
    ${wrappedAfterMarkup}
    ${relatedToolsMarkup}
    <div id="app-shell-footer"></div>
    <script src="${escapedBundleUrl}"${scriptTypeAttribute}></script>
</body>

</html>
`;
}

/**
 * @param {ToolDefinition} tool
 * @returns {string}
 */
function renderToolShellHeaderMarkup(tool) {
    ensureBabelRegister();

    const { h } = require('preact');
    const renderToString = /** @type {(node: import('preact').VNode) => string} */ (
        /** @type {unknown} */ (require('preact-render-to-string'))
    );
    const { ToolShellHeader } = require('../common/app-shell/AppShell');

    return renderToString(h(ToolShellHeader, {
        title: tool.title,
        description: tool.description
    }));
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

    return renderToolDocument(
        tool,
        renderToolPrerenderMarkup(toolId),
        renderRelatedToolsPrerenderMarkup(toolId),
        renderToolBeforeAppPrerenderMarkup(toolId),
        renderToolAfterAppPrerenderMarkup(toolId)
    );
}

module.exports = {
    generateToolDocument,
    joinUrl,
    renderToolDocument,
    renderToolShellHeaderMarkup
};
