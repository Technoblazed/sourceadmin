const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: [
    'webpack-hot-middleware/client?reload=true',
    './src/js/app.js'
  ],
  output: {
    filename: 'app.js',
    path: path.resolve(__dirname, 'public', 'assets'),
    publicPath: '/assets/'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: [
          'file-loader'
        ]
      },
      { test: /\.svg$/,
        loader: 'url-loader',
        query: {
          mimetype: 'image/svg+xml',
          name: './src/css/semantic/themes/default/assets/fonts/icons.svg'
        }
      },
      {
        test: /\.woff$/,
        loader: 'url-loader',
        query: {
          mimetype: 'application/font-woff',
          name: './src/css/semantic/themes/default/assets/fonts/icons.woff'
        }
      },
      {
        test: /\.woff2$/,
        loader: 'url-loader',
        query: {
          mimetype: 'application/font-woff2',
          name: './src/css/semantic/themes/default/assets/fonts/icons.woff2'
        }
      },
      {
        test: /\.[ot]tf$/,
        loader: 'url-loader',
        query: {
          mimetype: 'application/octet-stream',
          name: './src/css/semantic/themes/default/assets/fonts/icons.ttf'
        }
      },
      {
        test: /\.eot$/,
        loader: 'url-loader',
        query: {
          mimetype: 'application/vnd.ms-fontobject',
          name: './src/css/semantic/themes/default/assets/fonts/icons.eot'
        }
      }
    ]
  },
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin()
  ]
};
