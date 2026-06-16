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
    expect(html).toContain('<meta name="description" content="Free online developer tools for debugging, formatting and validation needs. Access 10+ utilities to help boost your day-to-day productivity.">');
    expect(html).toContain('<meta name="theme-color" content="#f7f7fa">');
    expect(html).toContain('<html lang="en" data-theme="light">');
    expect(html).toContain("localStorage.getItem('cst-standalone-theme-mode')");
    expect(html).toContain(`<link rel="icon" href="${buildSiteAssetUri('/favicon.ico')}" sizes="any">`);
    expect(html).toContain(`<link rel="icon" type="image/svg+xml" href="${buildSiteAssetUri('/favicon.svg')}">`);
    expect(html).toContain(`<link rel="apple-touch-icon" href="${buildSiteAssetUri('/apple-touch-icon.png')}">`);
    expect(html).toContain(`<link rel="preload" href="${buildSiteAssetUri('/fonts/Geist-Variable.woff2')}" as="font" type="font/woff2" crossorigin>`);
    expect(html).toContain(`<link rel="preload" href="${buildSiteAssetUri('/fonts/GeistMono-Variable.woff2')}" as="font" type="font/woff2" crossorigin>`);
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
    expect(html).toContain('"@type":"WebApplication"');
    expect(html).toContain('"numberOfItems":10');
    expect(html).toContain(`"url":"${buildSiteHref('/json-formatter/')}"`);
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
    expect(html).toContain('Format and validate JSON data with proper indentation and alphabetical key sorting.');
    expect(html).toContain('Decode and validate JSON Web Tokens (JWT). Inspect header, payload, and verify signatures with your secret key for token authenticity.');
    expect(html).toContain('Analyze text to get insights like character count, word count, line count, and other useful text statistics.');
    expect(html).toContain('<span class="tool-icon-tile" aria-hidden="true"><svg class="cst-icon"');
    expect(html).toContain('<span class="tool-status tool-status--live">Live</span>');
    expect(html).toContain(`href="${buildSiteHref('/jwt-decoder/')}"`);
    expect(html).toContain(`<script src="${buildSiteAssetUri('/root-shell/bundle.main.js')}" defer></script>`);

    const introIndex = html.indexOf('Whether you need to minify JavaScript or decode a secret message, these tools help you get it done fast, no installation required.');
    const cardsIndex = html.indexOf('Code Formatters &amp; Validators');
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
      CST_GA_MEASUREMENT_ID: 'G-INDEXPAGE1',
      CST_ADSENSE_CLIENT_ID: 'ca-pub-1234567890123456'
    }, () => generateRootDocument());

    expect(html).toContain('https://www.googletagmanager.com/gtag/js?id=G-INDEXPAGE1');
    expect(html).toContain("gtag('config','G-INDEXPAGE1')");
    expect(html).toContain('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456');
  });

  it('injects the configured GA4 and AdSense ids from tooling-root config', () => {
    const html = generateRootDocument();

    expect(html).toContain('https://www.googletagmanager.com/gtag/js?id=G-75J9GJXH5K');
    expect(html).toContain('client=ca-pub-3520433969377647');
  });

  it('omits analytics head scripts in development even when ids are configured', () => {
    const html = withEnv({ NODE_ENV: 'development' }, () => generateRootDocument());

    expect(html).not.toContain('googletagmanager.com');
    expect(html).not.toContain('googlesyndication.com');
  });
});
