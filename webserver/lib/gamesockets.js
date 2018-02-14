const _ = require('lodash');
const config = require('../config');

const serverData = {};
const serverList = [];

const self = module.exports = {
  addConnection: (connection) => {
    const host = `${connection.remoteAddress}:${connection.remotePort}`;

    serverData.host = {};
    connection.name = host;

    return serverList.push(connection);
  },
  addMessage: (connection, data) => {
    return serverData[connection.host].messages.push({
      type: data.type,
      message: data.message,
      name: data.name,
      steam: data.steam,
      timestamp: new Date()
    });
  },
  broadcast: (data) => {
    return _.forEach(serverList, (server) => {
      self.writeData(server, data);
    });
  },
  checkMessageLimit: (connection) => {
    if (!serverData[connection.host].messages) {
      serverData[connection.host].messages = [];
    }

    if (serverData[connection.host].messages.length >= 250) {
      serverData[connection.host].messages.shift();
    }

    return;
  },
  connectionExists: (connection) => {
    return serverList.includes(connection);
  },
  deleteConnection: (connection) => {
    return serverList.splice(serverList.indexOf(connection), 1);
  },
  resetHost: (connection) => {
    const host = `${connection.remoteAddress}:${connection.remotePort}`;

    serverData.host = {};
    connection.name = host;

    return;
  },
  updateData: (connection, data) => {
    return Object.assign(serverData[connection.host], data);
  },
  writeData: (connection, data) => {
    data.password = config.socket.password;

    return connection.write(`${JSON.stringify(data)}\n`);
  }
};
