// @ts-check

const { escapeAttribute } = require('./document-helpers');

// AdSense ads.txt authorization record fields. The publisher number is derived
// from the AdSense client id by stripping its "ca-" prefix (ca-pub-XXXX → pub-XXXX).
const ADS_TXT_EXCHANGE = 'google.com';
const ADS_TXT_RELATIONSHIP = 'DIRECT';
const ADS_TXT_CERTIFICATION_ID = 'f08c47fec0942fa0';

/**
 * @typedef {import('./tool-manifest').AnalyticsConfig} AnalyticsConfig
 */

/**
 * GA4 gtag.js loader + inline bootstrap. Async so it never blocks paint.
 * @param {string} googleAnalyticsId
 * @returns {string}
 */
function renderGoogleAnalyticsMarkup(googleAnalyticsId) {
    const escapedId = escapeAttribute(googleAnalyticsId);
    return `<script async src="https://www.googletagmanager.com/gtag/js?id=${escapedId}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${escapedId}');</script>`;
}

/**
 * AdSense Auto ads loader. Placement is managed entirely from the AdSense
 * dashboard, so the page only needs this single async script tag.
 * @param {string} adsenseClientId
 * @returns {string}
 */
function renderAdsenseMarkup(adsenseClientId) {
    const escapedId = escapeAttribute(adsenseClientId);
    return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${escapedId}" crossorigin="anonymous"></script>`;
}

/**
 * Build the analytics/ads `<head>` markup for a single page. Each id is optional,
 * so partial configuration (GA only, AdSense only, or neither) is supported.
 * Returns an empty string when nothing is configured.
 * @param {AnalyticsConfig} [analytics]
 * @returns {string}
 */
function renderAnalyticsHeadMarkup(analytics = { googleAnalyticsId: null, adsenseClientId: null }) {
    const parts = [];

    if (analytics.googleAnalyticsId) {
        parts.push(renderGoogleAnalyticsMarkup(analytics.googleAnalyticsId));
    }

    if (analytics.adsenseClientId) {
        parts.push(renderAdsenseMarkup(analytics.adsenseClientId));
    }

    return parts.join('\n  ');
}

/**
 * Build the ads.txt body authorizing Google AdSense for this publisher. Returns
 * an empty string when no AdSense client id is configured so callers can skip
 * writing the file entirely.
 * @param {string | null | undefined} adsenseClientId
 * @returns {string}
 */
function buildAdsTxt(adsenseClientId) {
    if (!adsenseClientId) {
        return '';
    }

    const publisherId = adsenseClientId.replace(/^ca-/, '');
    return `${ADS_TXT_EXCHANGE}, ${publisherId}, ${ADS_TXT_RELATIONSHIP}, ${ADS_TXT_CERTIFICATION_ID}`;
}

module.exports = {
    buildAdsTxt,
    renderAdsenseMarkup,
    renderAnalyticsHeadMarkup,
    renderGoogleAnalyticsMarkup
};
