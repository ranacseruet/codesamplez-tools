/** @jest-environment node */

const { renderStructuredDataScript } = require('./structured-data');

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
});
