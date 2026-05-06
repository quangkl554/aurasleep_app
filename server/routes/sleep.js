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
        const { date, bedtime, wakeTime, totalSleepMin, sleepScore, efficiency, fallAsleepMin } = req.body;

        const newRecord = await SleepRecord.create({
            userId: req.user.id,
            date,
            bedtime,
            wakeTime,
            totalSleepMin,
            sleepScore,
            efficiency,
            fallAsleepMin
        });

        await trackActivity(req, {
            userId: req.user.id,
            eventType: 'sleep_record_created',
            entityType: 'sleep_record',
            entityId: newRecord.id,
            metadata: { date, totalSleepMin, sleepScore, efficiency, fallAsleepMin }
        });

        res.json(newRecord);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Lỗi Server');
    }
});

module.exports = router;
