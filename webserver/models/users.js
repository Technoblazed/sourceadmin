module.exports = (sequelize, DataTypes) => {
  const Users = sequelize.define('Users', {
    steamId: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    steamAvatar: {
      type: DataTypes.STRING
    },
    steamUsername: {
      type: DataTypes.STRING
    },
    userlevel: {
      type: DataTypes.INTEGER(1),
      defaultValue: 0
    }
  });

  return Users;
};
