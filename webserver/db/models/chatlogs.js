module.exports = (sequelize, DataTypes) => {
  const ChatLogs = sequelize.define('ChatLogs', {
    id: {
      type: DataTypes.INTEGER(11),
      autoIncrement: true,
      primaryKey: true
    },
    type: {
      type: DataTypes.INTEGER(1)
    },
    message: {
      type: DataTypes.STRING,
      defaultValue: 0
    }
  });

  ChatLogs.associate = (models) => {
    ChatLogs.belongsTo(models.Servers, {
      onDelete: 'CASCADE',
      foreignKey: 'ServerId',
      constraints: false
    });
    ChatLogs.belongsTo(models.Users, {
      onDelete: 'CASCADE',
      foreignKey: 'UserId',
      constraints: false
    });
  };

  return ChatLogs;
};