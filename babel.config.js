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
    }]
  ]
};
