const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Device } = require('../models');
const { trackActivity, trackDeviceCommand } = require('../utils/tracking');

router.get('/', auth, async (req, res) => {
    try {
        let devices = await Device.findAll({
            where: { userId: req.user.id }
        });

        if (devices.length === 0) {
            const newDevice = await Device.create({
                userId: req.user.id,
                deviceName: `AuraSleep Pro - ${req.user.id}`,
                serialNumber: `AS-PRO-${Math.floor(Math.random() * 1000000)}`,
                isConnected: true,
                lightIntensity: 60,
                colorTemp: 3200,
                activeSound: 'rain',
                soundVolume: 50
            });
            devices = [newDevice];

            await trackActivity(req, {
                userId: req.user.id,
                eventType: 'device_created',
                entityType: 'device',
                entityId: newDevice.id,
                metadata: { source: 'default_demo_device' }
            });
        }

        res.json(devices);
    } catch (err) {
        console.error('Device list error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.put('/:id/settings', auth, async (req, res) => {
    try {
        const { lightIntensity, colorTemp, activeSound, soundVolume } = req.body;

        const device = await Device.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!device) {
            return res.status(404).json({ message: 'Khong tim thay thiet bi' });
        }

        if (lightIntensity !== undefined) device.lightIntensity = lightIntensity;
        if (colorTemp !== undefined) device.colorTemp = colorTemp;
        if (activeSound !== undefined) device.activeSound = activeSound;
        if (soundVolume !== undefined) device.soundVolume = soundVolume;

        device.lastSyncAt = new Date();
        await device.save();

        const payload = { lightIntensity, colorTemp, activeSound, soundVolume };
        await trackDeviceCommand(req, {
            userId: req.user.id,
            deviceId: device.id,
            command: 'update_settings',
            payload
        });
        await trackActivity(req, {
            userId: req.user.id,
            eventType: 'device_settings_updated',
            entityType: 'device',
            entityId: device.id,
            metadata: payload
        });

        res.json(device);
    } catch (err) {
        console.error('Device settings error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.post('/:id/sleep-mode', auth, async (req, res) => {
    try {
        const device = await Device.findOne({
            where: { id: req.params.id, userId: req.user.id }
        });

        if (!device) {
            return res.status(404).json({ message: 'Khong tim thay thiet bi' });
        }

        const deviceConfig = {
            targetIntensity: 0,
            duration: 30 * 60,
            timestamp: new Date()
        };

        await trackDeviceCommand(req, {
            userId: req.user.id,
            deviceId: device.id,
            command: 'sleep_mode',
            payload: deviceConfig
        });
        await trackActivity(req, {
            userId: req.user.id,
            eventType: 'sleep_mode_started',
            entityType: 'device',
            entityId: device.id,
            metadata: deviceConfig
        });

        res.json({
            message: 'Da kich hoat che do ngu. Thiet bi se giam sang trong 30 phut.',
            deviceConfig
        });
    } catch (err) {
        console.error('Sleep mode error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

module.exports = router;
