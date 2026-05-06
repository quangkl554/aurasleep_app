const jwt = require('jsonwebtoken');
require('dotenv').config();

const auth = (req, res, next) => {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Khong co token, tu choi truy cap' });
    }

    if (!process.env.JWT_SECRET) {
        console.error('CRITICAL: JWT_SECRET is missing from process.env');
        return res.status(500).json({ message: 'Loi cau hinh Server' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token khong hop le' });
    }
};

module.exports = auth;
