'use strict';

const Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * addColumn "updatedAt" to table "Users"
 * changeColumn "ReporterId" on table "Reports"
 * changeColumn "ReportedId" on table "Reports"
 * changeColumn "ServerId" on table "Reports"
 *
 **/

const info = {
  'revision': 2,
  'name': '1519228341558',
  'created': '2018-02-21T15:52:21.567Z',
  'comment': ''
};

const migrationCommands = [{
  fn: 'addColumn',
  params: [
    'Users',
    'updatedAt',
    {
      'type': Sequelize.DATE,
      'allowNull': false
    }
  ]
},
{
  fn: 'changeColumn',
  params: [
    'Reports',
    'ReporterId',
    {
      'type': Sequelize.INTEGER(11),
      'onDelete': 'CASCADE',
      'references': {
        'model': 'Users',
        'key': 'id'
      },
      'allowNull': true
    }
  ]
},
{
  fn: 'changeColumn',
  params: [
    'Reports',
    'ReportedId',
    {
      'type': Sequelize.INTEGER(11),
      'onDelete': 'CASCADE',
      'references': {
        'model': 'Users',
        'key': 'id'
      },
      'allowNull': true
    }
  ]
},
{
  fn: 'changeColumn',
  params: [
    'Reports',
    'ServerId',
    {
      'type': Sequelize.INTEGER(11),
      'onDelete': 'CASCADE',
      'references': {
        'model': 'Servers',
        'key': 'id'
      },
      'allowNull': true
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
