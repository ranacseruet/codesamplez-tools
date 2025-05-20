const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const fs = require('fs'); // Added fs

const tools = [
  'base64-converter-tool',
  'css-minifier-tool',
  'diff-checker-tool',
  'js-minifier-tool',
  'json-formatter-tool',
  'jwt-builder-tool',
  'jwt-decoder-tool',
  'text-analyzer-tool'
];

const readFileContent = (filePath) => {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        // console.warn(`Warning: Could not read ${filePath}. Content will be empty.`);
        return '';
    }
};

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
          filename: 'images/[hash][ext][query]' // Changed from assets to images to match CopyPlugin
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
    // Removed the IIFE that was incorrectly placed here
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['**/*', '!*.html']
    }),
    new MiniCssExtractPlugin({
      filename: 'styles.main.css'
    }),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.join(__dirname, toolName, 'index.html'),
      chunks: ['main'],
      templateParameters: (compilation, assets, assetTags, options) => {
        // Access the pre-read content from the immediately invoked function's result
        // This is a bit of a workaround to get the content into templateParameters
        // A cleaner way might involve passing it through a custom plugin option or a global variable
        // For now, let's assume the IIFE result is accessible or re-read it here if simpler.
        // Re-reading for simplicity in this context:
        const headerPath = path.join(__dirname, 'common', 'header.html');
        const footerPath = path.join(__dirname, 'common', 'footer.html');
        const localHeaderContent = readFileContent(headerPath);
        const localFooterContent = readFileContent(footerPath);
        return {
          compilation,
          webpackConfig: compilation.options,
          htmlWebpackPlugin: {
            tags: assetTags,
            files: assets,
            options: options
          },
          header: localHeaderContent,
          footer: localFooterContent
        };
      },
      minify: (toolName === 'diff-checker-tool' || toolName === 'js-minifier-tool') ? false : {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true,
      }
    }),
    new CopyPlugin({
      patterns: [
        {
          from: path.join(__dirname, toolName, 'images'),
          to: path.join(__dirname, 'build', toolName, 'images'), // Ensure images are copied to build/[toolName]/images
          noErrorOnMissing: true
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
  }, {
    // Add a dedicated entry for shared styles for the main landing page
    shared_styles_entry: './common/shared-styles.css'
  }),
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name]/bundle.main.js', // JS bundles will go into [name]/
    publicPath: '/'
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['**/*', '!*.html']
    }),
    new MiniCssExtractPlugin({
      filename: '[name]/styles.main.css' // CSS bundles will also go into [name]/
    }),
    // Add HtmlWebpackPlugin for the main index.html
    (() => {
        const headerPath = path.join(__dirname, 'common', 'header.html');
        const footerPath = path.join(__dirname, 'common', 'footer.html');
        let localHeaderContent = '';
        let localFooterContent = '';
        try {
            localHeaderContent = fs.readFileSync(headerPath, 'utf8');
        } catch (e) { /* console.warn(`Dev: Could not read ${headerPath}. Header will be empty.`); */ }
        try {
            localFooterContent = fs.readFileSync(footerPath, 'utf8');
        } catch (e) { /* console.warn(`Dev: Could not read ${footerPath}. Footer will be empty.`); */ }
        return new HtmlWebpackPlugin({
            filename: 'index.html', // Output to build/index.html
            template: path.join(__dirname, 'index.html'), // Source from root index.html
            chunks: ['shared_styles_entry'], // Link to the shared_styles_entry CSS
            templateParameters: {
                header: localHeaderContent,
                footer: localFooterContent
            }
        });
    })(),
    // Add HtmlWebpackPlugin for each tool in developmentConfig
    ...tools.map(toolName => {
        const headerPath = path.join(__dirname, 'common', 'header.html');
        const footerPath = path.join(__dirname, 'common', 'footer.html');
        let localHeaderContent = '';
        let localFooterContent = '';
        try {
            localHeaderContent = fs.readFileSync(headerPath, 'utf8');
        } catch (e) { /* console.warn(`Dev: Could not read ${headerPath}. Header will be empty.`); */ }
        try {
            localFooterContent = fs.readFileSync(footerPath, 'utf8');
        } catch (e) { /* console.warn(`Dev: Could not read ${footerPath}. Footer will be empty.`); */ }

        return new HtmlWebpackPlugin({
            filename: `${toolName}/index.html`,
            template: path.join(__dirname, toolName, 'index.html'),
            chunks: [toolName], // Ensure correct chunk is associated
            templateParameters: {
                header: localHeaderContent,
                footer: localFooterContent
            }
        });
    }),
    new CopyPlugin({
      patterns: [
        // },
        // Copy images for all tools
        ...tools.map(toolName => ({
          from: path.join(__dirname, toolName, 'images'),
          to: path.join(__dirname, 'build', toolName, 'images'),
          noErrorOnMissing: true
        }))
      ]
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'build'),
      publicPath: '/'
    },
    compress: true,
    port: 8081, // Changed port from 8080 to 8081
    hot: true,
    open: false,
    historyApiFallback: true
  }
};

// Export based on environment
const config = process.env.NODE_ENV === 'development' ? developmentConfig : configs;
module.exports = config;
