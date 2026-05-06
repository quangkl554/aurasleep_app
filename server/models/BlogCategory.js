const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BlogCategory = sequelize.define('BlogCategory', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    slug: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'blog_categories',
    timestamps: false
});

module.exports = BlogCategory;
