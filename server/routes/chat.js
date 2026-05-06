const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { ChatSession, ChatMessage } = require('../models');
const { trackActivity } = require('../utils/tracking');

const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

router.post('/send', auth, async (req, res) => {
    try {
        const { sessionId, message } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ message: 'Tin nhan khong hop le' });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(503).json({ message: 'Groq API key chua duoc cau hinh' });
        }

        let currentSessionId = sessionId;

        if (currentSessionId) {
            const existingSession = await ChatSession.findOne({
                where: { id: currentSessionId, userId: req.user.id }
            });

            if (!existingSession) {
                return res.status(404).json({ message: 'Khong tim thay phien chat' });
            }
        } else {
            const newSession = await ChatSession.create({
                userId: req.user.id,
                title: message.trim().substring(0, 30)
            });
            currentSessionId = newSession.id;
        }

        await ChatMessage.create({
            sessionId: currentSessionId,
            role: 'user',
            content: message.trim()
        });

        const recentHistory = await ChatMessage.findAll({
            where: { sessionId: currentSessionId },
            order: [['createdAt', 'DESC']],
            limit: 10
        });

        const formattedHistory = recentHistory.reverse().map((msg) => ({
            role: msg.role === 'bot' ? 'assistant' : 'user',
            content: msg.content
        }));

        const apiMessages = [
            {
                role: 'system',
                content: [
                    'You are AuraBot, a sleep assistant inside AuraSleep.',
                    'Use a calm, professional, empathetic tone.',
                    'Give concise, practical sleep, routine, light, and sound suggestions.',
                    'Answer in Vietnamese when the user writes Vietnamese.',
                    'Do not diagnose disease or replace medical advice.'
                ].join(' ')
            },
            ...formattedHistory
        ];

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: apiMessages,
                temperature: 0.7,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Groq API error:', errorText);
            return res.status(502).json({ message: 'AI service dang ban' });
        }

        const data = await response.json();
        const botReply = data.choices?.[0]?.message?.content || 'AuraBot chua co phan hoi.';

        await ChatMessage.create({
            sessionId: currentSessionId,
            role: 'bot',
            content: botReply
        });

        await trackActivity(req, {
            userId: req.user.id,
            eventType: 'chat_message_sent',
            entityType: 'chat_session',
            entityId: currentSessionId,
            metadata: {
                model: GROQ_MODEL,
                messageLength: message.trim().length,
                replyLength: botReply.length
            }
        });

        res.json({
            sessionId: currentSessionId,
            reply: botReply
        });
    } catch (err) {
        console.error('Chat error:', err.message);
        res.status(500).json({ message: 'Loi khi ket noi voi AI' });
    }
});

router.get('/history/:sessionId', auth, async (req, res) => {
    try {
        const session = await ChatSession.findOne({
            where: { id: req.params.sessionId, userId: req.user.id }
        });

        if (!session) {
            return res.status(404).json({ message: 'Khong tim thay phien chat' });
        }

        const messages = await ChatMessage.findAll({
            where: { sessionId: req.params.sessionId },
            order: [['createdAt', 'ASC']]
        });
        res.json(messages);
    } catch (err) {
        console.error('Chat history error:', err.message);
        res.status(500).json({ message: 'Loi Server' });
    }
});

module.exports = router;
