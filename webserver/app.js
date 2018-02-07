const _ = require('lodash');
const carrier = require('carrier');
const config = require('./config');
const db = require('./models');
const net = require('net');

db.sequelize.sync();

const serverList = [];

net.createServer((connection) => {
  connection.name = `${connection.remoteAddress}:${connection.remotePort}`;

  serverList.push(connection);

  connection.on('close', () => {
    serverList.splice(serverList.indexOf(connection), 1);
  });

  connection.on('error', (error) => {
  });

  carrier.carry(connection, async(line) => {

  });
}).listen(config.socket.port || 19857);
