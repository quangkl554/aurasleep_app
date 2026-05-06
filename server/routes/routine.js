const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { SleepRoutine, RoutineStep } = require('../models');
const { trackActivity } = require('../utils/tracking');

// @route   GET /api/routines
// @desc    Lấy tất cả routines của user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const routines = await SleepRoutine.findAll({
            where: { userId: req.user.id },
            include: [{ model: RoutineStep, as: 'steps' }]
        });
        res.json(routines);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Lỗi Server');
    }
});

// @route   POST /api/routines
// @desc    Tạo routine mới
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const { name, scheduledTime, steps } = req.body;

        const routine = await SleepRoutine.create({
            userId: req.user.id,
            name,
            scheduledTime,
            isActive: true
        });

        // Tạo các steps nếu có
        if (steps && steps.length > 0) {
            const stepPromises = steps.map((step, index) => {
                return RoutineStep.create({
                    routineId: routine.id,
                    stepOrder: index + 1,
                    deviceType: step.deviceType,
                    action: step.action,
                    durationMin: step.durationMin
                });
            });
            await Promise.all(stepPromises);
        }

        const newRoutine = await SleepRoutine.findByPk(routine.id, {
            include: [{ model: RoutineStep, as: 'steps' }]
        });

        await trackActivity(req, {
            userId: req.user.id,
            eventType: 'routine_created',
            entityType: 'sleep_routine',
            entityId: routine.id,
            metadata: {
                name,
                scheduledTime,
                stepsCount: Array.isArray(steps) ? steps.length : 0
            }
        });

        res.json(newRoutine);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Lỗi Server');
    }
});

module.exports = router;
