const { sequelize, User, SleepRecord } = require('../models');
require('dotenv').config({ path: '../.env' });

const seedSleepData = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to database for sleep seeding...');

        const demoUser = await User.findOne({ where: { email: 'demo@aurasleep.vn' } });
        if (!demoUser) {
            console.log('Demo user not found. Run seedData.js first.');
            process.exit(1);
        }

        // Tạo dữ liệu cho 7 ngày qua
        const records = [];
        for (let i = 6; i >= 0; i--) {
            let d = new Date();
            d.setDate(d.getDate() - i);
            let dateStr = d.toISOString().split('T')[0];
            
            // Random sleep from 5.5h to 8.5h (330 to 510 mins)
            let totalSleep = Math.floor(Math.random() * (510 - 330 + 1)) + 330; 
            
            let bedtime = new Date(d);
            bedtime.setHours(22, Math.floor(Math.random() * 60), 0, 0); // Ngủ lúc 22h-23h
            
            let wakeTime = new Date(bedtime.getTime() + totalSleep * 60000);

            records.push({
                userId: demoUser.id,
                date: dateStr,
                bedtime: bedtime,
                wakeTime: wakeTime,
                totalSleepMin: totalSleep,
                sleepScore: Math.floor(Math.random() * 20) + 75, // 75-95
                efficiency: Math.floor(Math.random() * 15) + 80, // 80-95
                fallAsleepMin: Math.floor(Math.random() * 20) + 5, // 5-25
            });
        }

        for (let record of records) {
            await SleepRecord.findOrCreate({
                where: { userId: record.userId, date: record.date },
                defaults: record
            });
        }

        console.log('Sleep records seeded for the last 7 days.');
        process.exit(0);

    } catch (err) {
        console.error('Seeding sleep failed:', err);
        process.exit(1);
    }
};

seedSleepData();
