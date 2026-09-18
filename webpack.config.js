const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { getAppShellCatalogDefinition, getAppShellCatalogDependencies } = require('./scripts/app-shell-catalog');
const { GeneratedHtmlPlugin } = require('./scripts/generated-html-plugin');
const {
  DEFAULT_FEATURED_IMAGE_DIRECTORY,
  DEFAULT_FEATURED_IMAGE_EXTENSION,
  DEFAULT_FEATURED_IMAGE_FILENAME,
  getRootAssets,
  getToolDefinitions,
  selectTools,
  splitCsv
} = require('./scripts/tool-manifest');
const tools = getToolDefinitions();
const rootShellEntryName = 'root-shell';
const getRootShellEntry = () => ([
  './common/material-theme.css',
  './common/app-shell/app-shell.css',
  './root-shell'
]);
const getToolEntry = (tool) => ([
  './common/material-theme.css',
  './common/app-shell/app-shell.css',
  './common/shared-styles.css',
  ...(tool.id === 'diff-checker-tool' ? ['prismjs/themes/prism.css'] : []),
  `./${tool.sourceRoot}/script`,
  `./${tool.sourceRoot}/styles.css`
]);

const getWebpackMode = (argv = {}) => argv.mode || process.env.NODE_ENV || 'development';
const createTerserMinimizer = (toolId) => {
  if (toolId !== 'js-minifier-tool') {
    return new TerserPlugin();
  }

  // `js-minifier-tool` is dependency-heavy; a second compress pass is a low-risk
  // way to squeeze more bytes out of the large Babel-derived payload.
  return new TerserPlugin({
    terserOptions: {
      ecma: 2020,
      compress: {
        ecma: 2020,
        passes: 2
      },
      format: {
        ecma: 2020,
        comments: false
      }
    }
  });
};
const getToolFeaturedImageSourceName = (tool) => {
  const imagesDir = path.join(__dirname, tool.sourceRoot, 'images');
  if (!fs.existsSync(imagesDir)) {
    return null;
  }

  const pngFiles = fs.readdirSync(imagesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(DEFAULT_FEATURED_IMAGE_EXTENSION))
    .map((entry) => entry.name)
    .sort();

  if (pngFiles.length === 0) {
    return null;
  }

  const featuredPng = pngFiles.find((name) => name === DEFAULT_FEATURED_IMAGE_FILENAME);
  if (featuredPng) {
    return featuredPng;
  }

  if (pngFiles.length === 1) {
    return pngFiles[0];
  }

  throw new Error(`Expected exactly one PNG image asset for ${tool.id}, found: ${pngFiles.join(', ')}`);
};
const createToolFeaturedImagePattern = (tool) => {
  const sourceImageName = getToolFeaturedImageSourceName(tool);
  if (!sourceImageName) {
    return null;
  }

  return {
    from: path.join(__dirname, tool.sourceRoot, 'images', sourceImageName),
    to: path.join(__dirname, tool.outputPath, DEFAULT_FEATURED_IMAGE_DIRECTORY, DEFAULT_FEATURED_IMAGE_FILENAME)
  };
};

const createToolAdditionalImagePatterns = (tool) => {
  const imagesDir = path.join(__dirname, tool.sourceRoot, 'images');
  if (!fs.existsSync(imagesDir)) {
    return [];
  }

  const featuredImageName = getToolFeaturedImageSourceName(tool);

  return fs.readdirSync(imagesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name !== featuredImageName)
    .sort()
    .map((name) => ({
      from: path.join(imagesDir, name),
      to: path.join(__dirname, tool.outputPath, DEFAULT_FEATURED_IMAGE_DIRECTORY, name)
    }));
};

const createRootAssetPatterns = () => getRootAssets()
  .filter((asset) => path.extname(asset) !== '.html')
  .filter((asset) => fs.existsSync(path.join(__dirname, asset)))
  .map((asset) => ({
    from: asset,
    to: path.join(__dirname, 'build', asset)
  }));

const createToolHtmlAssets = (selectedTools, emitInsideToolDirectory) => selectedTools.reduce((toolHtmlAssets, tool) => {
  toolHtmlAssets[tool.id] = emitInsideToolDirectory ? 'index.html' : `${tool.outputDir}/index.html`;
  return toolHtmlAssets;
}, {});
const createAppShellCatalogRuntimeValue = () => webpack.DefinePlugin.runtimeValue(
  () => JSON.stringify(getAppShellCatalogDefinition()),
  getAppShellCatalogDependencies()
);
const createDefinePlugin = (mode) => new webpack.DefinePlugin({
  'process.env.NODE_ENV': JSON.stringify(mode || process.env.NODE_ENV || 'development'),
  'process.env.BABEL_TYPES_8_BREAKING': JSON.stringify(false),
  'process.platform': JSON.stringify(process.platform),
  'globalThis.__CST_APP_SHELL_CATALOG__': createAppShellCatalogRuntimeValue()
});

const readSelectedToolsFromEnv = (env = {}) => {
  const requestedTools = Array.isArray(env.tools)
    ? env.tools.flatMap((value) => splitCsv(String(value)))
    : splitCsv(typeof env.tools === 'string' ? env.tools : undefined);

  if (requestedTools.length > 0) {
    return selectTools(requestedTools);
  }

  return env.toolSelection === 'explicit' ? [] : tools;
};

const shouldIncludeRootShell = (env = {}, selectedTools) => {
  return env.includeRootShell === true || env.includeRootShell === 'true' || selectedTools.length === tools.length;
};

const shouldIncludeRootAssets = (env = {}, selectedTools) => {
  return env.includeRootAssets === true || env.includeRootAssets === 'true' || selectedTools.length === tools.length;
};

const baseConfig = {
  mode: 'development',
  optimization: {
    minimize: true,
    minimizer: [
      createTerserMinimizer(),
      new CssMinimizerPlugin()
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    fallback: { "crypto": false }
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              // Leave the self-hosted Geist `fonts/` url()s untouched so the
              // @font-face resolves to the single deployed /fonts/ copy instead
              // of being emitted as hashed per-bundle assets. Matches both the
              // relative (../fonts/) and any root-absolute form.
              url: {
                filter: (url) => !/(^|\/)fonts\//.test(url)
              }
            }
          }
        ]
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[hash][ext][query]'
        }
      }
    ]
  }
};

const getToolConfig = (tool) => ({
  ...baseConfig,
  name: tool.id,
  optimization: {
    ...baseConfig.optimization,
    minimizer: [
      createTerserMinimizer(tool.id),
      new CssMinimizerPlugin()
    ]
  },
  resolve: {
    ...baseConfig.resolve,
    alias: {
      ...(baseConfig.resolve.alias || {}),
      ...(tool.id === 'js-minifier-tool'
        ? {
            process: path.resolve(__dirname, 'common/shims/process-browser.js'),
            debug: path.resolve(__dirname, 'common/shims/debug-noop.js'),
            '@babel/code-frame': path.resolve(__dirname, 'common/shims/babel-code-frame-noop.js'),
            '@jridgewell/gen-mapping': path.resolve(__dirname, 'common/shims/jridgewell-gen-mapping-noop.js'),
            '@jridgewell/trace-mapping': path.resolve(__dirname, 'common/shims/jridgewell-trace-mapping-noop.js'),
            jsesc: path.resolve(__dirname, 'common/shims/jsesc-lite.js')
          }
        : {})
    }
  },
  entry: {
    main: getToolEntry(tool)
  },
  output: {
    path: path.resolve(__dirname, tool.outputPath),
    filename: 'bundle.main.js',
    publicPath: tool.publicPath
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['**/*']
    }),
    createDefinePlugin(),
    new GeneratedHtmlPlugin({
      toolHtmlAssets: createToolHtmlAssets([tool], true)
    }),
    new MiniCssExtractPlugin({
      filename: 'styles.main.css'
    }),
    ...(tool.id === 'data-format-converter'
      ? [
          // `fast-xml-parser`'s validator is sizable. The tool only needs a
          // boolean/error-shape validity check, so replace it with a smaller
          // DOMParser-based validator in production bundles for this tool.
          new webpack.NormalModuleReplacementPlugin(/\.\/validator\.js$/, (resource) => {
            const fxpSrcPath = `${path.sep}node_modules${path.sep}fast-xml-parser${path.sep}src`;
            if (resource.context && resource.context.includes(fxpSrcPath)) {
              resource.request = path.resolve(__dirname, 'common/shims/fast-xml-parser-validator-dom.js');
            }
          }),
          // DTD/DOCTYPE entity parsing is not a required feature for this tool.
          // Replace the parser's DOCTYPE reader with a no-entity stub to trim bundle size.
          new webpack.NormalModuleReplacementPlugin(/\.\/DocTypeReader\.js$/, (resource) => {
            const fxpXmlParserPath = `${path.sep}node_modules${path.sep}fast-xml-parser${path.sep}src${path.sep}xmlparser`;
            if (resource.context && resource.context.includes(fxpXmlParserPath)) {
              resource.request = path.resolve(__dirname, 'common/shims/fast-xml-parser-doctype-reader-noop.js');
            }
          })
        ]
      : []),
    new CopyPlugin({
      patterns: [
        ...(() => {
          const imagePattern = createToolFeaturedImagePattern(tool);
          return [
            ...(imagePattern ? [imagePattern] : []),
            ...createToolAdditionalImagePatterns(tool)
          ];
        })()
      ]
    })
  ]
});

const getRootShellConfig = (includeRootAssets = true) => ({
  ...baseConfig,
  name: rootShellEntryName,
  entry: {
    main: getRootShellEntry()
  },
  output: {
    path: path.resolve(__dirname, 'build', rootShellEntryName),
    filename: 'bundle.main.js',
    publicPath: `/${rootShellEntryName}/`
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['**/*']
    }),
    createDefinePlugin(),
    new GeneratedHtmlPlugin({
      includeRootAssets,
      rootHtmlAsset: includeRootAssets ? '../index.html' : null
    }),
    new MiniCssExtractPlugin({
      filename: 'styles.main.css'
    }),
    ...(includeRootAssets
      ? [
          new CopyPlugin({
            patterns: createRootAssetPatterns()
          })
        ]
      : [])
  ]
});

const developmentConfig = {
  ...baseConfig,
  name: 'development',
  entry: tools.reduce((entries, tool) => {
    entries[tool.outputDir] = getToolEntry(tool);
    return entries;
  }, {
    [rootShellEntryName]: getRootShellEntry()
  }),
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name]/bundle.main.js',
    publicPath: '/'
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['**/*']
    }),
    createDefinePlugin(),
    new GeneratedHtmlPlugin({
      includeRootAssets: true,
      rootHtmlAsset: 'index.html',
      toolHtmlAssets: createToolHtmlAssets(tools, false)
    }),
    new MiniCssExtractPlugin({
      filename: '[name]/styles.main.css'
    }),
    new CopyPlugin({
      patterns: [
        ...createRootAssetPatterns(),
        ...tools.reduce((patterns, tool) => {
          return patterns.concat([
            ...(() => {
              const imagePattern = createToolFeaturedImagePattern(tool);
              return [
                ...(imagePattern ? [imagePattern] : []),
                ...createToolAdditionalImagePatterns(tool)
              ];
            })()
          ]);
        }, [])
      ]
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'build'),
      publicPath: '/'
    },
    compress: true,
    port: process.env.PORT || 8081,
    hot: true,
    open: false,
    historyApiFallback: true
  }
};

module.exports = (env = {}, argv = {}) => {
  const mode = getWebpackMode(argv);
  // Align NODE_ENV from the resolved webpack mode when the caller did not set
  // it. webpack-cli does not propagate `--mode` to `process.env.NODE_ENV`
  // (only `--node-env` does), so a bare `webpack serve --mode development`
  // (IDE launchers, Windows shells without `VAR=val` prefix support) would
  // otherwise leave NODE_ENV unset while building in development mode — and
  // the analytics gate reads NODE_ENV, not webpack mode. Defaulting from the
  // mode keeps the two in agreement; an explicitly set NODE_ENV is never
  // overridden (in particular, never downgraded from production).
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = mode;
  }
  baseConfig.mode = mode;
  const selectedTools = readSelectedToolsFromEnv(env);
  const includeRootShell = shouldIncludeRootShell(env, selectedTools);
  const includeRootAssets = shouldIncludeRootAssets(env, selectedTools);

  const applyMode = (config) => ({
    ...config,
    mode,
    // Explicit source-map policy: disable in production bundles, keep fast maps for local development.
    devtool: mode === 'development' ? 'eval-cheap-module-source-map' : false,
    plugins: config.plugins.map((plugin) => {
      if (plugin instanceof webpack.DefinePlugin) {
        return createDefinePlugin(mode);
      }
      return plugin;
    })
  });

  const productionConfigs = selectedTools.map((tool) => applyMode(getToolConfig(tool)));
  const rootShellConfig = includeRootShell ? applyMode(getRootShellConfig(includeRootAssets)) : null;
  const devConfig = applyMode({
    ...developmentConfig,
    entry: selectedTools.reduce((entries, tool) => {
      entries[tool.outputDir] = getToolEntry(tool);
      return entries;
    }, includeRootShell ? { [rootShellEntryName]: getRootShellEntry() } : {}),
    plugins: developmentConfig.plugins.map((plugin) => {
      if (plugin instanceof GeneratedHtmlPlugin) {
        return new GeneratedHtmlPlugin({
          includeRootAssets,
          rootHtmlAsset: includeRootAssets ? 'index.html' : null,
          toolHtmlAssets: createToolHtmlAssets(selectedTools, false)
        });
      }

      if (!(plugin instanceof CopyPlugin)) {
        return plugin;
      }

      return new CopyPlugin({
        patterns: [
          ...(includeRootAssets ? createRootAssetPatterns() : []),
          ...selectedTools.reduce((patterns, tool) => {
            return patterns.concat([
              ...(() => {
                const imagePattern = createToolFeaturedImagePattern(tool);
                return imagePattern ? [imagePattern] : [];
              })()
            ]);
          }, [])
        ]
      });
    })
  });

  return mode === 'development'
    ? devConfig
    : [...productionConfigs, ...(rootShellConfig ? [rootShellConfig] : [])];
};
