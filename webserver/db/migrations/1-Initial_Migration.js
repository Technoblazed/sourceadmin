'use strict';

const Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * createTable "Servers", deps: []
 * createTable "Users", deps: []
 * createTable "ChatLogs", deps: [Servers, Users]
 *
 **/

const info = {
  'revision': 1,
  'name': 'Initial Migration',
  'created': '2018-02-20T15:43:52.897Z',
  'comment': ''
};

const migrationCommands = [{
  fn: 'createTable',
  params: [
    'Servers',
    {
      'id': {
        'type': Sequelize.INTEGER(11),
        'primaryKey': true,
        'autoIncrement': true
      },
      'ip': {
        'type': Sequelize.STRING,
        'defaultValue': null
      },
      'hostname': {
        'type': Sequelize.STRING(128),
        'defaultValue': null
      },
      'createdAt': {
        'type': Sequelize.DATE,
        'allowNull': false
      },
      'updatedAt': {
        'type': Sequelize.DATE,
        'allowNull': false
      }
    },
    {}
  ]
},
{
  fn: 'createTable',
  params: [
    'Users',
    {
      'id': {
        'type': Sequelize.INTEGER(11),
        'primaryKey': true,
        'autoIncrement': true
      },
      'steamId': {
        'type': Sequelize.BIGINT(18),
        'defaultValue': null
      },
      'steamAvatar': {
        'type': Sequelize.STRING,
        'defaultValue': null
      },
      'steamUsername': {
        'type': Sequelize.STRING,
        'defaultValue': null
      },
      'userlevel': {
        'type': Sequelize.INTEGER(1),
        'defaultValue': 0
      },
      'createdAt': {
        'type': Sequelize.DATE,
        'allowNull': false
      },
      'updatedAt': {
        'type': Sequelize.DATE,
        'allowNull': false
      }
    },
    {}
  ]
},
{
  fn: 'createTable',
  params: [
    'ChatLogs',
    {
      'id': {
        'type': Sequelize.INTEGER(11),
        'primaryKey': true,
        'autoIncrement': true
      },
      'type': {
        'type': Sequelize.INTEGER(1)
      },
      'message': {
        'type': Sequelize.STRING,
        'defaultValue': 0
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
        'onUpdate': 'CASCADE',
        'onDelete': 'CASCADE',
        'references': {
          'model': 'Servers',
          'key': 'id'
        },
        'allowNull': true
      },
      'UserId': {
        'type': Sequelize.INTEGER(11),
        'onUpdate': 'CASCADE',
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
