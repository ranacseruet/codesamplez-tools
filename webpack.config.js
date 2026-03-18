const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { generateToolDocument } = require('./scripts/tool-document');
const {
  DEFAULT_FEATURED_IMAGE_DIRECTORY,
  DEFAULT_FEATURED_IMAGE_EXTENSION,
  DEFAULT_FEATURED_IMAGE_FILENAME,
  getRootAssets,
  getToolIds,
  selectTools,
  splitCsv
} = require('./scripts/tool-manifest');
const tools = getToolIds();
const rootShellEntryName = 'root-shell';
const getRootShellEntry = () => ([
  './common/material-theme.css',
  './common/app-shell/app-shell.css',
  './root-shell'
]);
const getToolEntry = (toolName) => ([
  './common/material-theme.css',
  './common/app-shell/app-shell.css',
  './common/shared-styles.css',
  ...(toolName === 'diff-checker-tool' ? ['prismjs/themes/prism.css'] : []),
  `./${toolName}/script`,
  `./${toolName}/styles.css`
]);

const getWebpackMode = (argv = {}) => argv.mode || process.env.NODE_ENV || 'development';
const createTerserMinimizer = (toolName) => {
  if (toolName !== 'js-minifier-tool') {
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
const createToolDocumentPattern = (toolName) => ({
  from: path.join(__dirname, toolName, 'tool.meta.json'),
  to: path.join(__dirname, 'build', toolName, 'index.html'),
  transform() {
    return generateToolDocument(toolName);
  }
});
const getToolFeaturedImageSourceName = (toolName) => {
  const imagesDir = path.join(__dirname, toolName, 'images');
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

  throw new Error(`Expected exactly one PNG image asset for ${toolName}, found: ${pngFiles.join(', ')}`);
};
const createToolFeaturedImagePattern = (toolName) => {
  const sourceImageName = getToolFeaturedImageSourceName(toolName);
  if (!sourceImageName) {
    return null;
  }

  return {
    from: path.join(__dirname, toolName, 'images', sourceImageName),
    to: path.join(__dirname, 'build', toolName, DEFAULT_FEATURED_IMAGE_DIRECTORY, DEFAULT_FEATURED_IMAGE_FILENAME)
  };
};

const createRootAssetPatterns = () => getRootAssets().map((asset) => ({
  from: asset,
  to: path.join(__dirname, 'build', asset)
}));

const readSelectedToolsFromEnv = (env = {}) => {
  const requestedTools = Array.isArray(env.tools)
    ? env.tools.flatMap((value) => splitCsv(String(value)))
    : splitCsv(typeof env.tools === 'string' ? env.tools : undefined);

  if (requestedTools.length > 0) {
    return selectTools(requestedTools).map((tool) => tool.id);
  }

  return env.toolSelection === 'explicit' ? [] : tools;
};

const shouldIncludeRootShell = (env = {}, selectedToolIds) => {
  return env.includeRootShell === true || env.includeRootShell === 'true' || selectedToolIds.length === tools.length;
};

const shouldIncludeRootAssets = (env = {}, selectedToolIds) => {
  return env.includeRootAssets === true || env.includeRootAssets === 'true' || selectedToolIds.length === tools.length;
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
        use: [MiniCssExtractPlugin.loader, 'css-loader']
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

const getToolConfig = (toolName) => ({
  ...baseConfig,
  name: toolName,
  optimization: {
    ...baseConfig.optimization,
    minimizer: [
      createTerserMinimizer(toolName),
      new CssMinimizerPlugin()
    ]
  },
  resolve: {
    ...baseConfig.resolve,
    alias: {
      ...(baseConfig.resolve.alias || {}),
      ...(toolName === 'js-minifier-tool'
        ? {
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
    main: getToolEntry(toolName)
  },
  output: {
    path: path.resolve(__dirname, 'build', toolName),
    filename: 'bundle.main.js',
    publicPath: `/${toolName}/`
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['**/*', '!*.html']
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.platform': JSON.stringify(process.platform)
    }),
    new MiniCssExtractPlugin({
      filename: 'styles.main.css'
    }),
    ...(toolName === 'data-format-converter'
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
        {
          ...createToolDocumentPattern(toolName)
        },
        ...(() => {
          const imagePattern = createToolFeaturedImagePattern(toolName);
          return imagePattern ? [imagePattern] : [];
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
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.platform': JSON.stringify(process.platform)
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
    const toolName = tool.name || tool;
    entries[toolName] = getToolEntry(toolName);
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
      cleanOnceBeforeBuildPatterns: ['**/*', '!*.html']
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.platform': JSON.stringify(process.platform)
    }),
    new MiniCssExtractPlugin({
      filename: '[name]/styles.main.css'
    }),
    new CopyPlugin({
      patterns: [
        {
          from: 'index.html',
          to: 'index.html'
        },
        {
          from: 'styles.css',
          to: 'styles.css'
        },
        ...tools.reduce((patterns, tool) => {
          const toolName = tool.name || tool;
          return patterns.concat([
            {
              ...createToolDocumentPattern(toolName)
            },
            ...(() => {
              const imagePattern = createToolFeaturedImagePattern(toolName);
              return imagePattern ? [imagePattern] : [];
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
  baseConfig.mode = mode;
  const selectedToolIds = readSelectedToolsFromEnv(env);
  const includeRootShell = shouldIncludeRootShell(env, selectedToolIds);
  const includeRootAssets = shouldIncludeRootAssets(env, selectedToolIds);

  const applyMode = (config) => ({
    ...config,
    mode,
    // Explicit source-map policy: disable in production bundles, keep fast maps for local development.
    devtool: mode === 'development' ? 'eval-cheap-module-source-map' : false,
    plugins: config.plugins.map((plugin) => {
      if (plugin instanceof webpack.DefinePlugin) {
        return new webpack.DefinePlugin({
          'process.env': JSON.stringify({ NODE_ENV: mode }),
          'process.platform': JSON.stringify(process.platform)
        });
      }
      return plugin;
    })
  });

  const productionConfigs = selectedToolIds.map((tool) => applyMode(getToolConfig(tool)));
  const rootShellConfig = includeRootShell ? applyMode(getRootShellConfig(includeRootAssets)) : null;
  const devConfig = applyMode({
    ...developmentConfig,
    entry: selectedToolIds.reduce((entries, toolName) => {
      entries[toolName] = getToolEntry(toolName);
      return entries;
    }, includeRootShell ? { [rootShellEntryName]: getRootShellEntry() } : {}),
    plugins: developmentConfig.plugins.map((plugin) => {
      if (!(plugin instanceof CopyPlugin)) {
        return plugin;
      }

      return new CopyPlugin({
        patterns: [
          ...(includeRootAssets ? createRootAssetPatterns() : []),
          ...selectedToolIds.reduce((patterns, toolName) => {
            return patterns.concat([
              {
                ...createToolDocumentPattern(toolName)
              },
              ...(() => {
                const imagePattern = createToolFeaturedImagePattern(toolName);
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
