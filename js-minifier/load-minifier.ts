/**
 * Lazy-load seam for the Babel minifier engine (issue #396).
 *
 * The engine (`@babel/parser` + `traverse` + `generator`, ~803 KB raw) is the
 * single heaviest dependency in the repo. Isolating the dynamic `import()` here
 * keeps it out of the initial `js-minifier/bundle.main.js`: webpack emits the
 * engine as its own chunk, fetched only on first minify. `script.tsx` imports
 * this seam statically (cheap — this module has no static engine import), which
 * also gives tests a single, easily-mocked boundary instead of a dynamic import.
 */
export type MinifierConstructor = (typeof import('./minifier'))['JSMinifier'];

export async function loadMinifier(): Promise<MinifierConstructor> {
    const { JSMinifier } = await import('./minifier');
    return JSMinifier;
}
