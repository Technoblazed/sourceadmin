/**
 *  Global Requirements
 */

const config = require('./config');
const db = require('./db/models');

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

const isDev = app.get('env').trim() !== 'production';

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
  extended: true
}));

app.use(cookieParser());

const sessionParser = session({
  secret: config.webserver.sessionSecret,
  saveUninitialized: true,
  resave: true,
  proxy: true,
  store: new sequelizeStore({
    db: db.sequelize,
    expiration: 4 * 7 * 24 * 60 * 60 * 1000
  })
});

app.use(sessionParser);

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
  const steamAvatar = profile._json.avatarfull.split('/').slice(-2).join('/');

  db.Users.findOrCreate({
    where: {
      steamId: +profile.id
    }
  }).spread((user) => user.updateAttributes({
    steamAvatar,
    steamUsername: profile.displayName
  }).then(() => {
    done(null, {
      steamId: +profile.id,
      steamAvatar,
      steamUsername: profile.displayName
    });
  }).catch((err) => {
    done(err);
  }));
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  db.Users.find({
    where: {
      steamId: user.steamId
    }
  }).then((user) => {
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

module.exports = { app, server, sessionParser };

require('./lib/gamesockets');
require('./lib/websockets');
