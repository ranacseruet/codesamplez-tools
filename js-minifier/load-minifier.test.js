import { jest } from '@jest/globals';

// Exercises the real `loadMinifier()` body (the dynamic `import('./minifier')`).
// `unstable_mockModule` is the only thing that intercepts a dynamic import under
// jest's ESM loader, so the heavy Babel engine never actually loads here.
class FakeJSMinifier {}

jest.unstable_mockModule('./minifier', () => ({
    JSMinifier: FakeJSMinifier
}));

describe('loadMinifier', () => {
    let loadMinifier;

    beforeAll(async () => {
        ({ loadMinifier } = await import('./load-minifier'));
    });

    it('dynamically imports the engine and returns the JSMinifier constructor', async () => {
        const ctor = await loadMinifier();
        expect(ctor).toBe(FakeJSMinifier);
    });
});
