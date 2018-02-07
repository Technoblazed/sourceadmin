const _ = require('lodash');
const carrier = require('carrier');
const config = require('./config');
const db = require('./models');
const net = require('net');

db.sequelize.sync();

const serverList = [];

net.createServer((connection) => {
  /**
   * Send Initial Auth Request
   */
  writeData(connection, {
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
            writeData(connection, {
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

function writeData(connection, data) {
  data.password = config.socket.password;

  connection.write(`${JSON.stringify(data)}\n`);
}
