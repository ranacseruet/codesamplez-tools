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
    return new URL(pathName.replace(/^\.\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
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

module.exports = {
    escapeAttribute,
    escapeHtml,
    escapeJsonForHtml,
    joinUrl
};
