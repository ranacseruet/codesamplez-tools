// @ts-check

// Pre-paint theme init: apply the saved theme (default dark) before CSS paints
// so the choice persists across pages with no flash. Must run before stylesheets.
const THEME_INIT_SCRIPT = `<script>(function(){try{var t=localStorage.getItem('cst-standalone-theme-mode');var m=t==='light'?'light':'dark';var e=document.documentElement;e.setAttribute('data-theme',m);e.setAttribute('data-cst-theme',m);}catch(e){}})();</script>`;

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

/** Google truncates titles at about 60 characters. */
const DOCUMENT_TITLE_MAX_LENGTH = 60;

/**
 * SEO `<title>` for a tool page: keyword-first SEO title plus a short brand
 * suffix. Kept distinct from the on-page H1 / og:title (which stay the plain
 * tool name) so the SERP snippet can carry a keyword-rich title and brand
 * without altering the visible heading or structured-data names. `seoTitle` is
 * the tool's optional SEO override, falling back to the plain tool name at the
 * call site. The brand suffix is omitted when it would push the title past
 * {@link DOCUMENT_TITLE_MAX_LENGTH}; callers still have to keep `seoTitle`
 * itself inside that budget.
 * @param {string} seoTitle
 * @param {string} brandName
 * @returns {string}
 */
function formatToolDocumentTitle(seoTitle, brandName) {
    const brandedTitle = `${seoTitle} | ${brandName}`;

    if (brandedTitle.length <= DOCUMENT_TITLE_MAX_LENGTH) {
        return brandedTitle;
    }

    return seoTitle;
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
    DOCUMENT_TITLE_MAX_LENGTH,
    THEME_INIT_SCRIPT,
    escapeAttribute,
    escapeHtml,
    escapeJsonForHtml,
    formatRootDocumentTitle,
    formatToolDocumentTitle,
    joinUrl
};
