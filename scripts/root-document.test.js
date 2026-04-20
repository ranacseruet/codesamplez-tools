/** @jest-environment node */

const { generateRootDocument } = require('./root-document');
const { SITE_BASE_URL, buildSiteHref } = require('../common/siteBaseUrl');

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

    expect(html).toContain('<title>CodeSamplez Tools</title>');
    expect(html).toContain('<meta name="description" content="Client-side formatters, converters, token tools, and text utilities with a consistent privacy-preserving workflow.">');
    expect(html).toContain(`<link rel="canonical" href="${SITE_BASE_URL}">`);
    expect(html).toContain('<link rel="stylesheet" href="root-shell/styles.main.css">');
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@type":"CollectionPage"');
    expect(html).toContain('"@type":"ItemList"');
    expect(html).toContain('"@type":"WebApplication"');
    expect(html).toContain('"numberOfItems":10');
    expect(html).toContain(`"url":"${buildSiteHref('/json-formatter/')}"`);
    expect(html).toContain(`"url":"${buildSiteHref('/text-analyzer/')}"`);
    expect(html).toContain('Code Formatters &amp; Validators');
    expect(html).toContain('Encoders &amp; Decoders');
    expect(html).toContain('Text Analysis &amp; Diff Tools');
    expect(html).toContain('src="json-formatter/images/featured.png"');
    expect(html).toContain('href="jwt-decoder/"');
    expect(html).toContain('<script src="root-shell/bundle.main.js" defer></script>');
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
  });
});
