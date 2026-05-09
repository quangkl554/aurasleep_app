const { Notification } = require('../models');

async function createNotification({ userId, title, message, type = 'system', metadata = null }) {
    if (!userId || !title || !message) return null;

    try {
        return await Notification.create({
            userId,
            title,
            message,
            type,
            metadata
        });
    } catch (err) {
        console.warn(`Notification skipped (${type}):`, err.message);
        return null;
    }
}

module.exports = {
    createNotification
};
