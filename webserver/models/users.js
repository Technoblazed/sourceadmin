module.exports = (sequelize, DataTypes) => {
  const Users = sequelize.define('Users', {
    steamId: {
      type: DataTypes.INTEGER(18),
      primaryKey: true
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

  return Users;
};
