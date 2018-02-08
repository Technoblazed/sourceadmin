const carrier = require('carrier');
const config = require('./config');
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
    try {
      const data = await JSON.parse(line);

      switch (data.type) {
        case 'auth': {
          if (data.token === config.socket.password) {
            connection.name = `${connection.remoteAddress}:${connection.remotePort}`;
            serverList.push(connection);
          } else {
            self.writeData(connection, {
              type: 'error',
              data: 'Invalid socket password specified!'
            });
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
  });
}).listen(config.socket.port || 19857);

const self = module.exports = {
  writeData: (connection, data) => {
    data.password = config.socket.password;

    connection.write(`${JSON.stringify(data)}\n`);
  }
};
