const bcrypt = require('bcrypt');
const { sequelize, User, BlogCategory, BlogPost } = require('../models');
require('dotenv').config({ path: '../.env' });

const seedData = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to database for seeding...');

        // 1. Create Demo User
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('password123', salt);
        
        await User.findOrCreate({
            where: { email: 'demo@aurasleep.vn' },
            defaults: {
                fullName: 'AURASLEEP Demo',
                email: 'demo@aurasleep.vn',
                passwordHash: passwordHash,
                phone: '0901234567',
                role: 'user'
            }
        });
        console.log('Demo user seeded.');

        // 2. Create Blog Categories
        const categories = [
            { name: 'Sleep Hygiene', slug: 'sleep-hygiene' },
            { name: 'Tinh thần', slug: 'tinh-than' },
            { name: 'Mẹo hay', slug: 'meo-hay' }
        ];

        for (let cat of categories) {
            await BlogCategory.findOrCreate({
                where: { slug: cat.slug },
                defaults: cat
            });
        }
        console.log('Blog categories seeded.');

        // 3. Create Blog Posts
        const sleepHygieneCat = await BlogCategory.findOne({ where: { slug: 'sleep-hygiene' } });
        
        const posts = [
            {
                categoryId: sleepHygieneCat.id,
                title: 'Ánh sáng xanh ảnh hưởng đến nhịp sinh học của bạn như thế nào?',
                slug: 'anh-sang-xanh-va-nhip-sinh-hoc',
                content: '<p>Ánh sáng xanh từ màn hình điện thoại ức chế sự tiết melatonin - hormone gây buồn ngủ. Việc sử dụng thiết bị điện tử trước khi ngủ sẽ đánh lừa não bộ rằng vẫn đang là ban ngày.</p><h4>Giải pháp từ AuraSleep</h4><p>Thiết bị AuraSleep mô phỏng ánh sáng hoàng hôn (nhiệt độ màu 2700K) giúp kích thích sản sinh melatonin tự nhiên.</p>',
                excerpt: 'Khám phá cách màn hình điện thoại ức chế melatonin và giải pháp từ AuraSleep.',
                thumbnailUrl: 'https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                readingTime: 5
            },
            {
                categoryId: sleepHygieneCat.id,
                title: '5 thói quen buổi tối giúp sinh viên y khoa ngủ ngon hơn',
                slug: '5-thoi-quen-buoi-toi',
                content: '<p>Sinh viên y khoa thường xuyên phải trực đêm, làm đảo lộn nhịp sinh học...</p>',
                excerpt: 'Các mẹo hữu ích để duy trì giấc ngủ ổn định dù lịch trình bận rộn.',
                thumbnailUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
                readingTime: 4
            }
        ];

        for (let post of posts) {
            await BlogPost.findOrCreate({
                where: { slug: post.slug },
                defaults: post
            });
        }
        console.log('Blog posts seeded.');

        console.log('Seeding completed successfully!');
        process.exit(0);

    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
};

seedData();
