const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { SleepRecord, SleepProfile } = require('../models');
const { Op } = require('sequelize');
const { trackActivity } = require('../utils/tracking');
const { createNotification } = require('../utils/notifications');

const allowedFactors = new Set([
    'stress',
    'caffeine',
    'exercise',
    'screen',
    'nap',
    'alcohol',
    'lateMeal',
    'meditation'
]);

function getSelectedDate(req) {
    return typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : null;
}

function getRangeWindow(range, selectedDate = null) {
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

    return { startDate, endDate };
}

function clampMetric(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}

function getInBedMinutes(record) {
    const bedDate = new Date(record.bedtime);
    let wakeDate = new Date(record.wakeTime);
    if (Number.isNaN(bedDate.getTime()) || Number.isNaN(wakeDate.getTime())) return null;
    if (wakeDate <= bedDate) {
        wakeDate = new Date(wakeDate);
        wakeDate.setDate(wakeDate.getDate() + 1);
    }
    return Math.max(0, Math.round((wakeDate - bedDate) / 60000));
}

function calculateSleepEfficiency(totalSleepMin, inBedMin) {
    return inBedMin > 0
        ? Math.round(clampMetric((totalSleepMin / inBedMin) * 100))
        : 0;
}

function calculateSleepScore({ totalSleepMin, efficiency, fallAsleepMin, targetSleepMin = 480 }) {
    const safeTarget = Math.max(1, Number(targetSleepMin) || 480);
    const durationRatio = clampMetric((Number(totalSleepMin) || 0) / safeTarget, 0, 1.25);
    const durationScore = durationRatio <= 1
        ? Math.pow(durationRatio, 1.35) * 100
        : Math.max(72, 100 - (durationRatio - 1) * 70);
    const latencyScore = clampMetric(100 - Math.max(0, (Number(fallAsleepMin) || 0) - 15) * 2.2);
    let score = durationScore * 0.7 + (Number(efficiency) || 0) * 0.2 + latencyScore * 0.1;

    if (durationRatio < 0.7) score = Math.min(score, 72);
    if (durationRatio < 0.55) score = Math.min(score, 60);

    return Math.round(clampMetric(score));
}

function normalizeSleepRecord(record, targetSleepMin = 480) {
    const plain = typeof record.get === 'function' ? record.get({ plain: true }) : { ...record };
    const fallAsleepMin = Math.max(0, Number(plain.fallAsleepMin) || 0);
    const inBedMin = getInBedMinutes(plain);
    const totalSleepMin = Number.isFinite(Number(plain.totalSleepMin))
        ? Math.max(0, Number(plain.totalSleepMin))
        : Math.max(0, (inBedMin || 0) - fallAsleepMin);
    const efficiency = calculateSleepEfficiency(totalSleepMin, inBedMin || totalSleepMin + fallAsleepMin);
    const sleepScore = calculateSleepScore({ totalSleepMin, efficiency, fallAsleepMin, targetSleepMin });

    return {
        ...plain,
        totalSleepMin,
        efficiency,
        sleepScore,
        fallAsleepMin
    };
}

function average(records, field) {
    const values = records
        .map((record) => Number(record[field]))
        .filter((value) => Number.isFinite(value));
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function minutesBetweenBedtimes(records) {
    return records
        .map((record) => {
            const date = new Date(record.bedtime);
            if (Number.isNaN(date.getTime())) return null;
            const minutes = date.getHours() * 60 + date.getMinutes();
            return minutes < 720 ? minutes + 1440 : minutes;
        })
        .filter((value) => Number.isFinite(value));
}

function standardDeviation(values) {
    if (values.length <= 1) return 0;
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
}

function buildFactorInsights(records) {
    const baseline = average(records, 'sleepScore');
    const factorStats = new Map();

    records.forEach((record) => {
        const factors = Array.isArray(record.factors) ? record.factors : [];
        factors.forEach((factor) => {
            if (!factorStats.has(factor)) factorStats.set(factor, []);
            factorStats.get(factor).push(Number(record.sleepScore) || 0);
        });
    });

    return Array.from(factorStats.entries())
        .map(([factor, scores]) => ({
            factor,
            count: scores.length,
            avgScore: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
            impact: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length - baseline)
        }))
        .sort((a, b) => a.impact - b.impact);
}

function buildRecommendations({ sleepDebt, consistencyScore, avgLatency, avgScore, factorInsights }) {
    const recommendations = [];
    const worstFactor = factorInsights[0];

    if (sleepDebt > 0) recommendations.push('Thiếu ngủ đang tích lũy. Hãy kéo giờ ngủ sớm hơn 15-20 phút trong vài đêm tới.');
    if (consistencyScore < 70) recommendations.push('Giờ đi ngủ còn lệch nhiều. Nên cố định khung ngủ/thức trong khoảng 30 phút.');
    if (avgLatency > 25) recommendations.push('Thời gian chìm giấc hơi dài. Bắt đầu routine thư giãn và giảm ánh sáng sớm hơn.');
    if (worstFactor && worstFactor.impact <= -5) recommendations.push(`Yếu tố "${worstFactor.factor}" đang đi kèm điểm ngủ thấp hơn trung bình ${Math.abs(worstFactor.impact)} điểm.`);
    if (avgScore >= 85 && recommendations.length === 0) recommendations.push('Chất lượng ngủ đang ổn định. Tiếp tục duy trì lịch ngủ và routine hiện tại.');

    return recommendations.slice(0, 4);
}

async function getProfile(userId) {
    const [profile] = await SleepProfile.findOrCreate({
        where: { userId },
        defaults: { userId }
    });
    return profile;
}

// @route   GET /api/sleep
// @desc    Get sleep records by range, optionally anchored to a selected date
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const range = req.query.range || 'week'; // 'today', 'week', 'month'
        const selectedDate = getSelectedDate(req);
        const { startDate, endDate } = getRangeWindow(range, selectedDate);

        const dateFilter = endDate
            ? { [Op.gte]: startDate, [Op.lt]: endDate }
            : { [Op.gte]: startDate };

        const [records, profile] = await Promise.all([
            SleepRecord.findAll({
                where: {
                    userId: req.user.id,
                    date: dateFilter
                },
                order: [['date', 'ASC']]
            }),
            getProfile(req.user.id)
        ]);
        const targetSleepMin = Number(profile.targetSleepMin) || 480;

        res.json(records.map((record) => normalizeSleepRecord(record, targetSleepMin)));
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Loi Server');
    }
});

router.get('/report', auth, async (req, res) => {
    try {
        const range = req.query.range === 'month' ? 'month' : 'week';
        const selectedDate = getSelectedDate(req);
        const { startDate, endDate } = getRangeWindow(range, selectedDate);
        const dateFilter = endDate
            ? { [Op.gte]: startDate, [Op.lt]: endDate }
            : { [Op.gte]: startDate };

        const [records, profile] = await Promise.all([
            SleepRecord.findAll({
                where: {
                    userId: req.user.id,
                    date: dateFilter
                },
                order: [['date', 'ASC']]
            }),
            getProfile(req.user.id)
        ]);

        const targetSleepMin = Number(profile.targetSleepMin) || 480;
        const normalizedRecords = records.map((record) => normalizeSleepRecord(record, targetSleepMin));
        const avgSleep = Math.round(average(normalizedRecords, 'totalSleepMin'));
        const avgScore = Math.round(average(normalizedRecords, 'sleepScore'));
        const avgLatency = Math.round(average(normalizedRecords, 'fallAsleepMin'));
        const avgEfficiency = Math.round(average(normalizedRecords, 'efficiency'));
        const totalSleep = normalizedRecords.reduce((sum, record) => sum + (Number(record.totalSleepMin) || 0), 0);
        const sleepDebt = Math.max(0, targetSleepMin * normalizedRecords.length - totalSleep);
        const daysAtGoal = normalizedRecords.filter((record) => (Number(record.totalSleepMin) || 0) >= targetSleepMin).length;
        const bedtimeStd = Math.round(standardDeviation(minutesBetweenBedtimes(records)));
        const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - (bedtimeStd / 90) * 100)));
        const bestNight = normalizedRecords.reduce((best, record) => !best || (record.sleepScore || 0) > (best.sleepScore || 0) ? record : best, null);
        const worstNight = normalizedRecords.reduce((worst, record) => !worst || (record.sleepScore || 0) < (worst.sleepScore || 0) ? record : worst, null);
        const factorInsights = buildFactorInsights(normalizedRecords);

        res.json({
            range,
            selectedDate,
            targetSleepMin,
            recordCount: normalizedRecords.length,
            avgSleep,
            avgScore,
            avgLatency,
            avgEfficiency,
            sleepDebt,
            goalRate: normalizedRecords.length ? Math.round((daysAtGoal / normalizedRecords.length) * 100) : 0,
            consistencyScore,
            bedtimeStd,
            bestNight,
            worstNight,
            factorInsights,
            recommendations: buildRecommendations({ sleepDebt, consistencyScore, avgLatency, avgScore, factorInsights })
        });
    } catch (err) {
        console.error('Sleep report error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

// @route   POST /api/sleep
// @desc    Add or update a sleep record
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const { date, bedtime, wakeTime, fallAsleepMin, notes } = req.body;
        const factors = Array.isArray(req.body.factors)
            ? req.body.factors.filter((factor) => typeof factor === 'string' && allowedFactors.has(factor)).slice(0, 8)
            : [];

        if (!date || !bedtime || !wakeTime) {
            return res.status(400).json({ message: 'Du lieu giac ngu khong hop le' });
        }

        const profile = await getProfile(req.user.id);
        const targetSleepMin = Number(profile.targetSleepMin) || 480;
        const calculated = normalizeSleepRecord({ bedtime, wakeTime, fallAsleepMin }, targetSleepMin);

        if (calculated.totalSleepMin < 60 || calculated.totalSleepMin > 900) {
            return res.status(400).json({ message: 'Thoi luong ngu can nam trong khoang 1 den 15 tieng' });
        }

        const payload = {
            bedtime,
            wakeTime,
            totalSleepMin: calculated.totalSleepMin,
            sleepScore: calculated.sleepScore,
            efficiency: calculated.efficiency,
            fallAsleepMin: calculated.fallAsleepMin,
            factors,
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
            metadata: {
                date,
                totalSleepMin: calculated.totalSleepMin,
                sleepScore: calculated.sleepScore,
                efficiency: calculated.efficiency,
                fallAsleepMin: calculated.fallAsleepMin,
                factors
            }
        });

        if (created && calculated.totalSleepMin < targetSleepMin - 45) {
            await createNotification({
                userId: req.user.id,
                title: 'Cảnh báo thiếu ngủ',
                message: `Đêm ${date} thấp hơn mục tiêu khoảng ${Math.round((targetSleepMin - calculated.totalSleepMin) / 60 * 10) / 10} giờ. Hãy bắt đầu routine sớm hơn tối nay.`,
                type: 'sleep_alert',
                metadata: { date, totalSleepMin: calculated.totalSleepMin, targetSleepMin }
            });
        }

        res.json(normalizeSleepRecord(record, targetSleepMin));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

module.exports = router;
