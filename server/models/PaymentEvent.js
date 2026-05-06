const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PaymentEvent = sequelize.define('PaymentEvent', {
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
    orderId: {
        type: DataTypes.INTEGER,
        field: 'order_id'
    },
    provider: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'vnpay'
    },
    eventType: {
        type: DataTypes.STRING(80),
        allowNull: false,
        field: 'event_type'
    },
    transactionRef: {
        type: DataTypes.STRING(100),
        field: 'transaction_ref'
    },
    planType: {
        type: DataTypes.STRING(50),
        field: 'plan_type'
    },
    amount: {
        type: DataTypes.INTEGER
    },
    status: {
        type: DataTypes.STRING(50),
        defaultValue: 'pending'
    },
    payload: {
        type: DataTypes.JSON
    }
}, {
    tableName: 'payment_events',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { fields: ['user_id', 'created_at'] },
        { fields: ['provider', 'transaction_ref'] },
        { fields: ['event_type'] }
    ]
});

module.exports = PaymentEvent;
