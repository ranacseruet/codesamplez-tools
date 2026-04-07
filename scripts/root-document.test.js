/** @jest-environment node */

const { generateRootDocument } = require('./root-document');

describe('root document generation', () => {
  it('renders the generated landing page with structured data and grouped tool cards', () => {
    const html = generateRootDocument();

    expect(html).toContain('<title>CodeSamplez Tools</title>');
    expect(html).toContain('<meta name="description" content="Client-side formatters, converters, token tools, and text utilities with a consistent privacy-preserving workflow.">');
    expect(html).toContain('<link rel="canonical" href="https://codesamplez.com/tools/">');
    expect(html).toContain('<link rel="stylesheet" href="root-shell/styles.main.css">');
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@type":"CollectionPage"');
    expect(html).toContain('"@type":"ItemList"');
    expect(html).toContain('"@type":"WebApplication"');
    expect(html).toContain('"numberOfItems":10');
    expect(html).toContain('"url":"https://codesamplez.com/tools/json-formatter/"');
    expect(html).toContain('"url":"https://codesamplez.com/tools/text-analyzer/"');
    expect(html).toContain('Code Formatters &amp; Validators');
    expect(html).toContain('Encoders &amp; Decoders');
    expect(html).toContain('Text Analysis &amp; Diff Tools');
    expect(html).toContain('src="json-formatter/images/featured.png"');
    expect(html).toContain('href="jwt-decoder/"');
    expect(html).toContain('<script src="root-shell/bundle.main.js" defer></script>');
  });
});
