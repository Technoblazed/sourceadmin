module.exports = (sequelize, DataTypes) => {
  const Users = sequelize.define('Users', {
    id: {
      type: DataTypes.INTEGER(11),
      autoIncrement: true,
      primaryKey: true
    },
    steamId: {
      type: DataTypes.BIGINT(18),
      defaultValue: null
    },
    steamAvatar: {
      type: DataTypes.STRING,
      defaultValue: null
    },
    steamUsername: {
      type: DataTypes.STRING,
      defaultValue: null
    },
    userlevel: {
      type: DataTypes.INTEGER(1),
      defaultValue: 0
    }
  });

  Users.associate = (models) => {
    Users.hasMany(models.ChatLogs);
  };

  return Users;
};
