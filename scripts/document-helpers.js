// @ts-check

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
    return new URL(
        pathName.replace(/^\.\//, '').replace(/^\/+/, ''),
        baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    ).toString();
}

/**
 * @param {string} json
 * @returns {string}
 */
function escapeJsonForHtml(json) {
    return json
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

/**
 * SEO `<title>` for a tool page: SEO title + brand tagline. Kept distinct from the
 * on-page H1 / og:title (which stay the plain tool name) so the SERP snippet can
 * carry a keyword-rich title and brand without altering the visible heading or
 * structured-data names. `seoTitle` is the tool's optional SEO override, falling
 * back to the plain tool name at the call site.
 * @param {string} seoTitle
 * @param {string} brandName
 * @returns {string}
 */
function formatToolDocumentTitle(seoTitle, brandName) {
    return `${seoTitle} | Free Online Dev Tools by ${brandName}`;
}

/**
 * SEO `<title>` for the landing page: page title + brand. The H1 stays the plain
 * page title.
 * @param {string} pageTitle
 * @param {string} brandName
 * @returns {string}
 */
function formatRootDocumentTitle(pageTitle, brandName) {
    return `${pageTitle} | ${brandName}`;
}

module.exports = {
    escapeAttribute,
    escapeHtml,
    escapeJsonForHtml,
    formatRootDocumentTitle,
    formatToolDocumentTitle,
    joinUrl
};
