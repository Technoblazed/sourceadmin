const carrier = require('carrier');
const config = require('./config');
const db = require('./models');
const net = require('net');

db.sequelize.sync();

/**
 *  Socket Management
 */

const serverList = [];

net.createServer((connection) => {
  /**
   * Send Initial Auth Request
   */
  writeData(connection, {
    type: 'auth'
  });

  connection.on('close', () => {
    serverList.splice(serverList.indexOf(connection), 1);
  });

  connection.on('error', (error) => {
  });

  carrier.carry(connection, async(line) => {
    try {
      const data = await JSON.parse(line);

      switch (data.type) {
        case 'auth': {
          if (data.token === config.socket.password) {
            connection.name = `${connection.remoteAddress}:${connection.remotePort}`;
            serverList.push(connection);
          } else {
            writeData(connection, {
              type: 'error',
              data: 'Invalid socket password specified!'
            });
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
  });
}).listen(config.socket.port || 19857);

function writeData(connection, data) {
  data.password = config.socket.password;

  connection.write(`${JSON.stringify(data)}\n`);
}

/**
 *  Webserver Management
 */

const Koa = require('koa');
const path = require('path');
const webpack = require('webpack');
const middleware = require('koa-webpack');
const devBuildConfig = require(path.join(__dirname, 'webpack.dev.config'));

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
