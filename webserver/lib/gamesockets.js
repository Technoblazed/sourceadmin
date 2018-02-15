const _ = require('lodash');
const config = require('../config');

const serverData = {};
const serverList = [];

const carrier = require('carrier');
const net = require('net');

net.createServer((connection) => {
  self.writeData(connection, {
    type: 'auth'
  });

  connection.on('close', () => {
    self.deleteConnection(connection);
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

    if (!self.connectionExists(connection)) {
      if (data.type === 'auth') {
        if (data.password === config.socket.password) {
          return self.addConnection(connection);
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
        self.checkMessageLimit(connection);

        return self.addMessage(connection, data);
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
            uuid: data.uuid,
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
            uuid: data.uuid,
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
            uuid: data.uuid,
            success: data.bool
        }
        */
      }
      case 'players':
      case 'refresh': {
        delete data.type;

        return self.updateData(connection, data);
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
            uuid: data.uuid,
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
