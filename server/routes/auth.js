const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const auth = require('../middleware/auth');

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

        if (!fullName || !email || !password) {
            return res.status(400).json({ message: 'Vui long nhap day du ho ten, email va mat khau' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Mat khau phai co it nhat 6 ky tu' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await User.findOne({ where: { email: normalizedEmail } });
        if (existingUser) {
            return res.status(400).json({ message: 'Email da duoc su dung' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const user = await User.create({
            fullName: fullName.trim(),
            email: normalizedEmail,
            passwordHash,
            phone
        });

        res.json({ token: signToken(user.id), user: publicUser(user) });
    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Vui long nhap email va mat khau' });
        }

        const user = await User.findOne({ where: { email: email.trim().toLowerCase() } });
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
