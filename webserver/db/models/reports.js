module.exports = (sequelize, DataTypes) => {
  const Reports = sequelize.define('Reports', {
    id: {
      type: DataTypes.INTEGER(11),
      autoIncrement: true,
      primaryKey: true
    },
    reason: {
      type: DataTypes.STRING
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
  };

  return Reports;
};
