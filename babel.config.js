export default {
  presets: [
    ['@babel/preset-env', {
      // Use the repo-level browserslist policy (package.json) as the single source of truth.
      useBuiltIns: 'usage',
      corejs: 3
    }],
    ['@babel/preset-react', {
      runtime: 'automatic',
      importSource: 'preact'
    }],
    ['@babel/preset-typescript', {
      allowDeclareFields: true
    }]
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
