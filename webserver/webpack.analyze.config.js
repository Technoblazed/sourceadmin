const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const CleanWebpackPlugin = require('clean-webpack-plugin');
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');

const config = require('./config');
const core = require('./webpack.core.config');
const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: core.entryPoints.prod,
  output: {
    filename: 'app.min.js',
    path: path.resolve(__dirname, 'client', 'public', 'assets'),
    publicPath: '/assets/'
  },
  module: {
    rules: [
      {
        test: /\.(css|scss)$/,
        use: 'css-loader'
      },
      {
        test: /\.(png|woff|woff2|eot|ttf|svg|ico|otf)$/,
        loader: 'url-loader?limit=100000'
      },
      {
        test: /\.ico$/,
        loader: 'file-loader?name=[name].[ext]'
      }
    ]
  },
  plugins: [
    new BundleAnalyzerPlugin(),
    new CleanWebpackPlugin(['client/public/assets']),
    new webpack.DefinePlugin({
      'BASE_URL': config.steam.baseURL
    }),
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
    })
  ]
};
