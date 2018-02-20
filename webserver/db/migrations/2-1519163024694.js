'use strict';

const Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * createTable "Reports", deps: [Servers, Users, Users]
 * addColumn "userAddress" to table "Users"
 *
 **/

const info = {
  'revision': 2,
  'name': '1519163024694',
  'created': '2018-02-20T21:43:44.704Z',
  'comment': ''
};

const migrationCommands = [{
  fn: 'createTable',
  params: [
    'Reports',
    {
      'id': {
        'type': Sequelize.INTEGER(11),
        'primaryKey': true,
        'autoIncrement': true
      },
      'reason': {
        'type': Sequelize.STRING
      },
      'createdAt': {
        'type': Sequelize.DATE,
        'allowNull': false
      },
      'updatedAt': {
        'type': Sequelize.DATE,
        'allowNull': false
      },
      'ServerId': {
        'type': Sequelize.INTEGER(11),
        'onDelete': 'CASCADE',
        'references': {
          'model': 'Servers',
          'key': 'id'
        },
        'allowNull': true
      },
      'ReportedId': {
        'type': Sequelize.INTEGER(11),
        'onDelete': 'CASCADE',
        'references': {
          'model': 'Users',
          'key': 'id'
        },
        'allowNull': true
      },
      'ReporterId': {
        'type': Sequelize.INTEGER(11),
        'onDelete': 'CASCADE',
        'references': {
          'model': 'Users',
          'key': 'id'
        },
        'allowNull': true
      }
    },
    {}
  ]
},
{
  fn: 'addColumn',
  params: [
    'Users',
    'userAddress',
    {
      'type': Sequelize.STRING(15),
      'defaultValue': null
    }
  ]
}
];

module.exports = {
  pos: 0,
  up: function(queryInterface, Sequelize) {
    let index = this.pos;
    return new Promise(function(resolve, reject) {
      function next() {
        if (index < migrationCommands.length) {
          const command = migrationCommands[index];
          console.log('[#' + index + '] execute: ' + command.fn);
          index++;
          queryInterface[command.fn].apply(queryInterface, command.params).then(next, reject);
        } else {
          resolve();
        }
      }
      next();
    });
  },
  info: info
};
