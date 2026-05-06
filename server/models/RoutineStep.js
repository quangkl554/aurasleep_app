const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RoutineStep = sequelize.define('RoutineStep', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    routineId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'routine_id'
    },
    stepOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'step_order'
    },
    time: {
        type: DataTypes.STRING(5),
        allowNull: false
    },
    action: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    label: {
        type: DataTypes.STRING(100)
    },
    lightIntensity: {
        type: DataTypes.INTEGER,
        field: 'light_intensity'
    },
    colorTemp: {
        type: DataTypes.INTEGER,
        field: 'color_temp'
    },
    sound: {
        type: DataTypes.STRING(50)
    },
    soundVolume: {
        type: DataTypes.INTEGER,
        field: 'sound_volume'
    },
    description: {
        type: DataTypes.TEXT
    }
}, {
    tableName: 'routine_steps',
    timestamps: false
});

module.exports = RoutineStep;
