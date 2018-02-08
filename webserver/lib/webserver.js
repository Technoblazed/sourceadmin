const Koa = require('koa');
const path = require('path');
const webpack = require('webpack');
const middleware = require('koa-webpack');
const devBuildConfig = require(path.join(__dirname, '..', 'webpack.dev.config'));

const app = new Koa();

const compiler = webpack(devBuildConfig);

app.use(middleware({
  compiler,
  config: devBuildConfig,
  dev: {
    publicPath: devBuildConfig.output.publicPath,
    hot: true,
    historyApiFallback: true,
    stats: {
      colors: true,
      hash: false,
      version: false,
      timings: false,
      assets: false,
      chunks: false,
      modules: false,
      reasons: false,
      children: false,
      source: false,
      errors: true,
      errorDetails: true,
      warnings: false
    }
  }
}));

app.use(async(ctx, next) => {
  ctx.body = '<html></html>';
});

app.listen(3000);
