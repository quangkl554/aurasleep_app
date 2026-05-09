const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SleepProfile = sequelize.define('SleepProfile', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        field: 'user_id'
    },
    targetSleepMin: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 480,
        field: 'target_sleep_min'
    },
    preferredBedtime: {
        type: DataTypes.STRING(5),
        defaultValue: '22:30',
        field: 'preferred_bedtime'
    },
    preferredWakeTime: {
        type: DataTypes.STRING(5),
        defaultValue: '06:30',
        field: 'preferred_wake_time'
    },
    chronotype: {
        type: DataTypes.ENUM('morning', 'balanced', 'night'),
        defaultValue: 'balanced'
    },
    caffeineCutoff: {
        type: DataTypes.STRING(5),
        defaultValue: '14:00',
        field: 'caffeine_cutoff'
    },
    screenCutoffMin: {
        type: DataTypes.INTEGER,
        defaultValue: 60,
        field: 'screen_cutoff_min'
    },
    relaxReminderMin: {
        type: DataTypes.INTEGER,
        defaultValue: 30,
        field: 'relax_reminder_min'
    }
}, {
    tableName: 'sleep_profiles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = SleepProfile;
