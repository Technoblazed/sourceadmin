const _ = require('lodash');
const config = require('../config');
const db = require('../db/models/');
const websockets = require('./websockets');

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
          return self.addConnection(connection, data);
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
      case 'ban': {
        return;
        /*
        {
            type: "ban",
            auth: data.auth,
            uuid: data.uuid,
            response: data.bool
        }
        */
      }
      case 'chat':
      case 'chat_team': {
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
            type: "kick",
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
  addConnection: async(connection, data) => {
    const host = `${connection.remoteAddress}:${connection.remotePort}`;

    connection.name = host;

    try {
      const server = await db.Servers.findOrCreate({
        where: {
          ip: data.ip,
          hostname: data.hostname
        }
      });

      connection.ip = server[0].ip;
      connection.serverId = server[0].id;

      serverData[connection.ip] = {};
    } catch (e) {
      console.log(e);
    }

    return serverList.push(connection);
  },
  addMessage: async(connection, data) => {
    if (config.socket.logChat) {
      try {
        await db.sequelize.transaction((t) => {
          return db.Users.findOrCreate({
            where: {
              steamId: +data.steam,
              steamUsername: data.name
            },
            transaction: t
          }).then((user) => {
            return db.ChatLogs.create({
              ServerId: connection.serverId,
              UserId: user[0].id,
              type: self.messageType(data),
              message: data.message
            }, {
              transaction: t
            });
          });
        });
      } catch (e) {
        console.log(e);
      }
    }

    return websockets.broadcastMessage(connection, data);
  },
  broadcast: (data) => {
    return _.forEach(serverList, (server) => {
      self.writeData(server, data);
    });
  },
  connectionExists: (connection) => {
    return serverList.includes(connection);
  },
  deleteConnection: (connection) => {
    return serverList.splice(serverList.indexOf(connection), 1);
  },
  messageType: (data) => {
    switch (data.type) {
      case 'chat': {
        return data.message.startsWith('@') ? 0 : 1;
      }
      case 'chat_team': {
        return data.message.startsWith('@') ? 2 : 3;
      }
    }
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
