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

    expect(html).toContain('<title>Online Developer Tools</title>');
    expect(html).toContain('<meta name="description" content="Free online developer tools for debugging, formatting and validation needs. Access 10+ utilities to help boost your day-to-day productivity.">');
    expect(html).toContain('<meta name="theme-color" content="#f7f7fa">');
    expect(html).toContain('<html lang="en" data-theme="light">');
    expect(html).toContain('https://fonts.googleapis.com/css2?family=Geist');
    expect(html).toContain('https://unpkg.com/lucide@latest');
    expect(html).toContain(`<link rel="canonical" href="${SITE_BASE_URL}">`);
    expect(html).toContain(`<link rel="stylesheet" href="${buildSiteAssetUri('/root-shell/styles.main.css')}">`);
    expect(html).toContain(`<link rel="stylesheet" href="${buildSiteAssetUri('/styles.css')}">`);
    expect(html).toContain('<meta property="og:site_name" content="CodeSamplez Tools">');
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
    expect(html).toContain(`src="${buildSiteAssetUri('/json-formatter/images/featured.png')}"`);
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
});
