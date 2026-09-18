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
  });

  it('does not emit FAQPage JSON-LD when faq items are omitted', () => {
    const manifest = loadManifest();
    const tool = getToolById('diff-checker-tool');
    const script = renderStructuredDataScript(buildToolStructuredDataGraph(manifest, tool));

    expect(script).not.toContain('"@type":"FAQPage"');
    expect(script).not.toContain('"@type":"Question"');
  });

  it('emits HowTo JSON-LD when howTo steps are provided', () => {
    const manifest = loadManifest();
    const tool = getToolById('json-formatter-tool');
    const graph = buildToolStructuredDataGraph(manifest, tool, {
      howToSteps: [
        { name: 'Enter JSON Data', text: 'Paste your JSON string into the input area.' },
        { name: 'Validate and Format', text: 'Click Format JSON to validate and format the input.' }
      ]
    });
    const script = renderStructuredDataScript(graph);

    expect(script).toContain('"@type":"HowTo"');
    expect(script).toContain(`"@id":"${tool.absolutePageUrl}#howto"`);
    expect(script).toContain(`"isPartOf":{"@id":"${tool.absolutePageUrl}#webpage"}`);
    expect(script).toContain('"@type":"HowToStep","position":1,"name":"Enter JSON Data","text":"Paste your JSON string into the input area."');
    expect(script).toContain('"@type":"HowToStep","position":2,"name":"Validate and Format"');
  });

  it('does not emit HowTo JSON-LD when howTo steps are omitted', () => {
    const manifest = loadManifest();
    const tool = getToolById('diff-checker-tool');
    const script = renderStructuredDataScript(buildToolStructuredDataGraph(manifest, tool));

    expect(script).not.toContain('"@type":"HowTo"');
  });

  it('emits WebApplication/SoftwareApplication types with an optional featureList', () => {
    const manifest = loadManifest();
    const tool = getToolById('json-formatter-tool');
    const graph = buildToolStructuredDataGraph(manifest, tool, {
      featureList: ['Pretty-print with selectable indentation', 'Minify to a single line']
    });
    const script = renderStructuredDataScript(graph);

    expect(script).toContain('"@type":["WebApplication","SoftwareApplication"]');
    expect(script).toContain('"featureList":["Pretty-print with selectable indentation","Minify to a single line"]');
  });

  it('omits featureList when none is provided', () => {
    const manifest = loadManifest();
    const tool = getToolById('diff-checker-tool');
    const script = renderStructuredDataScript(buildToolStructuredDataGraph(manifest, tool));

    expect(script).not.toContain('"featureList"');
  });

  it('emits a BreadcrumbList that links the tools index to the current tool', () => {
    const manifest = loadManifest();
    const tool = getToolById('diff-checker-tool');
    const script = renderStructuredDataScript(buildToolStructuredDataGraph(manifest, tool));

    expect(script).toContain('"@type":"BreadcrumbList"');
    expect(script).toContain(`"@id":"${tool.absolutePageUrl}#breadcrumb"`);
    expect(script).toContain(`"breadcrumb":{"@id":"${tool.absolutePageUrl}#breadcrumb"}`);
    expect(script).toContain(`"position":1,"name":"Home","item":"${manifest.rootPage.absoluteUrl}"`);
    expect(script).toContain(`"position":2,"name":"${tool.title}","item":"${tool.absolutePageUrl}"`);
  });
});
