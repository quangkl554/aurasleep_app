const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeviceCommandHistory = sequelize.define('DeviceCommandHistory', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'user_id'
    },
    deviceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'device_id'
    },
    command: {
        type: DataTypes.STRING(80),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('queued', 'sent', 'simulated', 'failed'),
        defaultValue: 'simulated'
    },
    payload: {
        type: DataTypes.JSON
    },
    requestedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'requested_at'
    },
    executedAt: {
        type: DataTypes.DATE,
        field: 'executed_at'
    }
}, {
    tableName: 'device_command_history',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { fields: ['user_id', 'created_at'] },
        { fields: ['device_id', 'created_at'] },
        { fields: ['command'] }
    ]
});

module.exports = DeviceCommandHistory;
