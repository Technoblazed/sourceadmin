module.exports = (sequelize, DataTypes) => {
  const Reports = sequelize.define('Reports', {
    id: {
      type: DataTypes.INTEGER(11),
      autoIncrement: true,
      primaryKey: true
    },
    reason: {
      type: DataTypes.STRING
    },
    state: {
      type: DataTypes.TINYINT(1),
      defaultValue: 0
    },
    handledAt: {
      type: DataTypes.DATE,
      default: null
    },
    closedAt: {
      type: DataTypes.DATE,
      default: null
    }
  });

  Reports.associate = (models) => {
    Reports.belongsTo(models.Servers, {
      onDelete: 'CASCADE',
      foreignKey: 'ServerId',
      constraints: false
    });
    Reports.belongsTo(models.Users, {
      onDelete: 'CASCADE',
      foreignKey: 'ReportedId',
      constraints: false
    });
    Reports.belongsTo(models.Users, {
      onDelete: 'CASCADE',
      foreignKey: 'ReporterId',
      constraints: false
    });
    Reports.belongsTo(models.Users, {
      onDelete: 'CASCADE',
      foreignKey: 'HandlerId',
      constraints: false
    });
  };

  return Reports;
};
