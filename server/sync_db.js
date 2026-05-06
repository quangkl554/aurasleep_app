require('dotenv').config();

const { sequelize } = require('./models');

async function syncDatabase() {
    const alter = process.env.DB_SYNC_ALTER === 'true';

    try {
        await sequelize.sync(alter ? { alter: true } : {});
        console.log(`Database schema synced${alter ? ' with alter=true' : ''}.`);
        await sequelize.close();
    } catch (err) {
        console.error('Unable to sync database schema:', err);
        process.exitCode = 1;
    }
}

syncDatabase();
