export default {
  presets: [
    // Use the repo-level browserslist policy (package.json) as the single source of truth.
    ['@babel/preset-env', {}],
    ['@babel/preset-react', {
      runtime: 'automatic',
      importSource: 'preact'
    }],
    // Babel 8 always enables allowDeclareFields, so the option is no longer passed.
    '@babel/preset-typescript'
  ],
  plugins: [
    // Babel 8 removed preset-env's `useBuiltIns: 'usage'` / `corejs` options; the
    // standalone polyfill plugin is the replacement. `usage-global` matches the
    // prior 'usage' behaviour, injecting core-js imports per file as needed.
    ['babel-plugin-polyfill-corejs3', { method: 'usage-global', version: '3' }]
  ],
  env: {
    // Jest (NODE_ENV=test) compiles modules to CommonJS, where `import.meta` is a
    // syntax error. Webpack relies on the literal `new Worker(new URL(..., import.meta.url))`
    // to emit + locate worker chunks, so this rewrite is scoped to tests ONLY and
    // must never run in the webpack build.
    test: {
      plugins: ['babel-plugin-transform-import-meta']
    }
  }
};
