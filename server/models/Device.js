const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Device = sequelize.define('Device', {
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
    deviceName: {
        type: DataTypes.STRING(100),
        defaultValue: 'AuraSleep Pro',
        field: 'device_name'
    },
    serialNumber: {
        type: DataTypes.STRING(50),
        unique: true,
        field: 'serial_number'
    },
    firmwareVersion: {
        type: DataTypes.STRING(20),
        defaultValue: '1.0.0',
        field: 'firmware_version'
    },
    isConnected: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_connected'
    },
    lightIntensity: {
        type: DataTypes.INTEGER,
        defaultValue: 60,
        field: 'light_intensity'
    },
    colorTemp: {
        type: DataTypes.INTEGER,
        defaultValue: 3200,
        field: 'color_temp'
    },
    activeSound: {
        type: DataTypes.STRING(50),
        field: 'active_sound'
    },
    soundVolume: {
        type: DataTypes.INTEGER,
        defaultValue: 50,
        field: 'sound_volume'
    },
    lastSyncAt: {
        type: DataTypes.DATE,
        field: 'last_sync_at'
    }
}, {
    tableName: 'devices',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = Device;
