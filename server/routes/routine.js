const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { SleepRoutine, RoutineStep, Subscription } = require('../models');
const { trackActivity } = require('../utils/tracking');
const { createNotification } = require('../utils/notifications');

const validActions = new Set(['light', 'sound', 'breathing', 'reminder', 'wake']);

function sanitizeTime(value, fallback = '22:00') {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

function sanitizeRepeatDays(days) {
    const allowed = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    const list = Array.isArray(days)
        ? days
        : String(days || 'mon,tue,wed,thu,fri,sat,sun').split(',');
    return list.filter((day) => allowed.has(day)).join(',') || 'mon,tue,wed,thu,fri,sat,sun';
}

function sanitizeSteps(steps, fallbackSound = 'rain') {
    const input = Array.isArray(steps) && steps.length
        ? steps
        : [
            { time: '22:00', action: 'sound', label: 'Bắt đầu thư giãn', sound: fallbackSound, soundVolume: 35, lightIntensity: 30, colorTemp: 3000 },
            { time: '22:30', action: 'breathing', label: 'Thở chậm', description: 'Hít 4 giây, giữ 2 giây, thở ra 6 giây.' },
            { time: '06:30', action: 'wake', label: 'Báo thức bình minh', lightIntensity: 70, colorTemp: 4200 }
        ];

    return input.slice(0, 8).map((step, index) => ({
        stepOrder: index + 1,
        time: sanitizeTime(step.time, index === 2 ? '06:30' : '22:00'),
        action: validActions.has(step.action) ? step.action : 'reminder',
        label: typeof step.label === 'string' && step.label.trim() ? step.label.trim().slice(0, 100) : `Bước ${index + 1}`,
        lightIntensity: Number.isInteger(step.lightIntensity) ? Math.max(0, Math.min(100, step.lightIntensity)) : null,
        colorTemp: Number.isInteger(step.colorTemp) ? Math.max(2700, Math.min(6500, step.colorTemp)) : null,
        sound: typeof step.sound === 'string' ? step.sound.slice(0, 50) : null,
        soundVolume: Number.isInteger(step.soundVolume) ? Math.max(0, Math.min(100, step.soundVolume)) : null,
        description: typeof step.description === 'string' ? step.description.trim().slice(0, 500) : null
    }));
}

async function hasPremium(userId) {
    const subscription = await Subscription.findOne({
        where: { userId, status: 'active' },
        order: [['created_at', 'DESC']]
    });
    return Boolean(subscription && subscription.plan !== 'free');
}

router.get('/', auth, async (req, res) => {
    try {
        const routines = await SleepRoutine.findAll({
            where: { userId: req.user.id },
            include: [{ model: RoutineStep, as: 'steps' }],
            order: [['created_at', 'DESC']]
        });
        res.json(routines);
    } catch (err) {
        console.error('Routine list error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const { name, repeatDays, steps, sound } = req.body;
        const normalizedName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 100) : 'Routine thư giãn';
        const existingCount = await SleepRoutine.count({ where: { userId: req.user.id } });
        const premium = await hasPremium(req.user.id);

        if (!premium && existingCount >= 3) {
            return res.status(403).json({ message: 'Gói miễn phí hỗ trợ tối đa 3 routine. Nâng cấp Premium để tạo thêm.' });
        }

        const routine = await SleepRoutine.create({
            userId: req.user.id,
            name: normalizedName,
            repeatDays: sanitizeRepeatDays(repeatDays),
            isActive: true
        });

        const normalizedSteps = sanitizeSteps(steps, sound);
        await RoutineStep.bulkCreate(normalizedSteps.map((step) => ({
            routineId: routine.id,
            ...step
        })));

        const newRoutine = await SleepRoutine.findByPk(routine.id, {
            include: [{ model: RoutineStep, as: 'steps' }]
        });

        await createNotification({
            userId: req.user.id,
            title: 'Đã tạo routine thư giãn',
            message: `${normalizedName} đã được lưu với ${normalizedSteps.length} bước. AuraSleep sẽ dùng lịch này để nhắc bạn chuẩn bị ngủ.`,
            type: 'routine'
        });

        await trackActivity(req, {
            userId: req.user.id,
            eventType: 'routine_created',
            entityType: 'sleep_routine',
            entityId: routine.id,
            metadata: {
                name: normalizedName,
                repeatDays: newRoutine.repeatDays,
                stepsCount: normalizedSteps.length
            }
        });

        res.json(newRoutine);
    } catch (err) {
        console.error('Routine create error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.put('/:id', auth, async (req, res) => {
    try {
        const routine = await SleepRoutine.findOne({
            where: { id: req.params.id, userId: req.user.id },
            include: [{ model: RoutineStep, as: 'steps' }]
        });

        if (!routine) {
            return res.status(404).json({ message: 'Khong tim thay routine' });
        }

        const payload = {};
        if (typeof req.body.name === 'string' && req.body.name.trim()) payload.name = req.body.name.trim().slice(0, 100);
        if (req.body.repeatDays !== undefined) payload.repeatDays = sanitizeRepeatDays(req.body.repeatDays);
        if (typeof req.body.isActive === 'boolean') payload.isActive = req.body.isActive;
        await routine.update(payload);

        if (Array.isArray(req.body.steps)) {
            const normalizedSteps = sanitizeSteps(req.body.steps, req.body.sound);
            await RoutineStep.destroy({ where: { routineId: routine.id } });
            await RoutineStep.bulkCreate(normalizedSteps.map((step) => ({
                routineId: routine.id,
                ...step
            })));
        }

        const updatedRoutine = await SleepRoutine.findByPk(routine.id, {
            include: [{ model: RoutineStep, as: 'steps' }]
        });

        await trackActivity(req, {
            userId: req.user.id,
            eventType: 'routine_updated',
            entityType: 'sleep_routine',
            entityId: routine.id,
            metadata: payload
        });

        res.json(updatedRoutine);
    } catch (err) {
        console.error('Routine update error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

module.exports = router;
