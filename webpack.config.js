const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const tools = [
  'base64-converter-tool',
  'css-minifier-tool',
  'diff-checker-tool',
  { name: 'js-minifier-tool', entry: 'app.js' },
  'json-formatter-tool',
  'jwt-builder-tool',
  'jwt-decoder-tool',
  'text-analyzer-tool'
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
        type: 'asset/resource'
      }
    ]
  }
};

const getToolConfig = (toolName, entry) => ({
  ...baseConfig,
  name: toolName,
  entry: {
    main: [
      `./${toolName}/${entry || 'script.js'}`,
      `./${toolName}/styles.css`
    ]
  },
  output: {
    path: path.resolve(__dirname, 'build', toolName),
    filename: 'bundle.js',
    publicPath: `/${toolName}/`
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'styles.css'
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
        ...(toolName === 'base64-converter-tool' ? [{
          from: path.join(__dirname, 'index.html'),
          to: path.join(__dirname, 'build', 'index.html')
        }] : [])
      ]
    })
  ]
});

const configs = tools.map((tool) => {
  const toolName = tool.name || tool;
  return getToolConfig(toolName, tool.entry);
});

const developmentConfig = {
  ...baseConfig,
  name: 'development',
  entry: tools.reduce((entries, tool) => {
    const toolName = tool.name || tool;
    entries[toolName] = [
      `./${toolName}/${tool.entry || 'script.js'}`,
      `./${toolName}/styles.css`
    ];
    return entries;
  }, {}),
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name]/bundle.js',
    publicPath: '/'
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name]/styles.css'
    }),
    new CopyPlugin({
      patterns: [
        {
          from: 'index.html',
          to: 'index.html'
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
    port: 8080,
    hot: true,
    open: false,
    historyApiFallback: true
  }
};

// Export based on environment
const config = process.env.NODE_ENV === 'development' ? developmentConfig : configs;
module.exports = config;
