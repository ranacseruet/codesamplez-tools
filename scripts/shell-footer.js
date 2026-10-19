// @ts-check

const { buildAbsoluteUrl } = require('./tool-manifest');
const { ensureBabelRegister } = require('./register-node-transforms');

/**
 * Prerender the shared site footer. Tool pages, the tools index, the 404 page,
 * and the privacy page all use this so the Privacy link is in the HTML before
 * the client shell re-renders the same component.
 * @param {string} homeHref Absolute tools-index URL for this build.
 * @returns {string}
 */
function renderShellFooterMarkup(homeHref) {
    ensureBabelRegister();

    const { h } = require('preact');
    const renderToString = /** @type {(node: import('preact').VNode) => string} */ (
        /** @type {unknown} */ (require('preact-render-to-string'))
    );
    const { ToolShellFooter } = require('../common/app-shell/AppShell');

    return renderToString(h(ToolShellFooter, {
        homeHref,
        privacyHref: buildAbsoluteUrl(homeHref, '/privacy/')
    }));
}

module.exports = {
    renderShellFooterMarkup
};
