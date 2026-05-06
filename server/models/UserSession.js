const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserSession = sequelize.define('UserSession', {
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
    authEvent: {
        type: DataTypes.ENUM('register', 'login'),
        allowNull: false,
        field: 'auth_event'
    },
    authProvider: {
        type: DataTypes.STRING(50),
        defaultValue: 'local',
        field: 'auth_provider'
    },
    status: {
        type: DataTypes.ENUM('active', 'expired', 'revoked'),
        defaultValue: 'active'
    },
    ipAddress: {
        type: DataTypes.STRING(100),
        field: 'ip_address'
    },
    userAgent: {
        type: DataTypes.STRING(500),
        field: 'user_agent'
    },
    lastSeenAt: {
        type: DataTypes.DATE,
        field: 'last_seen_at'
    }
}, {
    tableName: 'user_sessions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['user_id', 'created_at'] },
        { fields: ['status'] }
    ]
});

module.exports = UserSession;
