const _ = require('lodash');
const app = require('../app');
const config = require('../config');
const server = app.server;
const sessionParser = app.sessionParser;
const url = require('url');
const uuidv4 = require('uuid/v4');

const clientData = {};
const clientList = [];

const WebSocket = require('ws');

const wss = new WebSocket.Server({
  server,
  verifyClient: (info, done) => {
    sessionParser(info.req, {}, () => {
      if (info.req.session.passport.user) {
        done(true);
      } else {
        done(false, 1008, 'User Not Authenticated');
      }
    });
  }
});

wss.on('connection', (connection, req) => {
  if (!self.isOriginAllowed(req.headers.origin)) {
    connection.close(1008, 'Invalid connection origin');

    console.log(new Date() + ' Connection from origin ' + req.headers.origin + ' rejected.');

    return;
  }

  self.addConnection(connection, req);

  console.log(`${new Date()}: Connection from origin ${req.headers.origin} added.`);

  connection.on('close', () => {
    self.deleteConnection(connection);

    console.log(`${new Date()}: Connection from origin ${req.headers.origin} deleted.`);
  });

  connection.on('error', () => {
  });

  connection.on('message', (message) => {
    console.log(`${new Date()}: Received: ${message}`);

    let data;

    try {
      data = JSON.parse(message);
    } catch (e) {
      console.log(e);

      return;
    }

    console.log(data);
  });
});

const self = module.exports = {
  addConnection: (connection, req) => {
    const uuid = uuidv4();

    clientData[uuid] = {
      data: req.session.passport.user
    };

    connection.location = url.parse(req.url, true);
    connection.uuid = uuid;

    clientList.push(connection);

    return self.broadcast({
      type: 'adminUpdate',
      adminList: clientData
    });
  },
  broadcast: (message, target) => {
    _.forEach(clientList, (client) => {
      if (!target || client.location.path === target) {
        self.sendMessage(client, message);
      }
    });

    return;
  },
  deleteConnection: (connection) => {
    delete clientData[connection.uuid];

    clientList.splice(clientList.indexOf(connection), 1);

    return self.broadcast({
      type: 'adminUpdate',
      adminList: clientData
    });
  },
  isOriginAllowed: (origin) => {
    const baseHost = url.parse(config.steam.baseURL, true).host;
    const originHost = url.parse(origin, true).host;

    return baseHost === originHost;
  },
  sendMessage: (connection, message) => {
    if (connection.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify(message));
    }
  }
};
