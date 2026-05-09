const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { SleepRecord } = require('../models');
const { Op } = require('sequelize');
const { trackActivity } = require('../utils/tracking');

// @route   GET /api/sleep
// @desc    Get sleep records by range, optionally anchored to a selected date
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const range = req.query.range || 'week'; // 'today', 'week', 'month'
        const selectedDate = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
            ? req.query.date
            : null;

        let startDate = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
        let endDate = null;

        if (range === 'today') {
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
        } else if (range === 'week') {
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            endDate = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
            endDate.setHours(0, 0, 0, 0);
            endDate.setDate(endDate.getDate() + 1);
        } else if (range === 'month') {
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 1);
        }

        const dateFilter = endDate
            ? { [Op.gte]: startDate, [Op.lt]: endDate }
            : { [Op.gte]: startDate };

        const records = await SleepRecord.findAll({
            where: {
                userId: req.user.id,
                date: dateFilter
            },
            order: [['date', 'ASC']]
        });

        res.json(records);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Loi Server');
    }
});

// @route   POST /api/sleep
// @desc    Add or update a sleep record
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const { date, bedtime, wakeTime, totalSleepMin, sleepScore, efficiency, fallAsleepMin, notes } = req.body;

        if (!date || !bedtime || !wakeTime || !Number.isInteger(totalSleepMin)) {
            return res.status(400).json({ message: 'Du lieu giac ngu khong hop le' });
        }

        if (totalSleepMin < 60 || totalSleepMin > 900) {
            return res.status(400).json({ message: 'Thoi luong ngu can nam trong khoang 1 den 15 tieng' });
        }

        const payload = {
            bedtime,
            wakeTime,
            totalSleepMin,
            sleepScore: Number.isInteger(sleepScore) ? sleepScore : 0,
            efficiency: Number.isInteger(efficiency) ? efficiency : 0,
            fallAsleepMin: Number.isInteger(fallAsleepMin) ? fallAsleepMin : 0,
            notes: typeof notes === 'string' ? notes.trim() : null
        };

        const [record, created] = await SleepRecord.findOrCreate({
            where: { userId: req.user.id, date },
            defaults: {
                userId: req.user.id,
                date,
                ...payload
            }
        });

        if (!created) {
            await record.update(payload);
        }

        await trackActivity(req, {
            userId: req.user.id,
            eventType: created ? 'sleep_record_created' : 'sleep_record_updated',
            entityType: 'sleep_record',
            entityId: record.id,
            metadata: { date, totalSleepMin, sleepScore, efficiency, fallAsleepMin }
        });

        res.json(record);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

module.exports = router;
