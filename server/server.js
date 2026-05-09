const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

const requiredEnv = [
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET'
];

const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
    console.warn(`Missing required environment variables: ${missingEnv.join(', ')}`);
}

const configuredOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const localOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

const allowedOrigins = configuredOrigins.length > 0
    ? configuredOrigins
    : (isProduction ? [] : localOrigins);

app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (!isProduction && origin === 'null') return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('CORS origin is not allowed'));
    },
    credentials: true
}));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/sleep', require('./routes/sleep'));
app.use('/api/routines', require('./routes/routine'));
app.use('/api/devices', require('./routes/device'));
app.use('/api/payment', require('./routes/payment'));

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to AuraSleep API' });
});

app.get('/health', async (req, res) => {
    try {
        await sequelize.authenticate();
        res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
        res.status(503).json({ status: 'error', database: 'disconnected' });
    }
});

app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err.stack || err.message);
    const statusCode = err.message === 'CORS origin is not allowed' ? 403 : 500;
    const response = { message: 'Loi he thong noi bo' };
    if (!isProduction) response.error = err.message;
    res.status(statusCode).json(response);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

const shouldSync = process.env.DB_SYNC === 'true';
const dbReady = shouldSync
    ? sequelize.sync({ alter: true })
    : (isProduction ? sequelize.authenticate() : sequelize.sync({}));

dbReady
    .then(() => {
        console.log(shouldSync ? 'Database models synced successfully.' : 'Database connection verified.');
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Unable to sync database:', err);
        process.exit(1);
    });
