// @ts-check

const { escapeAttribute, escapeJsonForHtml } = require('./document-helpers');

// AdSense ads.txt authorization record fields. The publisher number is derived
// from the AdSense client id by stripping its "ca-" prefix (ca-pub-XXXX → pub-XXXX).
const ADS_TXT_EXCHANGE = 'google.com';
const ADS_TXT_RELATIONSHIP = 'DIRECT';
const ADS_TXT_CERTIFICATION_ID = 'f08c47fec0942fa0';

// Short pause, in milliseconds, so the European regulations message can call
// gtag('consent','update',...) before tags send. Google's documented example.
const CONSENT_MODE_WAIT_FOR_UPDATE_MS = 500;

// ISO 3166-1 alpha-2. The EEA is the EU plus Iceland, Liechtenstein, and Norway.
// The UK's code is GB. Switzerland is CH. No global default is set: visitors
// outside this list keep the current granted behavior.
const CONSENT_DENIED_REGIONS = Object.freeze([
    'AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR',
    'GB', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MT',
    'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'
]);

// IANA zones for those same places. Used only to decide whether adsbygoogle.js
// (which delivers the message) loads immediately. Consent itself is decided by
// the region list above, inside gtag, not by the clock.
const REGULATED_TIME_ZONES = Object.freeze([
    'Africa/Ceuta',
    'Asia/Famagusta',
    'Asia/Nicosia',
    'Atlantic/Azores',
    'Atlantic/Canary',
    'Atlantic/Madeira',
    'Atlantic/Reykjavik',
    'Europe/Amsterdam',
    'Europe/Athens',
    'Europe/Berlin',
    'Europe/Bratislava',
    'Europe/Brussels',
    'Europe/Bucharest',
    'Europe/Budapest',
    'Europe/Busingen',
    'Europe/Copenhagen',
    'Europe/Dublin',
    'Europe/Helsinki',
    'Europe/Lisbon',
    'Europe/Ljubljana',
    'Europe/London',
    'Europe/Luxembourg',
    'Europe/Madrid',
    'Europe/Malta',
    'Europe/Mariehamn',
    'Europe/Oslo',
    'Europe/Paris',
    'Europe/Prague',
    'Europe/Riga',
    'Europe/Rome',
    'Europe/Sofia',
    'Europe/Stockholm',
    'Europe/Tallinn',
    'Europe/Vaduz',
    'Europe/Vienna',
    'Europe/Vilnius',
    'Europe/Warsaw',
    'Europe/Zagreb',
    'Europe/Zurich'
]);

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
 * Consent Mode v2 default, queued before gtag('config') and before adsbygoogle.js.
 * The four storage flags are denied only for {@link CONSENT_DENIED_REGIONS}.
 * The referrer policy stays the browser default `strict-origin-when-cross-origin`;
 * this snippet does not set a stricter one. The message needs that default.
 * @returns {string}
 */
function renderConsentDefaultStatements() {
    const regionJson = escapeJsonForHtml(JSON.stringify(CONSENT_DENIED_REGIONS));
    return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;gtag('consent','default',{'ad_storage':'denied','ad_user_data':'denied','ad_personalization':'denied','analytics_storage':'denied','region':${regionJson},'wait_for_update':${CONSENT_MODE_WAIT_FOR_UPDATE_MS}});`;
}

/**
 * GA4 gtag.js loader + inline bootstrap. Async so it never blocks paint.
 * Consent defaults are queued before `gtag('config')` and before the script
 * request. gtag.js is injected only when `location.hostname` matches the
 * siteBaseUrl host, and `window.gtag` stays unset otherwise.
 * @param {string} googleAnalyticsId
 * @param {string | undefined} siteBaseUrl
 * @returns {string}
 */
function renderGoogleAnalyticsMarkup(googleAnalyticsId, siteBaseUrl) {
    const escapedId = escapeAttribute(googleAnalyticsId).replace(/'/g, '\\u0027');
    const hostGate = renderAnalyticsHostGate(siteBaseUrl);
    return `<script>(function(){${hostGate}${renderConsentDefaultStatements()}gtag('js',new Date());gtag('config','${escapedId}');var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${escapedId}';(document.head||document.documentElement).appendChild(s);})();</script>`;
}

// Idle delay (ms) after which the AdSense loader is injected even if the visitor
// has not interacted yet — keeps Auto ads viewable/monetised on bounce/scroll-less
// sessions while still keeping the ~290 KB of ad JS off the critical path.
const ADSENSE_IDLE_DELAY_MS = 3500;

/**
 * AdSense Auto ads loader. Placement stays in the AdSense dashboard. The same
 * script delivers the European regulations message, so visitors whose time zone
 * is in the EEA, the UK, or Switzerland get it immediately. Everywhere else the
 * request still waits for the first interaction or {@link ADSENSE_IDLE_DELAY_MS},
 * so ads outside those places keep today's timing. The loader is never a
 * render-blocking `<script src>`. The host gate matches GA4.
 * @param {string} adsenseClientId
 * @param {string | undefined} siteBaseUrl
 * @returns {string}
 */
function renderAdsenseMarkup(adsenseClientId, siteBaseUrl) {
    const loaderSrc = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`;
    const jsSafeSrc = escapeJsonForHtml(JSON.stringify(loaderSrc));
    const zonesJson = escapeJsonForHtml(JSON.stringify(REGULATED_TIME_ZONES));
    const hostGate = renderAnalyticsHostGate(siteBaseUrl);
    return `<script>(function(){${hostGate}${renderConsentDefaultStatements()}var d=document,loaded=false,events=['scroll','mousemove','keydown','touchstart','pointerdown'];function load(){if(loaded){return;}loaded=true;events.forEach(function(e){window.removeEventListener(e,load);});var s=d.createElement('script');s.async=true;s.crossOrigin='anonymous';s.src=${jsSafeSrc};(d.head||d.documentElement).appendChild(s);}var zone='';try{zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(e){}if(${zonesJson}.indexOf(zone)!==-1){load();return;}events.forEach(function(e){window.addEventListener(e,load,{passive:true,once:true});});setTimeout(load,${ADSENSE_IDLE_DELAY_MS});})();</script>`;
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
    CONSENT_DENIED_REGIONS,
    CONSENT_MODE_WAIT_FOR_UPDATE_MS,
    REGULATED_TIME_ZONES,
    TRACKER_MARKUP_MARKERS,
    buildAdsTxt,
    findTrackerMarkupOffenders,
    renderAdsenseMarkup,
    renderAnalyticsHeadMarkup,
    renderAnalyticsResourceHints,
    renderGoogleAnalyticsMarkup
};
