const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
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
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource'
      }
    ]
  },
  devServer: {
    static: [{
      directory: path.join(__dirname, 'build'),
      publicPath: '/'
    }],
    compress: true,
    port: 8080,
    hot: true,
    open: false,
    historyApiFallback: {
      rewrites: [
        { from: /^\/$/, to: '/index.html' }
      ]
    }
  }
};

const configs = tools.map((tool) => {
  const toolName = tool.name || tool;
  const config = {
    ...baseConfig,
    name: toolName,
    entry: `./${toolName}/${tool.entry || 'script.js'}`,
    output: {
      path: path.resolve(__dirname, 'build', toolName),
      filename: 'bundle.js',
      publicPath: `/${toolName}/`
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: path.join(__dirname, toolName, 'index.html'),
            to: path.join(__dirname, 'build', toolName, 'index.html')
          },
          {
            from: path.join(__dirname, toolName, 'styles.css'),
            to: path.join(__dirname, 'build', toolName, 'styles.css')
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
    ],
    devServer: {
      ...baseConfig.devServer,
      devMiddleware: {
        publicPath: `/${toolName}`
      },
      historyApiFallback: {
        rewrites: [
          { from: /^\/$/, to: '/index.html' },
          { from: new RegExp(`^/${toolName}`), to: `/${toolName}/index.html` }
        ]
      }
    }
  };
  return config;
});

const developmentConfig = {
  ...baseConfig,
  name: 'development',
  entry: {
    root: './base64-converter-tool/script.js',
    ...tools.reduce((entries, tool) => {
      const toolName = tool.name || tool;
      entries[toolName] = `./${toolName}/${tool.entry || 'script.js'}`;
      return entries;
    }, {})
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name]/bundle.js',
    publicPath: '/'
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.join(__dirname, 'index.html'),
          to: path.join(__dirname, 'build', 'index.html')
        },
        ...tools.reduce((patterns, tool) => {
          const toolName = tool.name || tool;
          return patterns.concat([
            {
              from: path.join(__dirname, toolName, 'index.html'),
              to: path.join(__dirname, 'build', toolName, 'index.html')
            },
            {
              from: path.join(__dirname, toolName, 'styles.css'),
              to: path.join(__dirname, 'build', toolName, 'styles.css')
            },
            {
              from: path.join(__dirname, toolName, 'images'),
              to: path.join(__dirname, 'build', toolName, 'images')
            }
          ]);
        }, [])
      ]
    })
  ]
};

// Export based on environment
const config = process.env.NODE_ENV === 'development' ? developmentConfig : configs;
module.exports = config;
