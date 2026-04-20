/** @jest-environment node */

const { buildToolStructuredDataGraph, renderStructuredDataScript } = require('./structured-data');
const { loadManifest, getToolById } = require('./tool-manifest');
const { buildSiteHref } = require('../common/siteBaseUrl');

describe('structured data rendering', () => {
  it('drops empty graph nodes and nested empty objects from the rendered graph', () => {
    const script = renderStructuredDataScript([
      {},
      {
        '@type': 'Thing',
        name: 'Fixture Node',
        image: {},
        sameAs: undefined
      }
    ]);

    expect(script).toContain('<script type="application/ld+json">');
    expect(script).toContain('"@graph":[{"@type":"Thing","name":"Fixture Node"}]');
    expect(script).not.toContain('"sameAs"');
    expect(script).not.toContain('"image"');
  });

  it('emits FAQPage JSON-LD when faq items are provided', () => {
    const manifest = loadManifest();
    const tool = getToolById('text-analyzer-tool');
    const graph = buildToolStructuredDataGraph(manifest, tool, {
      faqItems: [
        {
          question: 'Is the Text Analyzer tool free to use?',
          structuredDataAnswer: 'Yes. It is free.'
        }
      ]
    });
    const script = renderStructuredDataScript(graph);

    expect(script).toContain('"@type":"FAQPage"');
    expect(script).toContain(`"url":"${buildSiteHref('/text-analyzer/')}"`);
    expect(script).toContain('"name":"Is the Text Analyzer tool free to use?"');
    expect(script).toContain('"acceptedAnswer":{"@type":"Answer","text":"Yes. It is free."}');
    expect(script).not.toContain('"@type":"BreadcrumbList"');
    expect(script).not.toContain('"breadcrumb"');
  });

  it('does not emit FAQPage JSON-LD when faq items are omitted', () => {
    const manifest = loadManifest();
    const tool = getToolById('diff-checker-tool');
    const script = renderStructuredDataScript(buildToolStructuredDataGraph(manifest, tool));

    expect(script).not.toContain('"@type":"FAQPage"');
    expect(script).not.toContain('"@type":"Question"');
    expect(script).not.toContain('"@type":"BreadcrumbList"');
    expect(script).not.toContain('"breadcrumb"');
  });
});
