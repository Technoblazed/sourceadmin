const _ = require('lodash');
const carrier = require('carrier');
const config = require('../config');
const net = require('net');

const serverList = [];

net.createServer((connection) => {
  self.writeData(connection, {
    type: 'auth'
  });

  connection.on('close', () => {
    serverList.splice(serverList.indexOf(connection), 1);
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

    if (!serverList.includes(connection)) {
      if (data.type === 'auth') {
        if (data.password === config.socket.password) {
          connection.name = `${connection.remoteAddress}:${connection.remotePort}`;

          return serverList.push(connection);
        } else {
          return self.writeData(connection, {
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
        return self.broadcast({
          type: 'chat',
          message: data.message,
          name: data.name,
          steam: data.steam
        });
      }
    }
  });
}).listen(config.socket.port || 19857);

const self = module.exports = {
  broadcast: (data) => {
    _.forEach(serverList, (server) => {
      self.writeData(server, data);
    });
  },
  writeData: (connection, data) => {
    data.password = config.socket.password;

    connection.write(`${JSON.stringify(data)}\n`);
  }
};