const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const {
    User,
    SleepProfile,
    Notification,
    Subscription,
    SleepRecord,
    SleepRoutine,
    RoutineStep,
    Device,
    DeviceCommandHistory,
    ChatSession,
    ChatMessage
} = require('../models');
const auth = require('../middleware/auth');
const { trackActivity, trackSession } = require('../utils/tracking');
const { createNotification } = require('../utils/notifications');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const vietnamPhonePattern = /^(0|\+84)(\d{9}|\d{10})$/;
const adminEmails = new Set(['quangkl554@gmail.com']);
const adminPhones = new Set(['0918885850']);

function normalizePhone(phone) {
    if (typeof phone !== 'string') return '';
    const trimmed = phone.trim();
    if (trimmed.startsWith('+84')) return `0${trimmed.slice(3)}`;
    return trimmed;
}

function isAdminAccount(userLike) {
    const email = String(userLike?.email || '').trim().toLowerCase();
    const phone = normalizePhone(userLike?.phone || userLike?.identifier || '');
    return adminEmails.has(email) || adminPhones.has(phone);
}

async function ensureAdminRole(user) {
    if (!user || !isAdminAccount(user) || user.role === 'admin') return user;
    await user.update({ role: 'admin' });
    user.role = 'admin';
    return user;
}

function signToken(userId) {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is missing');
    }

    return jwt.sign(
        { user: { id: userId } },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );
}

function publicUser(user) {
    const latestSubscription = user.subscription || user.Subscriptions?.[0] || null;
    return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        theme: user.theme,
        notifications: user.notifications,
        sleepProfile: user.sleepProfile || null,
        subscription: latestSubscription
    };
}

router.post('/register', async (req, res) => {
    try {
        const { fullName, email, password, phone } = req.body;
        const normalizedName = typeof fullName === 'string' ? fullName.trim() : '';
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const normalizedPhone = typeof phone === 'string' ? phone.trim() : null;

        if (!normalizedName || !normalizedEmail || !password) {
            return res.status(400).json({ message: 'Vui long nhap day du ho ten, email va mat khau' });
        }

        if (normalizedName.length > 50) {
            return res.status(400).json({ message: 'Ho ten khong duoc vuot qua 50 ky tu' });
        }

        if (!emailPattern.test(normalizedEmail) || normalizedEmail.length > 255) {
            return res.status(400).json({ message: 'Email khong hop le' });
        }

        if (typeof password !== 'string' || password.length < 6 || password.length > 30) {
            return res.status(400).json({ message: 'Mat khau phai tu 6 den 30 ky tu' });
        }

        if (normalizedPhone && !vietnamPhonePattern.test(normalizedPhone)) {
            return res.status(400).json({ message: 'So dien thoai phai dung dinh dang Viet Nam 10-11 so' });
        }

        const duplicateConditions = [{ email: normalizedEmail }];
        if (normalizedPhone) {
            duplicateConditions.push({ phone: normalizedPhone });
        }

        const existingUser = await User.findOne({ where: { [Op.or]: duplicateConditions } });
        if (existingUser) {
            const field = existingUser.email === normalizedEmail ? 'Email' : 'So dien thoai';
            return res.status(400).json({ message: `${field} da duoc su dung` });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const user = await User.create({
            fullName: normalizedName,
            email: normalizedEmail,
            passwordHash,
            phone: normalizedPhone,
            role: isAdminAccount({ email: normalizedEmail, phone: normalizedPhone }) ? 'admin' : 'user'
        });

        await SleepProfile.create({ userId: user.id });
        await Subscription.create({
            userId: user.id,
            plan: 'free',
            status: 'active',
            startDate: new Date()
        });
        await createNotification({
            userId: user.id,
            title: 'Chào mừng đến với AuraSleep',
            message: 'Tài khoản của bạn đã sẵn sàng. Hãy ghi nhận giấc ngủ đầu tiên để AuraSleep bắt đầu phân tích bằng dữ liệu thật.',
            type: 'welcome'
        });

        await trackSession(req, { userId: user.id, authEvent: 'register' });
        await trackActivity(req, {
            userId: user.id,
            eventType: 'user_registered',
            entityType: 'user',
            entityId: user.id,
            metadata: { authProvider: 'local' }
        });

        const createdUser = await User.findByPk(user.id, {
            include: [
                { model: SleepProfile, as: 'sleepProfile' },
                { model: Subscription, separate: true, limit: 1, order: [['created_at', 'DESC']] }
            ]
        });

        res.json({ token: signToken(user.id), user: publicUser(createdUser || user) });
    } catch (err) {
        console.error('Register error:', err.message);
        if (err.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ message: 'Email hoac so dien thoai da duoc su dung' });
        }
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, identifier, password } = req.body;

        const rawIdentifier = typeof identifier === 'string' ? identifier : email;
        const normalizedIdentifier = typeof rawIdentifier === 'string' ? rawIdentifier.trim() : '';
        const normalizedEmail = normalizedIdentifier.toLowerCase();

        if (!normalizedIdentifier || !password) {
            return res.status(400).json({ message: 'Vui long nhap email hoac so dien thoai va mat khau' });
        }

        const where = emailPattern.test(normalizedEmail)
            ? { email: normalizedEmail }
            : { phone: normalizedIdentifier };

        const user = await User.findOne({
            where,
            include: [
                { model: SleepProfile, as: 'sleepProfile' },
                { model: Subscription, separate: true, limit: 1, order: [['created_at', 'DESC']] }
            ]
        });
        if (!user) {
            return res.status(400).json({ message: 'Thong tin dang nhap khong hop le' });
        }
        await ensureAdminRole(user);

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Thong tin dang nhap khong hop le' });
        }

        await trackSession(req, { userId: user.id, authEvent: 'login' });
        await trackActivity(req, {
            userId: user.id,
            eventType: 'user_logged_in',
            entityType: 'user',
            entityId: user.id,
            metadata: { authProvider: 'local' }
        });

        res.json({ token: signToken(user.id), user: publicUser(user) });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['passwordHash'] },
            include: [
                { model: SleepProfile, as: 'sleepProfile' },
                { model: Subscription, separate: true, limit: 1, order: [['created_at', 'DESC']] }
            ]
        });

        if (!user) {
            return res.status(404).json({ message: 'Khong tim thay user' });
        }

        await ensureAdminRole(user);
        res.json(publicUser(user));
    } catch (err) {
        console.error('Me error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.put('/membership', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            include: [
                { model: SleepProfile, as: 'sleepProfile' },
                { model: Subscription, separate: true, limit: 1, order: [['created_at', 'DESC']] }
            ]
        });

        if (!user) return res.status(404).json({ message: 'Khong tim thay user' });
        await ensureAdminRole(user);
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Chi tai khoan quan tri moi duoc chuyen goi test' });
        }

        const plan = req.body.plan === 'premium_monthly' ? 'premium_monthly' : 'free';
        const price = plan === 'premium_monthly' ? 49000 : 0;
        const now = new Date();
        const endDate = new Date(now);
        endDate.setFullYear(endDate.getFullYear() + 1);

        let subscription = user.Subscriptions?.[0] || null;
        if (subscription) {
            await subscription.update({
                plan,
                price,
                status: 'active',
                startDate: now,
                endDate: plan === 'free' ? null : endDate,
                paymentMethod: 'admin_toggle',
                autoRenew: false
            });
        } else {
            subscription = await Subscription.create({
                userId: user.id,
                plan,
                price,
                status: 'active',
                startDate: now,
                endDate: plan === 'free' ? null : endDate,
                paymentMethod: 'admin_toggle'
            });
        }

        await trackActivity(req, {
            userId: user.id,
            eventType: 'membership_toggled',
            entityType: 'subscription',
            entityId: subscription.id,
            metadata: { plan, source: 'admin_profile_switch' }
        });

        const refreshedUser = await User.findByPk(user.id, {
            include: [
                { model: SleepProfile, as: 'sleepProfile' },
                { model: Subscription, separate: true, limit: 1, order: [['created_at', 'DESC']] }
            ]
        });

        res.json({ user: publicUser(refreshedUser) });
    } catch (err) {
        console.error('Membership update error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.get('/profile', auth, async (req, res) => {
    try {
        const [profile] = await SleepProfile.findOrCreate({
            where: { userId: req.user.id },
            defaults: { userId: req.user.id }
        });

        res.json(profile);
    } catch (err) {
        console.error('Profile get error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.put('/profile', auth, async (req, res) => {
    try {
        const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
        const allowedChronotypes = new Set(['morning', 'balanced', 'night']);
        const payload = {};

        if (Number.isInteger(req.body.targetSleepMin) && req.body.targetSleepMin >= 300 && req.body.targetSleepMin <= 600) {
            payload.targetSleepMin = req.body.targetSleepMin;
        }
        if (typeof req.body.preferredBedtime === 'string' && timePattern.test(req.body.preferredBedtime)) {
            payload.preferredBedtime = req.body.preferredBedtime;
        }
        if (typeof req.body.preferredWakeTime === 'string' && timePattern.test(req.body.preferredWakeTime)) {
            payload.preferredWakeTime = req.body.preferredWakeTime;
        }
        if (typeof req.body.chronotype === 'string' && allowedChronotypes.has(req.body.chronotype)) {
            payload.chronotype = req.body.chronotype;
        }
        if (typeof req.body.caffeineCutoff === 'string' && timePattern.test(req.body.caffeineCutoff)) {
            payload.caffeineCutoff = req.body.caffeineCutoff;
        }
        if (Number.isInteger(req.body.screenCutoffMin) && req.body.screenCutoffMin >= 0 && req.body.screenCutoffMin <= 180) {
            payload.screenCutoffMin = req.body.screenCutoffMin;
        }
        if (Number.isInteger(req.body.relaxReminderMin) && req.body.relaxReminderMin >= 0 && req.body.relaxReminderMin <= 120) {
            payload.relaxReminderMin = req.body.relaxReminderMin;
        }

        const [profile] = await SleepProfile.findOrCreate({
            where: { userId: req.user.id },
            defaults: { userId: req.user.id }
        });
        await profile.update(payload);

        await trackActivity(req, {
            userId: req.user.id,
            eventType: 'sleep_profile_updated',
            entityType: 'sleep_profile',
            entityId: profile.id,
            metadata: payload
        });

        res.json(profile);
    } catch (err) {
        console.error('Profile update error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.get('/notifications', auth, async (req, res) => {
    try {
        const notifications = await Notification.findAll({
            where: { userId: req.user.id },
            order: [['created_at', 'DESC']],
            limit: 80
        });
        res.json(notifications);
    } catch (err) {
        console.error('Notifications get error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.put('/notifications/:id/read', auth, async (req, res) => {
    try {
        const notification = await Notification.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!notification) {
            return res.status(404).json({ message: 'Khong tim thay thong bao' });
        }

        await notification.update({ readAt: notification.readAt || new Date() });
        res.json(notification);
    } catch (err) {
        console.error('Notification read error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.get('/export', auth, async (req, res) => {
    try {
        const [
            user,
            sleepProfile,
            sleepRecords,
            routines,
            devices,
            deviceCommands,
            notifications,
            chatSessions
        ] = await Promise.all([
            User.findByPk(req.user.id, { attributes: { exclude: ['passwordHash'] } }),
            SleepProfile.findOne({ where: { userId: req.user.id } }),
            SleepRecord.findAll({ where: { userId: req.user.id }, order: [['date', 'ASC']] }),
            SleepRoutine.findAll({ where: { userId: req.user.id }, include: [{ model: RoutineStep, as: 'steps' }] }),
            Device.findAll({ where: { userId: req.user.id } }),
            DeviceCommandHistory.findAll({ where: { userId: req.user.id }, order: [['created_at', 'DESC']] }),
            Notification.findAll({ where: { userId: req.user.id }, order: [['created_at', 'DESC']] }),
            ChatSession.findAll({ where: { userId: req.user.id }, include: [{ model: ChatMessage }] })
        ]);

        res.json({
            exportedAt: new Date().toISOString(),
            user,
            sleepProfile,
            sleepRecords,
            routines,
            devices,
            deviceCommands,
            notifications,
            chatSessions
        });
    } catch (err) {
        console.error('Export error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.delete('/account', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ message: 'Khong tim thay user' });
        await user.destroy();
        res.json({ message: 'Da xoa tai khoan va du lieu lien quan' });
    } catch (err) {
        console.error('Delete account error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

module.exports = router;
