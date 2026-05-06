const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subscription = sequelize.define('Subscription', {
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
    plan: {
        type: DataTypes.ENUM('free', 'premium_monthly', 'premium_yearly'),
        defaultValue: 'free'
    },
    price: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    status: {
        type: DataTypes.ENUM('active', 'expired', 'cancelled'),
        defaultValue: 'active'
    },
    startDate: {
        type: DataTypes.DATEONLY,
        field: 'start_date'
    },
    endDate: {
        type: DataTypes.DATEONLY,
        field: 'end_date'
    },
    paymentMethod: {
        type: DataTypes.STRING(50),
        field: 'payment_method'
    },
    transactionId: {
        type: DataTypes.STRING(100),
        field: 'transaction_id'
    },
    autoRenew: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'auto_renew'
    }
}, {
    tableName: 'subscriptions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = Subscription;
