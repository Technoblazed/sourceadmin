/**
 *  Global Requirements
 */

const config = require('./config');
const db = require('./models');

/**
 *  Gameserver Socket Management
 */

const carrier = require('carrier');
const net = require('net');
const gamesockets = require('./lib/gamesockets');

net.createServer((connection) => {
  gamesockets.writeData(connection, {
    type: 'auth'
  });

  connection.on('close', () => {
    gamesockets.deleteConnection(connection);
  });

  connection.on('error', (error) => {
  });

  carrier.carry(connection, async(line) => {
    let data;

    try {
      data = JSON.parse(line);
    } catch (e) {
      console.log(e);

      return;
    }

    if (!gamesockets.connectionExists(connection)) {
      if (data.type === 'auth') {
        if (data.password === config.socket.password) {
          return gamesockets.addConnection(connection);
        } else {
          return gamesockets.writeData(connection, {
            type: 'error',
            data: 'Invalid socket password specified!'
          });
        }
      } else {
        return;
      }
    }

    switch (data.type) {
      case 'chat':
      case 'chat_team': {
        gamesockets.checkMessageLimit(connection);

        return gamesockets.addMessage(connection, data);
        /*
        {
            type: 'chat',
            message: data.message,
            name: data.name,
            steam: data.steam
        }
        */
      }
      case 'cvar': {
        return;
        /*
        {
            type: "cvar",
            auth: data.auth,
            response: data.bool
        }
        */
      }
      case 'kick': {
        return;
        /*
        {
            type: "cvar",
            auth: data.auth,
            response: data.bool
        }
        */
      }
      case 'map': {
        return;
        /*
        {
            type: "map",
            auth: data.auth,
            success: data.bool
        }
        */
      }
      case 'players':
      case 'refresh': {
        delete data.type;

        return gamesockets.updateData(connection, data);
        /*
        {
            type: data.type,
            playerList: data.players
        }
        {
            type: data.type,
            hostname: data.hostname,
            map: data.map,
            maxPlayers: data.maxPlayers,
            players: data.players
        }
        */
      }
      case 'rcon': {
        return;
        /*
        {
            type: "rcon",
            auth: data.auth,
            response: data.bool
        }
        */
      }
      case 'report': {
        return;
        /*
        {
            type: data.type,
            ip: data.cAddress,
            tAddress: data.tAddress,
            cAuth: data.cAuth,
            tAuth: data.tAuth,
            cName: data.cName,
            tName: data.tName,
            sAddress: data.ip,
            reason: data.reason
        }
        */
      }
    }
  });
}).listen(config.socket.port || 19857);

/**
 *  Webserver Management
 */

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const expressNunjucks = require('express-nunjucks');
const favicon = require('serve-favicon');
const logger = require('morgan');
const passport = require('passport');
const steamStrategy = require('passport-steam').Strategy;
const path = require('path');
const session = require('express-session');
const sequelizeStore = require('connect-session-sequelize')(session.Store);

const app = express();
const server = require('http').createServer(app);

const isDev = app.get('env') !== 'production';

if (isDev) {
  const webpack = require('webpack');
  const webpackDevMiddleware = require('webpack-dev-middleware');
  const webpackHotMiddleware = require('webpack-hot-middleware');
  const devBuildConfig = require(path.join(__dirname, 'webpack.dev.config'));

  const compiler = webpack(devBuildConfig);

  app.use(webpackDevMiddleware(compiler, {
    filename: 'app.min.js',
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
  }));

  app.use(webpackHotMiddleware(compiler, {
    log: console.log,
    path: '/__webpack_hmr',
    heartbeat: 10 * 1000
  }));

  app.use(logger('dev'));
}

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'njk');

expressNunjucks(app, {
  watch: isDev,
  noCache: isDev,
  filters: {}
});

app.use(favicon(path.join(__dirname, 'client', 'public', 'assets', 'favicon.ico')));
app.use('/assets', express.static(path.join(__dirname, 'client', 'public', 'assets')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));

app.use(cookieParser());

app.use(session({
  secret: config.webserver.sessionSecret,
  saveUninitialized: true,
  resave: true,
  proxy: true,
  store: new sequelizeStore({
    db: db.sequelize,
    expiration: 4 * 7 * 24 * 60 * 60 * 1000
  })
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.SITE_NAME = config.webserver.siteName,
  res.locals.IS_DEV = isDev;
  res.locals.USER = req.user;
  res.locals.PATH = req.url;

  next();
});

app.use(require(path.join(__dirname, 'routes', 'index'))());
app.use(require(path.join(__dirname, 'routes', 'auth'))(passport));

passport.use(new steamStrategy({
  returnURL: `${config.steam.baseURL}auth/steam/callback`,
  realm: config.steam.baseURL,
  apiKey: config.steam.apiKey
}, (identifier, profile, done) => {
  db.Users.findOrCreate({
    where: {
      steamId: profile._json.steamid
    }
  }).spread((user) => user.updateAttributes({
    steamAvatar: profile.id,
    steamUsername: profile.displayName
  }).then(() => {
    done(null, profile.id);
  }).catch((err) => {
    done(err);
  }));
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((id, done) => {
  db.Users.findById(id).then((user) => {
    done(null, user);
  }).catch((err) => {
    done(err);
  });
});

app.use((req, res, next) => {
  const err = new Error('Not Found');

  err.status = 404;

  next(err);
});

app.use((err, req, res) => {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: isDev ? err : {}
  });
});

module.exports = { app, server };

/**
 *  Webserver Socket Management
 */

const WebSocket = require('ws');
const websockets = require('./lib/websockets');

const wss = new WebSocket.Server({ server });

wss.on('connection', (connection, req) => {
  websockets.addConnection(connection, req);

  console.log('Added connection');

  connection.on('close', () => {
    websockets.deleteConnection(connection);

    console.log('disconnected');
  });

  connection.on('error', () => {
  });

  connection.on('message', (message) => {
    console.log(`Received: ${message}`);

    setInterval(() => {
      if (connection.readyState === WebSocket.OPEN) {
        console.log(connection.uuid);
        connection.send(`${new Date()}`);
      }
    }, 1000);
  });
});
