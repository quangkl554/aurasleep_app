const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BlogPost = sequelize.define('BlogPost', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    categoryId: {
        type: DataTypes.INTEGER,
        field: 'category_id'
    },
    title: {
        type: DataTypes.STRING(300),
        allowNull: false
    },
    slug: {
        type: DataTypes.STRING(300),
        allowNull: false,
        unique: true
    },
    content: {
        type: DataTypes.TEXT('long'),
        allowNull: false
    },
    excerpt: {
        type: DataTypes.STRING(500)
    },
    thumbnailUrl: {
        type: DataTypes.STRING(500),
        field: 'thumbnail_url'
    },
    readingTime: {
        type: DataTypes.INTEGER,
        defaultValue: 5,
        field: 'reading_time'
    },
    author: {
        type: DataTypes.STRING(100),
        defaultValue: 'AuraSleep Team'
    },
    isPublished: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_published'
    }
}, {
    tableName: 'blog_posts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = BlogPost;
