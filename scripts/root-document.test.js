/** @jest-environment node */

const { generateRootDocument } = require('./root-document');
const { SITE_BASE_URL, buildSiteAssetUri, buildSiteHref } = require('../common/siteBaseUrl');

function getHeadingMatches(html, level) {
  return [...html.matchAll(new RegExp(`<h${level}\\b[^>]*>`, 'g'))];
}

function withEnv(overrides, run) {
  const originalEnv = { ...process.env };

  Object.keys(overrides).forEach((key) => {
    const value = overrides[key];
    if (typeof value === 'undefined') {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  });

  try {
    return run();
  } finally {
    process.env = originalEnv;
  }
}

describe('root document generation', () => {
    it('renders the generated landing page with structured data and grouped tool cards', () => {
        const html = generateRootDocument();

    expect(html).toContain('<title>Online Developer Tools | CodeSamplez</title>');
    expect(html).toContain('<meta name="description" content="Free online developer tools for debugging, formatting and validation needs. Access 12+ utilities to help boost your day-to-day productivity.">');
    expect(html).toContain('<meta name="theme-color" content="#0b0b11">');
    expect(html).toContain('<html lang="en" data-theme="dark">');
    expect(html).toContain("localStorage.getItem('cst-standalone-theme-mode')");
    expect(html).toContain(`<link rel="icon" href="${buildSiteAssetUri('/favicon.ico')}" sizes="any">`);
    expect(html).toContain(`<link rel="icon" type="image/svg+xml" href="${buildSiteAssetUri('/favicon.svg')}">`);
    expect(html).toContain(`<link rel="apple-touch-icon" href="${buildSiteAssetUri('/apple-touch-icon.png')}">`);
    expect(html).toContain(`<link rel="preload" href="${buildSiteAssetUri('/fonts/Geist-Variable.woff2')}" as="font" type="font/woff2" crossorigin>`);
    // The landing page renders no code, so GeistMono is intentionally NOT preloaded
    // here (kept off the first-paint path); it still loads on demand via @font-face.
    expect(html).not.toContain(`<link rel="preload" href="${buildSiteAssetUri('/fonts/GeistMono-Variable.woff2')}"`);
    // No third-party font/icon CDNs — assets are self-hosted/inlined.
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('unpkg.com');
    expect(html).toContain(`<link rel="canonical" href="${SITE_BASE_URL}">`);
    expect(html).toContain(`<link rel="stylesheet" href="${buildSiteAssetUri('/root-shell/styles.main.css')}">`);
    expect(html).toContain(`<link rel="stylesheet" href="${buildSiteAssetUri('/styles.css')}">`);
    expect(html).toContain('<meta property="og:site_name" content="CodeSamplez Tools">');
    expect(html).toContain(`<meta property="og:image" content="${buildSiteAssetUri('/og-home.png')}">`);
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta property="og:image:height" content="630">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain(`<meta name="twitter:image" content="${buildSiteAssetUri('/og-home.png')}">`);
    expect(html).toContain(`<link rel="image_src" href="${buildSiteAssetUri('/og-home.png')}">`);
    expect(html).toContain('"@type":"Organization"');
    expect(html).toContain('"publisher":{"@id":"');
    expect(html).toContain('<h1 class="main-title">Online Developer Tools</h1>');
    expect(getHeadingMatches(html, 1)).toHaveLength(1);
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@type":"CollectionPage"');
    expect(html).toContain('"@type":"ItemList"');
    expect(html).toContain('"@type":["WebApplication","SoftwareApplication"]');
    expect(html).toContain('"numberOfItems":12');
    expect(html).toContain(`"url":"${buildSiteHref('/json-formatter/')}"`);
    expect(html).toContain(`"url":"${buildSiteHref('/json-editor/')}"`);
    expect(html).toContain(`"url":"${buildSiteHref('/text-analyzer/')}"`);
    expect(html).toContain('What are Online Developer Tools?');
    expect(html).toContain('Why Use These Free Developer Tools?');
    expect(html).toContain('When to Use These Online Developer Tools?');
    expect(html).toContain('FAQs (Frequently Asked Questions):');
    expect(html).toContain(`href="${buildSiteHref('/json-formatter/')}"`);
    expect(html).toContain('href="https://codesamplez.com/contact"');
    expect(html).toContain('Code Formatters &amp; Validators');
    expect(html).toContain('Encoders &amp; Decoders');
    expect(html).toContain('Text Analysis &amp; Diff Tools');
    expect(html).toContain('Image Tools');
    expect(html).toContain('Format, validate JSON syntax, and optionally check JSON Schema contracts in one client-side tool.');
    expect(html).toContain('Build and edit JSON with a visual tree editor. Import JSON locally, add or rearrange values, and copy or download the finished document.');
    expect(html).toContain('Decode and validate JSON Web Tokens (JWT). Inspect header, payload, and verify signatures with your secret key for token authenticity.');
    expect(html).toContain('Analyze text to get insights like character count, word count, line count, and other useful text statistics.');
    expect(html).toContain('<span class="tool-icon-tile" aria-hidden="true"><svg class="cst-icon"');
    // v4: the "Live" badge was removed (all-live grids are noise); only
    // non-live tools get a status badge.
    expect(html).not.toContain('tool-status--live');
    // v4 hero: eyebrow stats, tagline, CTA pair, search island shell.
    expect(html).toContain('<p class="hero-eyebrow">// 12 tools · 100% client-side · 0 uploads</p>');
    expect(html).toContain('your data never leaves the tab');
    expect(html).toContain('<a class="cta-button" href="#tools">Browse tools');
    expect(html).toContain('<a class="cta-button cta-button--ghost" href="#what-are-online-developer-tools">Why client-side?</a>');
    expect(html).toContain('id="tool-search-root"');
    expect(html).toContain('placeholder="Search tools…"');
    expect(html).toContain('<a class="tool-search__chip tool-search__chip--all" role="button" href="#tools">All tools</a>');
    expect(html).toContain('<a class="tool-search__chip tool-search__chip--formatters" role="button" href="#group-code-formatters">Code Formatters &amp; Validators</a>');
    // v4 Phase D3: empty slot for the client-rendered "Recently used" row,
    // directly under the search island (the row is per-visitor, so nothing can
    // be server-rendered into it).
    expect(html).toContain('<div class="recent-tools-slot" id="recent-tools-root"></div>');
    expect(html.indexOf('id="recent-tools-root"')).toBeGreaterThan(html.indexOf('id="tool-search-root"'));
    expect(html.indexOf('id="recent-tools-root"')).toBeLessThan(html.indexOf('<div id="tools" class="tools-index">'));
    // v4 cards: whole-card stretched title link (one tab stop), category
    // accent class, fake CTA affordance.
    expect(html).toContain('class="tool-card tool-card--formatters" data-tool-id="json-formatter-tool"');
    expect(html).toContain(`<a class="tool-card__link" href="${buildSiteHref('/json-formatter/')}">JSON Formatter</a>`);
    expect(html).toContain('class="tool-card tool-card--media" data-tool-id="image-editor"');
    expect(html).toContain(`<a class="tool-card__link" href="${buildSiteHref('/image-editor/')}">Image Editor</a>`);
    expect(html).toContain('<span class="cta-button cta-button--card" aria-hidden="true">Try Tool');
    // Tools index wrapper anchors the Browse-tools CTA and the All chip.
    expect(html).toContain('<div id="tools" class="tools-index">');
    expect(html).toContain('data-tool-group="code-formatters"');
    // v4 FAQ accordion: native details, Q&A copy stays in static HTML.
    expect(html).toContain('<details class="faq-item">');
    expect(html).toContain('<summary class="faq-item__question">Are these online developer tools free to use?</summary>');
    expect(html).toContain(`href="${buildSiteHref('/jwt-decoder/')}"`);
    expect(html).toContain(`<script src="${buildSiteAssetUri('/root-shell/bundle.main.js')}" defer></script>`);

    const introIndex = html.indexOf('Whether you need to minify JavaScript or decode a secret message, these tools help you get it done fast, no installation required.');
    // Anchor on the first tool-group section (group labels also appear earlier,
    // in the hero search chips).
    const cardsIndex = html.indexOf('data-tool-group="code-formatters"');
    const followupCopyIndex = html.indexOf('What are Online Developer Tools?');

    expect(introIndex).toBeGreaterThan(-1);
    expect(cardsIndex).toBeGreaterThan(introIndex);
    expect(followupCopyIndex).toBeGreaterThan(cardsIndex);
  });

  it('uses localhost canonical and tool urls in development mode', () => {
    const html = withEnv({
      NODE_ENV: 'development',
      PORT: '8081',
      CST_SITE_BASE_URL: undefined
    }, () => generateRootDocument());

    expect(html).toContain('<link rel="canonical" href="http://localhost:8081/">');
    expect(html).toContain('"url":"http://localhost:8081/json-formatter/"');
    expect(html).toContain('"url":"http://localhost:8081/text-analyzer/"');
    expect(html).toContain('href="http://localhost:8081/json-formatter/"');
    expect(html).toContain('href="http://localhost:8081/jwt-decoder/"');
  });

  it('injects GA4 and AdSense head scripts when analytics ids are configured', () => {
    const html = withEnv({
      NODE_ENV: 'production',
      CST_GA_MEASUREMENT_ID: 'G-INDEXPAGE1',
      CST_ADSENSE_CLIENT_ID: 'ca-pub-1234567890123456'
    }, () => generateRootDocument());

    expect(html).toContain('https://www.googletagmanager.com/gtag/js?id=G-INDEXPAGE1');
    expect(html).toContain("gtag('config','G-INDEXPAGE1')");
    expect(html).toContain('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456');
    // AdSense loader is deferred (no render-blocking async <script src>) and the
    // ad origins are pre-connected in the head.
    expect(html).not.toContain('<script async src="https://pagead2.googlesyndication.com');
    expect(html).toContain('<link rel="preconnect" href="https://pagead2.googlesyndication.com" crossorigin>');
    expect(html).toContain('<link rel="preconnect" href="https://googleads.g.doubleclick.net" crossorigin>');
  });

  it('emits no tracker markup when no analytics ids are configured', () => {
    const html = withEnv({
      NODE_ENV: 'production',
      CST_GA_MEASUREMENT_ID: undefined,
      CST_ADSENSE_CLIENT_ID: undefined
    }, () => generateRootDocument());

    expect(html).not.toContain('googletagmanager.com');
    expect(html).not.toContain('googlesyndication.com');
    expect(html).not.toContain('doubleclick.net');
  });

  it('omits analytics head scripts in development even when ids are configured', () => {
    const html = withEnv({ NODE_ENV: 'development' }, () => generateRootDocument());

    expect(html).not.toContain('googletagmanager.com');
    expect(html).not.toContain('googlesyndication.com');
  });
});
