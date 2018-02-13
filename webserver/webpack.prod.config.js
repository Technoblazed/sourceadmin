const CleanWebpackPlugin = require('clean-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const PurifyCSSPlugin = require('purifycss-webpack');

const glob = require('glob-all');
const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: [
    './client/src/js/app.js'
  ],
  output: {
    filename: 'app.min.js',
    path: path.resolve(__dirname, 'client', 'public', 'assets'),
    publicPath: '/assets/'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: 'css-loader'
        })
      },
      {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: 'css-loader'
        })
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: [
          'file-loader'
        ]
      },
      {
        test: /\.svg$/,
        loader: 'url-loader',
        query: {
          mimetype: 'image/svg+xml',
          name: './client/src/css/semantic/themes/default/assets/fonts/icons.svg'
        }
      },
      {
        test: /\.woff$/,
        loader: 'url-loader',
        query: {
          mimetype: 'application/font-woff',
          name: './client/src/css/semantic/themes/default/assets/fonts/icons.woff'
        }
      },
      {
        test: /\.woff2$/,
        loader: 'url-loader',
        query: {
          mimetype: 'application/font-woff2',
          name: './client/src/css/semantic/themes/default/assets/fonts/icons.woff2'
        }
      },
      {
        test: /\.[ot]tf$/,
        loader: 'url-loader',
        query: {
          mimetype: 'application/octet-stream',
          name: './client/src/css/semantic/themes/default/assets/fonts/icons.ttf'
        }
      },
      {
        test: /\.eot$/,
        loader: 'url-loader',
        query: {
          mimetype: 'application/vnd.ms-fontobject',
          name: './client/src/css/semantic/themes/default/assets/fonts/icons.eot'
        }
      }
    ]
  },
  plugins: [
    new CleanWebpackPlugin(['client/public/assets']),
    new ExtractTextPlugin('app.min.css'),
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false,
        drop_console: true
      },
      output: {
        'ascii_only': true
      }
    }),
    new OptimizeCssAssetsPlugin({
      cssProcessorOptions: {
        discardComments: {
          removeAll: true
        }
      }
    }),
    new PurifyCSSPlugin({
      paths: glob.sync([
        path.join(__dirname, 'client', 'src', 'js', '*.js'),
        path.join(__dirname, 'views', '*.njk')
      ])
    })
  ]
};
