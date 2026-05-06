const {
    UserActivityEvent,
    UserSession,
    DeviceCommandHistory,
    PaymentEvent
} = require('../models');

function getClientMeta(req) {
    return {
        ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
        userAgent: req.get?.('user-agent') || null
    };
}

async function safeCreate(Model, payload, label) {
    try {
        return await Model.create(payload);
    } catch (err) {
        console.warn(`Tracking skipped (${label}):`, err.message);
        return null;
    }
}

async function trackActivity(req, { userId, eventType, entityType, entityId, metadata }) {
    if (!userId || !eventType) return null;
    return safeCreate(UserActivityEvent, {
        userId,
        eventType,
        entityType,
        entityId: entityId === undefined || entityId === null ? null : String(entityId),
        metadata,
        ...getClientMeta(req)
    }, eventType);
}

async function trackSession(req, { userId, authEvent, authProvider = 'local' }) {
    if (!userId || !authEvent) return null;
    return safeCreate(UserSession, {
        userId,
        authEvent,
        authProvider,
        lastSeenAt: new Date(),
        ...getClientMeta(req)
    }, `session:${authEvent}`);
}

async function trackDeviceCommand(req, { userId, deviceId, command, payload, status = 'simulated' }) {
    if (!userId || !deviceId || !command) return null;
    return safeCreate(DeviceCommandHistory, {
        userId,
        deviceId,
        command,
        payload,
        status,
        executedAt: new Date()
    }, `device:${command}`);
}

async function trackPaymentEvent(req, { userId, orderId, eventType, transactionRef, planType, amount, status, payload }) {
    if (!userId || !eventType) return null;
    return safeCreate(PaymentEvent, {
        userId,
        orderId,
        eventType,
        transactionRef,
        planType,
        amount,
        status,
        payload
    }, `payment:${eventType}`);
}

module.exports = {
    trackActivity,
    trackSession,
    trackDeviceCommand,
    trackPaymentEvent
};
