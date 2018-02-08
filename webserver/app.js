const config = require('./config');
const db = require('./models');
const serverSockets = require('./lib/serverSockets');
const webserver = require('./lib/webserver');

db.sequelize.sync();
