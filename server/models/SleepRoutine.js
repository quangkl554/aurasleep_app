const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SleepRoutine = sequelize.define('SleepRoutine', {
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
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_active'
    },
    repeatDays: {
        type: DataTypes.STRING(50),
        field: 'repeat_days'
    }
}, {
    tableName: 'sleep_routines',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = SleepRoutine;
