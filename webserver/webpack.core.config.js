module.exports = {
  entryPoints: {
    dev: [
      'webpack-hot-middleware/client?path=/__webpack_hmr&timeout=20000',
      './client/src/js/app.js'
    ],
    prod: [
      './client/src/js/app.js'
    ]
  }
};
