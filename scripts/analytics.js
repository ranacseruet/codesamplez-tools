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
 * Hostname of the configured site origin. The inline loaders embed this value
 * so the allow-list comes from root `siteBaseUrl`, not a literal host.
 * @param {string | undefined} siteBaseUrl
 * @returns {string}
 */
function resolveAllowedAnalyticsHostname(siteBaseUrl) {
    if (typeof siteBaseUrl !== 'string' || siteBaseUrl.trim().length === 0) {
        throw new Error('Analytics markup requires siteBaseUrl so the allowed host is derived from root config');
    }

    /** @type {string} */
    let hostname;
    try {
        hostname = new URL(siteBaseUrl).hostname;
    } catch (error) {
        throw new Error(`Analytics siteBaseUrl must be a valid absolute URL: ${siteBaseUrl}`);
    }

    if (!hostname) {
        throw new Error(`Analytics siteBaseUrl must include a hostname: ${siteBaseUrl}`);
    }

    return hostname;
}

/**
 * Return from a loader IIFE unless the page is served on the configured host.
 * The check is runtime so a production build opened on localhost, 127.0.0.1,
 * or a CloudFront hostname never requests Google.
 * @param {string | undefined} siteBaseUrl
 * @returns {string}
 */
function renderAnalyticsHostGate(siteBaseUrl) {
    const allowedHost = escapeJsonForHtml(JSON.stringify(resolveAllowedAnalyticsHostname(siteBaseUrl)));
    return `if(location.hostname!==${allowedHost}){return;}`;
}

/**
 * GA4 gtag.js loader + inline bootstrap. Async so it never blocks paint.
 * gtag.js is injected only when `location.hostname` matches the siteBaseUrl host,
 * and `window.gtag` stays unset otherwise.
 * @param {string} googleAnalyticsId
 * @param {string | undefined} siteBaseUrl
 * @returns {string}
 */
function renderGoogleAnalyticsMarkup(googleAnalyticsId, siteBaseUrl) {
    const escapedId = escapeAttribute(googleAnalyticsId).replace(/'/g, '\\u0027');
    const hostGate = renderAnalyticsHostGate(siteBaseUrl);
    return `<script>(function(){${hostGate}window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${escapedId}');var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${escapedId}';(document.head||document.documentElement).appendChild(s);})();</script>`;
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
 * The same host gate as GA4 wraps the loader, so ads are not requested on
 * localhost, 127.0.0.1, or a raw CloudFront domain.
 * @param {string} adsenseClientId
 * @param {string | undefined} siteBaseUrl
 * @returns {string}
 */
function renderAdsenseMarkup(adsenseClientId, siteBaseUrl) {
    const loaderSrc = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`;
    const jsSafeSrc = escapeJsonForHtml(JSON.stringify(loaderSrc));
    const hostGate = renderAnalyticsHostGate(siteBaseUrl);
    return `<script>(function(){${hostGate}var d=document,loaded=false,events=['scroll','mousemove','keydown','touchstart','pointerdown'];function load(){if(loaded){return;}loaded=true;events.forEach(function(e){window.removeEventListener(e,load);});var s=d.createElement('script');s.async=true;s.crossOrigin='anonymous';s.src=${jsSafeSrc};(d.head||d.documentElement).appendChild(s);}events.forEach(function(e){window.addEventListener(e,load,{passive:true,once:true});});setTimeout(load,${ADSENSE_IDLE_DELAY_MS});})();</script>`;
}

/**
 * Early connection warm-up for the analytics/ads third-party origins. Emitted in
 * the document head so the TCP+TLS (and QUIC) handshakes to Google's ad/analytics
 * hosts start before the lazily-injected loaders actually request from them,
 * shaving the connection time off the ad iframe's first byte. The link tags
 * are inserted only on the configured host, so other hosts open no connection.
 * Returns an empty string when neither channel is configured.
 * @param {AnalyticsConfig} [analytics]
 * @param {string | undefined} [siteBaseUrl] Required when an id is configured.
 * @returns {string}
 */
function renderAnalyticsResourceHints(analytics = { googleAnalyticsId: null, adsenseClientId: null }, siteBaseUrl) {
    const hints = [];

    if (analytics.adsenseClientId) {
        hints.push('<link rel="preconnect" href="https://pagead2.googlesyndication.com" crossorigin>');
        hints.push('<link rel="preconnect" href="https://googleads.g.doubleclick.net" crossorigin>');
    }

    if (analytics.googleAnalyticsId) {
        hints.push('<link rel="preconnect" href="https://www.googletagmanager.com">');
    }

    if (hints.length === 0) {
        return '';
    }

    const hostGate = renderAnalyticsHostGate(siteBaseUrl);
    const hintHtml = hints.join('\n  ')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, '\\\'')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    return `<script>(function(){${hostGate}(document.head||document.documentElement).insertAdjacentHTML('beforeend','${hintHtml}');})();</script>`;
}

/**
 * Build the analytics/ads `<head>` markup for a single page. Each id is optional,
 * so partial configuration (GA only, AdSense only, or neither) is supported.
 * Returns an empty string when nothing is configured. Loaders no-op unless the
 * page hostname matches `siteBaseUrl`.
 * @param {AnalyticsConfig} [analytics]
 * @param {string | undefined} [siteBaseUrl] Required when an id is configured.
 * @returns {string}
 */
function renderAnalyticsHeadMarkup(analytics = { googleAnalyticsId: null, adsenseClientId: null }, siteBaseUrl) {
    const parts = [];

    if (analytics.googleAnalyticsId) {
        parts.push(renderGoogleAnalyticsMarkup(analytics.googleAnalyticsId, siteBaseUrl));
    }

    if (analytics.adsenseClientId) {
        parts.push(renderAdsenseMarkup(analytics.adsenseClientId, siteBaseUrl));
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
