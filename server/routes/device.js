const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Device } = require('../models');

// @route   GET /api/devices
// @desc    Lấy danh sách thiết bị và trạng thái cài đặt của user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        let devices = await Device.findAll({
            where: { userId: req.user.id }
        });

        // Nếu user chưa có thiết bị nào, tạo một thiết bị ảo mặc định
        if (devices.length === 0) {
            const newDevice = await Device.create({
                userId: req.user.id,
                deviceName: 'AuraSleep Pro - ' + req.user.id,
                serialNumber: 'AS-PRO-' + Math.floor(Math.random() * 1000000),
                isConnected: true,
                lightIntensity: 60,
                colorTemp: 3200,
                activeSound: 'rain',
                soundVolume: 50
            });
            devices = [newDevice];
        }

        res.json(devices);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Lỗi Server');
    }
});

// @route   PUT /api/devices/:id/settings
// @desc    Cập nhật cài đặt thiết bị (ánh sáng, âm thanh)
// @access  Private
router.put('/:id/settings', auth, async (req, res) => {
    try {
        const { lightIntensity, colorTemp, activeSound, soundVolume } = req.body;

        const device = await Device.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!device) {
            return res.status(404).json({ message: 'Không tìm thấy thiết bị' });
        }

        // Cập nhật các trường được gửi lên
        if (lightIntensity !== undefined) device.lightIntensity = lightIntensity;
        if (colorTemp !== undefined) device.colorTemp = colorTemp;
        if (activeSound !== undefined) device.activeSound = activeSound;
        if (soundVolume !== undefined) device.soundVolume = soundVolume;
        
        device.lastSyncAt = new Date();
        await device.save();

        res.json(device);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Lỗi Server');
    }
});

// @route   POST /api/devices/:id/sleep-mode
// @desc    Bật chế độ ngủ (Sleep Mode) - tắt dần ánh sáng
// @access  Private
router.post('/:id/sleep-mode', auth, async (req, res) => {
    try {
        const device = await Device.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!device) {
            return res.status(404).json({ message: 'Không tìm thấy thiết bị' });
        }

        // Trong thực tế, API này sẽ gửi tín hiệu MQTT/WebSocket tới phần cứng
        // Ở đây ta chỉ mô phỏng việc server nhận được lệnh
        res.json({ 
            message: 'Đã kích hoạt Chế độ ngủ. Thiết bị sẽ giảm sáng trong 30 phút.',
            deviceConfig: {
                targetIntensity: 0,
                duration: 30 * 60, // 30 phút
                timestamp: new Date()
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Lỗi Server');
    }
});

module.exports = router;
