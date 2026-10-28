// @ts-check

const { buildAbsoluteUrl, getRootPageDefinition, loadManifest } = require('./tool-manifest');
const { THEME_INIT_SCRIPT, escapeAttribute, escapeHtml, formatRootDocumentTitle } = require('./document-helpers');
const { buildPrivacyStructuredDataGraph, renderStructuredDataScript } = require('./structured-data');
const { renderAnalyticsHeadMarkup, renderAnalyticsResourceHints } = require('./analytics');
const { getBuildCommitAttributeMarkup } = require('./provenance-manifest');
const { renderShellFooterMarkup } = require('./shell-footer');

const THEME_COLOR = '#0b0b11';
const OG_IMAGE_WIDTH = '1200';
const OG_IMAGE_HEIGHT = '630';

const PRIVACY_PUBLIC_PATH = '/privacy/';
const PRIVACY_PAGE_TITLE = 'Privacy Policy';
const PRIVACY_PAGE_DESCRIPTION = 'How CodeSamplez Tools handles input you enter in the browser, and how Google Analytics and Google AdSense use cookies on the published site.';
const PRIVACY_LAST_UPDATED_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const CONTACT_PAGE_URL = 'https://codesamplez.com/contact';
const GOOGLE_ADS_SETTINGS_URL = 'https://adssettings.google.com/';
const GOOGLE_ADS_SETTINGS_OPTOUT_URL = 'https://adssettings.google.com';
const ABOUT_ADS_CHOICES_URL = 'https://www.aboutads.info/choices/';
const GOOGLE_ANALYTICS_OPTOUT_URL = 'https://tools.google.com/dlpage/gaoptout';

/**
 * @param {string} siteBaseUrl
 * @returns {string}
 */
function getPrivacyPageAbsoluteUrl(siteBaseUrl) {
    return buildAbsoluteUrl(siteBaseUrl, PRIVACY_PUBLIC_PATH);
}

/**
 * Visible "Last updated" date. Uses the privacy page's sitemap lastmod (git
 * commit time of the same inputs), not the build clock and not a fixed
 * authoring date. UTC so the calendar day matches the sitemap timestamp.
 * @param {string | null | undefined} lastmodIso
 * @returns {string | null}
 */
function formatPrivacyLastUpdatedLabel(lastmodIso) {
    const date = new Date(lastmodIso || '');

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return `${date.getUTCDate()} ${PRIVACY_LAST_UPDATED_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * @returns {string | null}
 */
function getPrivacyLastUpdatedLabel() {
    // Lazy require: generated-site-assets loads this module for the sitemap entry.
    const { getPrivacyPageLastmodPaths, resolveGitLastmodForPaths } = require('./generated-site-assets');
    const lastmod = resolveGitLastmodForPaths(getPrivacyPageLastmodPaths());

    return formatPrivacyLastUpdatedLabel(lastmod);
}

/**
 * Sitemap/llms.txt view of the privacy page. The image is the site card already
 * used on the tools index — this page has no screenshot of its own.
 * @returns {{ title: string, description: string, absoluteUrl: string, imageUrl: string }}
 */
function getPrivacyPageDefinition() {
    const manifest = loadManifest();
    const rootPage = getRootPageDefinition();

    return {
        title: PRIVACY_PAGE_TITLE,
        description: PRIVACY_PAGE_DESCRIPTION,
        absoluteUrl: getPrivacyPageAbsoluteUrl(manifest.siteBaseUrl),
        imageUrl: rootPage.imageUrl
    };
}

/**
 * @param {string} staticRootUri
 * @returns {string}
 */
function renderFontPreloads(staticRootUri) {
    return ['Geist-Variable.woff2']
        .map((file) => `<link rel="preload" href="${escapeAttribute(buildAbsoluteUrl(staticRootUri, `/fonts/${file}`))}" as="font" type="font/woff2" crossorigin>`)
        .join('\n  ');
}

/**
 * @param {string} staticRootUri
 * @returns {string}
 */
function renderFaviconLinks(staticRootUri) {
    return [
        `<link rel="icon" href="${escapeAttribute(buildAbsoluteUrl(staticRootUri, '/favicon.ico'))}" sizes="any">`,
        `<link rel="icon" type="image/svg+xml" href="${escapeAttribute(buildAbsoluteUrl(staticRootUri, '/favicon.svg'))}">`,
        `<link rel="apple-touch-icon" href="${escapeAttribute(buildAbsoluteUrl(staticRootUri, '/apple-touch-icon.png'))}">`
    ].join('\n  ');
}

/**
 * @param {string} href
 * @param {string} label
 * @returns {string}
 */
function renderLink(href, label) {
    return `<a href="${escapeAttribute(href)}">${escapeHtml(label)}</a>`;
}

/**
 * Policy copy stays inside what the site actually does: browser-side tools,
 * and the GA4 / AdSense scripts the published pages load. Legal basis,
 * retention, a controller address, and a DPO are not stated here.
 * @param {import('./tool-manifest').ToolManifest} manifest
 * @param {string} pageUrl
 * @param {string | null} lastUpdatedLabel
 * @returns {string}
 */
function renderPrivacyMain(manifest, pageUrl, lastUpdatedLabel) {
    const homeUrl = manifest.rootPage.absoluteUrl;
    const siteLink = renderLink(homeUrl, 'CodeSamplez Tools');

    return `  <main class="main-container" aria-labelledby="privacy-policy-title">
    <nav class="cst-shell__breadcrumb" aria-label="Breadcrumb">
      <ol class="cst-shell__breadcrumb-list">
        <li class="cst-shell__breadcrumb-item">
          <a class="cst-shell__breadcrumb-link" href="${escapeAttribute(homeUrl)}">Home</a>
        </li>
        <li class="cst-shell__breadcrumb-item">
          <span class="cst-shell__breadcrumb-separator" aria-hidden="true">/</span>
          <span class="cst-shell__breadcrumb-current" aria-current="page">${escapeHtml(PRIVACY_PAGE_TITLE)}</span>
        </li>
      </ol>
    </nav>
    <h1 id="privacy-policy-title" class="main-title">${escapeHtml(PRIVACY_PAGE_TITLE)}</h1>
    ${lastUpdatedLabel ? `<p class="section-body">Last updated: ${escapeHtml(lastUpdatedLabel)}.</p>` : ''}
    <p class="section-body">This page describes the ${siteLink} website at ${renderLink(pageUrl, pageUrl)}. The tools process what you enter in your browser.</p>

    <section aria-labelledby="privacy-tool-input">
      <h2 class="section-title" id="privacy-tool-input">Tool input</h2>
      <p class="section-body">Text, files, and images you enter in a tool are processed in your browser. The tools do not upload that input to a server, and the site does not ask you to create an account.</p>
      <p class="section-body">Some tools can place a copy of that input in the page address so you can reopen or share it. Current share links keep the copy in the address hash, which your browser does not send to the server. Older share links may place it in the query string. A query string is sent to the server with the page request, and it is part of the address Google Analytics receives.</p>
    </section>

    <section aria-labelledby="privacy-analytics">
      <h2 class="section-title" id="privacy-analytics">Google Analytics</h2>
      <p class="section-body">The published site loads Google Analytics 4. Pages include Google's gtag.js script and a configuration call for this site's measurement ID. That script uses cookies and sends usage information, including the page address, to Google.</p>
      <p class="section-body">The pages also send a tool_used event for diff-checker, json-formatter, and base64 with the params tool_id, action, trigger (user, sample, or share), and outcome (success or error), plus an optional input_size_bucket; unknown trigger or outcome values are dropped, and the event contains no tool input content. A click on a Learn more tutorial link sends a tutorial_link_click event with tool_id and the tutorial path only. That event does not include tool input. Local development builds do not include the script.</p>
    </section>

    <section aria-labelledby="privacy-ads">
      <h2 class="section-title" id="privacy-ads">Google AdSense</h2>
      <p class="section-body">The published site loads Google AdSense. Google, as a third-party vendor, and its partners use cookies to serve ads based on a user's prior visits to this website and other websites.</p>
      <p class="section-body">Google's use of advertising cookies enables it and its partners to serve personalized ads.</p>
      <p class="section-body">You can opt out of personalized advertising via ${renderLink(GOOGLE_ADS_SETTINGS_OPTOUT_URL, 'Google Ads Settings')} and opt out of some third-party vendors' cookies via ${renderLink(ABOUT_ADS_CHOICES_URL, 'aboutads.info')}.</p>
      <p class="section-body">Other third-party vendors and ad networks may also serve ads on the site and use cookies.</p>
    </section>

    <section aria-labelledby="privacy-opt-out">
      <h2 class="section-title" id="privacy-opt-out">Opting out</h2>
      <p class="section-body">Visitors in the EEA, the UK, and Switzerland are shown Google's consent message and can choose whether Google Analytics and Google AdSense may store cookies. Until that choice allows storage, those cookies stay off. The Privacy settings link in the footer reopens the message.</p>
      <p class="section-body">This site does not provide its own control for turning analytics or ads off. You can:</p>
      <ul class="section-list">
        <li>Install ${renderLink(GOOGLE_ANALYTICS_OPTOUT_URL, "Google's Analytics opt-out browser add-on")}.</li>
        <li>Change ad personalization in ${renderLink(GOOGLE_ADS_SETTINGS_URL, 'Google Ads Settings')}.</li>
        <li>Block or delete cookies in your browser.</li>
      </ul>
    </section>

    <section aria-labelledby="privacy-contact">
      <h2 class="section-title" id="privacy-contact">Contact</h2>
      <p class="section-body">Questions about this page can be sent through the ${renderLink(CONTACT_PAGE_URL, 'CodeSamplez contact page')}.</p>
    </section>
  </main>`;
}

/**
 * Static, prerendered privacy policy. Same document shell as the tools index
 * (theme, fonts, analytics, header/footer hydration) with its own canonical
 * and WebPage structured data.
 * @returns {string}
 */
function generatePrivacyDocument() {
    const manifest = loadManifest();
    const pageUrl = getPrivacyPageAbsoluteUrl(manifest.siteBaseUrl);
    const lastUpdatedLabel = getPrivacyLastUpdatedLabel();
    const structuredDataScript = renderStructuredDataScript(buildPrivacyStructuredDataGraph(manifest, {
        url: pageUrl,
        name: PRIVACY_PAGE_TITLE,
        description: PRIVACY_PAGE_DESCRIPTION
    }));
    const analyticsHeadMarkup = renderAnalyticsHeadMarkup(manifest.analytics, manifest.siteBaseUrl);
    const analyticsResourceHints = renderAnalyticsResourceHints(manifest.analytics, manifest.siteBaseUrl);
    const documentTitle = formatRootDocumentTitle(PRIVACY_PAGE_TITLE, manifest.organization.name);
    const escapedDescription = escapeAttribute(PRIVACY_PAGE_DESCRIPTION);
    const escapedTitle = escapeAttribute(PRIVACY_PAGE_TITLE);
    const escapedCanonical = escapeAttribute(pageUrl);
    const escapedSiteName = escapeAttribute(manifest.siteName);
    const escapedImageUrl = escapeAttribute(manifest.rootPage.imageUrl);
    const escapedImageAlt = escapeAttribute(`${manifest.siteName} — privacy policy`);
    const escapedRootShellStylesUrl = escapeAttribute(buildAbsoluteUrl(manifest.siteStaticRootUri, '/root-shell/styles.main.css'));
    const escapedRootStylesUrl = escapeAttribute(buildAbsoluteUrl(manifest.siteStaticRootUri, '/styles.css'));
    const escapedRootShellBundleUrl = escapeAttribute(buildAbsoluteUrl(manifest.siteStaticRootUri, '/root-shell/bundle.main.js'));
    const shellFooterMarkup = renderShellFooterMarkup(manifest.siteBaseUrl);

    return `<!DOCTYPE html>
<html lang="en" data-theme="dark"${getBuildCommitAttributeMarkup()}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${THEME_INIT_SCRIPT}
  <title>${escapeHtml(documentTitle)}</title>
  <meta name="description" content="${escapedDescription}">
  <meta name="theme-color" content="${THEME_COLOR}">
  ${renderFaviconLinks(manifest.siteStaticRootUri)}
  ${renderFontPreloads(manifest.siteStaticRootUri)}${analyticsResourceHints ? `\n  ${analyticsResourceHints}` : ''}
  <link rel="canonical" href="${escapedCanonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapedSiteName}">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  <meta property="og:url" content="${escapedCanonical}">
  <meta property="og:image" content="${escapedImageUrl}">
  <meta property="og:image:alt" content="${escapedImageAlt}">
  <meta property="og:image:width" content="${OG_IMAGE_WIDTH}">
  <meta property="og:image:height" content="${OG_IMAGE_HEIGHT}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDescription}">
  <meta name="twitter:image" content="${escapedImageUrl}">
  <meta name="twitter:image:alt" content="${escapedImageAlt}">
  <link rel="image_src" href="${escapedImageUrl}">
  <link rel="stylesheet" href="${escapedRootShellStylesUrl}">
  <link rel="stylesheet" href="${escapedRootStylesUrl}">
  ${structuredDataScript}${analyticsHeadMarkup ? `\n  ${analyticsHeadMarkup}` : ''}
</head>
<body class="landing-page">
  <div id="app-shell-header"></div>

${renderPrivacyMain(manifest, pageUrl, lastUpdatedLabel)}

  <div id="app-shell-footer">${shellFooterMarkup}</div>
  <script src="${escapedRootShellBundleUrl}" defer></script>
</body>
</html>
`;
}

module.exports = {
    formatPrivacyLastUpdatedLabel,
    PRIVACY_PAGE_DESCRIPTION,
    PRIVACY_PAGE_TITLE,
    PRIVACY_PUBLIC_PATH,
    generatePrivacyDocument,
    getPrivacyPageAbsoluteUrl,
    getPrivacyPageDefinition
};
