const _ = require('lodash');
const carrier = require('carrier');
const config = require('../config');
const net = require('net');

const serverData = {};
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
          const host = `${connection.remoteAddress}:${connection.remotePort}`;

          serverData.host = {};
          connection.name = host;

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
        if (!serverData[connection.host].messages) {
          serverData[connection.host].messages = [];
        }

        if (serverData[connection.host].messages.length >= 250) {
          serverData[connection.host].messages.shift();
        }

        return serverData[connection.host].messages.push({
          type: data.type,
          message: data.message,
          name: data.name,
          steam: data.steam,
          timestamp: new Date()
        });
        /*
        {
          type: 'chat',
          message: data.message,
          name: data.name,
          steam: data.steam
        }
        */
      }
      case 'players': {
        delete data.type;

        return Object.assign(serverData[connection.host], data);
        /*
        {
          type: data.type,
          players: data.players
        }
        */
      }
      case 'refresh': {
        delete data.type;

        return Object.assign(serverData[connection.host], data);
        /*
        {
          type: data.type,
          hostname: data.hostname,
          map: data.map,
          maxPlayers: data.maxPlayers,
          players: data.players
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
        }*/
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
