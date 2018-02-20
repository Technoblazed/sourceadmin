const fs = require('fs');
const path = require('path');
const config = require('../../config');
const Sequelize = require('sequelize');
const sequelize = new Sequelize(config.db.database, config.db.username, config.db.password, {
  host: config.db.host,
  dialect: config.db.dialect,
  logging: config.db.logging ? console.log : false,
  operatorsAliases: Sequelize.Op
});

const db = {};

fs.readdirSync(__dirname).filter((file) => {
  return file.indexOf('.') !== 0 && file !== 'index.js';
}).forEach((file) => {
  const model = sequelize.import(path.join(__dirname, file));

  db[model.name] = model;
});

Object.keys(db).forEach((modelName) => {
  if ('associate' in db[modelName]) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
