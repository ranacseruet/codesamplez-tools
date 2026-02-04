const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
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

const baseConfig = {
  mode: process.env.NODE_ENV || 'development',
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin(),
      new CssMinimizerPlugin()
    ]
  },
  resolve: {
    fallback: { "crypto": false }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
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
  entry: {
    main: [
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
      'process.platform': JSON.stringify(process.platform),
      'process.env': JSON.stringify({})
    }),
    new MiniCssExtractPlugin({
      filename: 'styles.main.css'
    }),
    new CopyPlugin({
      patterns: [
        {
          from: path.join(__dirname, toolName, 'index.html'),
          to: path.join(__dirname, 'build', toolName, 'index.html')
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
      'process.platform': JSON.stringify(process.platform),
      'process.env': JSON.stringify({})
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
              to: path.join(__dirname, 'build', toolName, 'index.html')
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

// Export based on environment
const config = process.env.NODE_ENV === 'development' ? developmentConfig : configs;
module.exports = config;
