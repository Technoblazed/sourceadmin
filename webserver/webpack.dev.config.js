const config = require('./config');
const core = require('./webpack.core.config');
const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: core.entryPoints.dev,
  output: {
    filename: 'app.min.js',
    path: path.resolve(__dirname, 'client', 'public', 'assets'),
    publicPath: '/assets/'
  },
  module: {
    rules: [
      {
        test: /\.(css|scss)$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.(png|woff|woff2|eot|ttf|svg|otf)$/,
        loader: 'url-loader?limit=100000'
      },
      {
        test: /\.ico$/,
        loader: 'file-loader?name=[name].[ext]'
      }
    ]
  },
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.DefinePlugin({
      'BASE_URL': config.steam.baseURL
    }),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin()
  ]
};
