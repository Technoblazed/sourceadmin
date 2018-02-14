const url = require('url');
const uuidv4 = require('uuid/v4');

const clientData = {};
const clientList = [];

module.exports = {
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
