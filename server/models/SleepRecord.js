const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SleepRecord = sequelize.define('SleepRecord', {
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
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    bedtime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    wakeTime: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'wake_time'
    },
    totalSleepMin: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'total_sleep_min'
    },
    sleepScore: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'sleep_score'
    },
    efficiency: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    fallAsleepMin: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'fall_asleep_min'
    },
    remMin: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'rem_min'
    },
    deepMin: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'deep_min'
    },
    lightMin: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'light_min'
    },
    awakeMin: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'awake_min'
    },
    heartRateAvg: {
        type: DataTypes.INTEGER,
        field: 'heart_rate_avg'
    },
    notes: {
        type: DataTypes.TEXT
    }
}, {
    tableName: 'sleep_records',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        {
            unique: true,
            fields: ['user_id', 'date']
        }
    ]
});

module.exports = SleepRecord;
