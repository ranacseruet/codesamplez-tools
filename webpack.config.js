const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { injectToolPrerender } = require('./scripts/prerender-tool');
const tools = [
  'base64-converter-tool',
  'css-minifier-tool',
  'diff-checker-tool',
  'js-minifier-tool',
  'json-formatter-tool',
  'jwt-builder-tool',
  'jwt-decoder-tool',
  'text-analyzer-tool',
  'qr-code-generator',
  'data-format-converter'
];

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
const transformToolHtml = (toolName, htmlContent) => {
  return injectToolPrerender(toolName, htmlContent.toString());
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
    extensions: ['.js', '.jsx'],
    fallback: { "crypto": false }
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
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
    main: [
      './common/material-theme.css',
      './common/app-shell/app-shell.css',
      './common/shared-styles.css',
      `./${toolName}/script.js`,
      `./${toolName}/styles.css`
    ]
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
        ...(toolName === tools[0]
          ? [
              {
                from: 'index.html',
                to: path.join(__dirname, 'build', 'index.html')
              },
              {
                from: 'styles.css',
                to: path.join(__dirname, 'build', 'styles.css')
              }
            ]
          : []),
        {
          from: path.join(__dirname, toolName, 'index.html'),
          to: path.join(__dirname, 'build', toolName, 'index.html'),
          transform(content) {
            return transformToolHtml(toolName, content);
          }
        },
        {
          from: path.join(__dirname, toolName, 'images'),
          to: path.join(__dirname, 'build', toolName, 'images')
        },
        {
          from: 'robots.txt',
          to: path.join(__dirname, 'build', 'robots.txt')
        }
      ]
    })
  ]
});

const configs = tools.map((tool) => {
  return getToolConfig(tool);
});

const developmentConfig = {
  ...baseConfig,
  name: 'development',
  entry: tools.reduce((entries, tool) => {
    const toolName = tool.name || tool;
    entries[toolName] = [
      './common/material-theme.css',
      './common/app-shell/app-shell.css',
      './common/shared-styles.css',
      `./${toolName}/script.js`,
      `./${toolName}/styles.css`
    ];
    return entries;
  }, {}),
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
              from: path.join(__dirname, toolName, 'index.html'),
              to: path.join(__dirname, 'build', toolName, 'index.html'),
              transform(content) {
                return transformToolHtml(toolName, content);
              }
            },
            {
              from: path.join(__dirname, toolName, 'images'),
              to: path.join(__dirname, 'build', toolName, 'images')
            },
            {
              from: 'robots.txt',
              to: path.join(__dirname, 'build', 'robots.txt')
            }
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

module.exports = (_, argv = {}) => {
  const mode = getWebpackMode(argv);
  baseConfig.mode = mode;

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

  const productionConfigs = tools.map((tool) => applyMode(getToolConfig(tool)));
  const devConfig = applyMode(developmentConfig);

  return mode === 'development' ? devConfig : productionConfigs;
};
