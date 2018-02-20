module.exports = (sequelize, DataTypes) => {
  const Servers = sequelize.define('Servers', {
    id: {
      type: DataTypes.INTEGER(11),
      autoIncrement: true,
      primaryKey: true
    },
    ip: {
      type: DataTypes.STRING,
      defaultValue: null
    },
    hostname: {
      type: DataTypes.STRING(128),
      defaultValue: null
    }
  });

  Servers.associate = (models) => {
    Servers.hasMany(models.ChatLogs);
  };

  return Servers;
};
