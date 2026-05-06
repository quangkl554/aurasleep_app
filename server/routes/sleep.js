const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { SleepRecord } = require('../models');
const { Op } = require('sequelize');
const { trackActivity } = require('../utils/tracking');

// @route   GET /api/sleep
// @desc    Lấy dữ liệu giấc ngủ theo khoảng thời gian
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const range = req.query.range || 'week'; // 'today', 'week', 'month'
        
        let startDate = new Date();
        if (range === 'today') {
            startDate.setHours(0, 0, 0, 0); // Đầu ngày hôm nay
        } else if (range === 'week') {
            startDate.setDate(startDate.getDate() - 7); // 7 ngày trước
        } else if (range === 'month') {
            startDate.setMonth(startDate.getMonth() - 1); // 1 tháng trước
        }

        const records = await SleepRecord.findAll({
            where: {
                userId: req.user.id,
                date: {
                    [Op.gte]: startDate
                }
            },
            order: [['date', 'ASC']]
        });

        res.json(records);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Lỗi Server');
    }
});

// @route   POST /api/sleep
// @desc    Thêm bản ghi giấc ngủ mới
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
