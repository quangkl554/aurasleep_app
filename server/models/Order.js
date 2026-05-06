const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
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
    productName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: 'product_name'
    },
    quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    unitPrice: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'unit_price'
    },
    totalAmount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'total_amount'
    },
    status: {
        type: DataTypes.ENUM('pending', 'paid', 'shipped', 'delivered', 'cancelled'),
        defaultValue: 'pending'
    },
    shippingName: {
        type: DataTypes.STRING(100),
        field: 'shipping_name'
    },
    shippingPhone: {
        type: DataTypes.STRING(20),
        field: 'shipping_phone'
    },
    shippingAddress: {
        type: DataTypes.TEXT,
        field: 'shipping_address'
    },
    paymentMethod: {
        type: DataTypes.STRING(50),
        field: 'payment_method'
    },
    transactionId: {
        type: DataTypes.STRING(100),
        field: 'transaction_id'
    }
}, {
    tableName: 'orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Order;
