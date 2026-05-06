const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserActivityEvent = sequelize.define('UserActivityEvent', {
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
    eventType: {
        type: DataTypes.STRING(80),
        allowNull: false,
        field: 'event_type'
    },
    entityType: {
        type: DataTypes.STRING(80),
        field: 'entity_type'
    },
    entityId: {
        type: DataTypes.STRING(80),
        field: 'entity_id'
    },
    metadata: {
        type: DataTypes.JSON
    },
    ipAddress: {
        type: DataTypes.STRING(100),
        field: 'ip_address'
    },
    userAgent: {
        type: DataTypes.STRING(500),
        field: 'user_agent'
    }
}, {
    tableName: 'user_activity_events',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { fields: ['user_id', 'created_at'] },
        { fields: ['event_type'] }
    ]
});

module.exports = UserActivityEvent;
