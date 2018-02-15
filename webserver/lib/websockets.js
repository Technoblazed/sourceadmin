const app = require('../app');
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
        done(true, 200);
      } else {
        done(false, 401);
      }
    });
  }
});

wss.on('connection', (connection, req) => {
  self.addConnection(connection, req);

  console.log('Added connection');

  connection.on('close', () => {
    self.deleteConnection(connection);

    console.log('disconnected');
  });

  connection.on('error', () => {
  });

  connection.on('message', (message) => {
    console.log(`Received: ${message}`);

    setInterval(() => {
      if (connection.readyState === WebSocket.OPEN) {
        connection.send(`${new Date()}`);
      }
    }, 1000);
  });
});

const self = module.exports = {
  addConnection: (connection, req) => {
    clientData.host = {};

    connection.location = url.parse(req.url, true);
    connection.uuid = uuidv4();

    return clientList.push(connection);
  },
  deleteConnection: (connection) => {
    return clientList.splice(clientList.indexOf(connection), 1);
  }
};
