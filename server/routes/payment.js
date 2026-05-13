const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const crypto = require('crypto');
const { trackActivity, trackPaymentEvent } = require('../utils/tracking');

const allowedPlans = {
    month: 49000,
    year: 588000
};

function getRequiredPaymentConfig() {
    const config = {
        tmnCode: process.env.VNP_TMN_CODE,
        hashSecret: process.env.VNP_HASH_SECRET,
        url: process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
        returnUrl: process.env.VNP_RETURN_URL || `${process.env.APP_PUBLIC_URL || 'http://localhost:3000'}/#profile`
    };

    if (!config.tmnCode || !config.hashSecret) {
        throw new Error('VNPay is not configured');
    }

    return config;
}

router.post('/create-url', auth, async (req, res) => {
    try {
        const { amount, planType } = req.body;
        const expectedAmount = allowedPlans[planType];

        if (!expectedAmount || Number(amount) !== expectedAmount) {
            return res.status(400).json({ message: 'Goi thanh toan khong hop le' });
        }

        const config = getRequiredPaymentConfig();
        const date = new Date();
        const createDate = date.toISOString().replace(/T/, ' ').replace(/\..+/, '').replace(/[:-]/g, '').replace(' ', '');
        const orderId = `AURA_${date.getTime()}`;

        const vnpParams = {
            vnp_Version: '2.1.0',
            vnp_Command: 'pay',
            vnp_TmnCode: config.tmnCode,
            vnp_Locale: 'vn',
            vnp_CurrCode: 'VND',
            vnp_TxnRef: orderId,
            vnp_OrderInfo: `Thanh toan goi Premium ${planType} cho user ${req.user.id}`,
            vnp_OrderType: 'other',
            vnp_Amount: expectedAmount * 100,
            vnp_ReturnUrl: config.returnUrl,
            vnp_IpAddr: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
            vnp_CreateDate: createDate
        };

        const sortedParams = {};
        Object.keys(vnpParams).sort().forEach((key) => {
            sortedParams[key] = vnpParams[key];
        });

        const signData = new URLSearchParams(sortedParams).toString();
        const signed = crypto
            .createHmac('sha512', config.hashSecret)
            .update(Buffer.from(signData, 'utf-8'))
            .digest('hex');

        sortedParams.vnp_SecureHash = signed;
        const paymentUrl = `${config.url}?${new URLSearchParams(sortedParams).toString()}`;

        await trackPaymentEvent(req, {
            userId: req.user.id,
            eventType: 'payment_url_created',
            transactionRef: orderId,
            planType,
            amount: expectedAmount,
            status: 'pending',
            payload: {
                provider: 'vnpay',
                mode: 'sandbox',
                returnUrl: config.returnUrl
            }
        });
        await trackActivity(req, {
            userId: req.user.id,
            eventType: 'payment_started',
            entityType: 'payment',
            entityId: orderId,
            metadata: { provider: 'vnpay', planType, amount: expectedAmount }
        });

        res.json({ paymentUrl, orderId, mode: 'sandbox' });
    } catch (err) {
        console.error('VNPay error:', err.message);
        res.status(500).json({ message: 'Loi tao URL thanh toan' });
    }
});

module.exports = router;
