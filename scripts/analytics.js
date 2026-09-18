// @ts-check

const { escapeAttribute, escapeJsonForHtml } = require('./document-helpers');

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

// Idle delay (ms) after which the AdSense loader is injected even if the visitor
// has not interacted yet — keeps Auto ads viewable/monetised on bounce/scroll-less
// sessions while still keeping the ~290 KB of ad JS off the critical path.
const ADSENSE_IDLE_DELAY_MS = 3500;

/**
 * AdSense Auto ads loader, lazily injected. Placement is still managed entirely
 * from the AdSense dashboard, but instead of requesting the ~290 KB adsbygoogle.js
 * synchronously on load (the dominant page-weight/main-thread cost), we defer the
 * request until the first user interaction (scroll/pointer/key/touch) or a short
 * idle fallback — whichever comes first. This unblocks the `load` event and keeps
 * the ad iframe out of the initial render path without losing ad coverage.
 * @param {string} adsenseClientId
 * @returns {string}
 */
function renderAdsenseMarkup(adsenseClientId) {
    const loaderSrc = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`;
    const jsSafeSrc = escapeJsonForHtml(JSON.stringify(loaderSrc));
    return `<script>(function(){var d=document,loaded=false,events=['scroll','mousemove','keydown','touchstart','pointerdown'];function load(){if(loaded){return;}loaded=true;events.forEach(function(e){window.removeEventListener(e,load);});var s=d.createElement('script');s.async=true;s.crossOrigin='anonymous';s.src=${jsSafeSrc};(d.head||d.documentElement).appendChild(s);}events.forEach(function(e){window.addEventListener(e,load,{passive:true,once:true});});setTimeout(load,${ADSENSE_IDLE_DELAY_MS});})();</script>`;
}

/**
 * Early connection warm-up for the analytics/ads third-party origins. Emitted in
 * the document head so the TCP+TLS (and QUIC) handshakes to Google's ad/analytics
 * hosts start before the lazily-injected loaders actually request from them,
 * shaving the connection time off the ad iframe's first byte. Returns an empty
 * string when neither channel is configured.
 * @param {AnalyticsConfig} [analytics]
 * @returns {string}
 */
function renderAnalyticsResourceHints(analytics = { googleAnalyticsId: null, adsenseClientId: null }) {
    const hints = [];

    if (analytics.adsenseClientId) {
        hints.push('<link rel="preconnect" href="https://pagead2.googlesyndication.com" crossorigin>');
        hints.push('<link rel="preconnect" href="https://googleads.g.doubleclick.net" crossorigin>');
    }

    if (analytics.googleAnalyticsId) {
        hints.push('<link rel="preconnect" href="https://www.googletagmanager.com">');
    }

    return hints.join('\n  ');
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

// Markers matching exactly what this module emits (GA4 loader + inline
// bootstrap, lazy AdSense bootstrap, preconnect hints). Scoped to the emitted
// tags rather than bare hostnames so tool article copy that merely mentions
// analytics in prose never trips the check.
const TRACKER_MARKUP_MARKERS = [
    'googletagmanager.com/gtag/js',
    'gtag(\'config\'',
    'pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
    'googleads.g.doubleclick.net'
];

/**
 * Return the filenames whose HTML source contains tracker markup. Pure helper
 * shared by the build-time guards (GeneratedHtmlPlugin for the dev-server
 * path, build-verification for build output) so the marker list lives next to
 * the markup it matches.
 * @param {{ filename: string, source: string }[]} htmlAssets
 * @returns {string[]}
 */
function findTrackerMarkupOffenders(htmlAssets) {
    return htmlAssets
        .filter(({ source }) => TRACKER_MARKUP_MARKERS.some((marker) => source.includes(marker)))
        .map(({ filename }) => filename);
}

module.exports = {
    TRACKER_MARKUP_MARKERS,
    buildAdsTxt,
    findTrackerMarkupOffenders,
    renderAdsenseMarkup,
    renderAnalyticsHeadMarkup,
    renderAnalyticsResourceHints,
    renderGoogleAnalyticsMarkup
};
