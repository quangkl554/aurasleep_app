const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const auth = require('../middleware/auth');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const vietnamPhonePattern = /^(0|\+84)(\d{9}|\d{10})$/;

function signToken(userId) {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is missing');
    }

    return jwt.sign(
        { user: { id: userId } },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );
}

function publicUser(user) {
    return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        theme: user.theme,
        notifications: user.notifications
    };
}

router.post('/register', async (req, res) => {
    try {
        const { fullName, email, password, phone } = req.body;
        const normalizedName = typeof fullName === 'string' ? fullName.trim() : '';
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const normalizedPhone = typeof phone === 'string' ? phone.trim() : null;

        if (!normalizedName || !normalizedEmail || !password) {
            return res.status(400).json({ message: 'Vui long nhap day du ho ten, email va mat khau' });
        }

        if (normalizedName.length > 50) {
            return res.status(400).json({ message: 'Ho ten khong duoc vuot qua 50 ky tu' });
        }

        if (!emailPattern.test(normalizedEmail) || normalizedEmail.length > 255) {
            return res.status(400).json({ message: 'Email khong hop le' });
        }

        if (typeof password !== 'string' || password.length < 6 || password.length > 30) {
            return res.status(400).json({ message: 'Mat khau phai tu 6 den 30 ky tu' });
        }

        if (normalizedPhone && !vietnamPhonePattern.test(normalizedPhone)) {
            return res.status(400).json({ message: 'So dien thoai phai dung dinh dang Viet Nam 10-11 so' });
        }

        const existingUser = await User.findOne({ where: { email: normalizedEmail } });
        if (existingUser) {
            return res.status(400).json({ message: 'Email da duoc su dung' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const user = await User.create({
            fullName: normalizedName,
            email: normalizedEmail,
            passwordHash,
            phone: normalizedPhone
        });

        res.json({ token: signToken(user.id), user: publicUser(user) });
    } catch (err) {
        console.error('Register error:', err.message);
        if (err.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ message: 'Email da duoc su dung' });
        }
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

        if (!normalizedEmail || !password) {
            return res.status(400).json({ message: 'Vui long nhap email va mat khau' });
        }

        const user = await User.findOne({ where: { email: normalizedEmail } });
        if (!user) {
            return res.status(400).json({ message: 'Thong tin dang nhap khong hop le' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Thong tin dang nhap khong hop le' });
        }

        res.json({ token: signToken(user.id), user: publicUser(user) });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['passwordHash'] }
        });

        if (!user) {
            return res.status(404).json({ message: 'Khong tim thay user' });
        }

        res.json(user);
    } catch (err) {
        console.error('Me error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

module.exports = router;
