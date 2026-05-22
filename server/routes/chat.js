const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { ChatSession, ChatMessage, SleepRecord, SleepProfile } = require('../models');
const { trackActivity } = require('../utils/tracking');
const { buildAuraBotMessages, sanitizeAuraBotReply } = require('../utils/aurabotContext');
const { Op } = require('sequelize');

const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

function toApiRole(role) {
    return role === 'bot' || role === 'assistant' ? 'assistant' : 'user';
}

async function saveBotMessage(sessionId, content) {
    if (!sessionId) return null;
    let lastError = null;

    for (const role of ['bot', 'assistant']) {
        try {
            return await ChatMessage.create({ sessionId, role, content });
        } catch (err) {
            lastError = err;
            console.warn(`Chat bot message save failed with role=${role}:`, err.message);
        }
    }

    console.warn('AuraBot reply returned without persisted bot message:', lastError?.message);
    return null;
}

async function resolveChatSession(userId, sessionId, message) {
    if (sessionId) {
        try {
            const existingSession = await ChatSession.findOne({
                where: { id: sessionId, userId }
            });

            if (!existingSession) {
                return { status: 'not_found', sessionId: null, history: [] };
            }

            const history = await ChatMessage.findAll({
                where: { sessionId },
                order: [['createdAt', 'DESC']],
                limit: 10
            });

            return { status: 'ok', sessionId, history };
        } catch (err) {
            console.warn('Chat history unavailable, continuing without persistence:', err.message);
            return { status: 'disabled', sessionId: null, history: [] };
        }
    }

    try {
        const newSession = await ChatSession.create({
            userId,
            title: message.trim().substring(0, 30)
        });
        return { status: 'ok', sessionId: newSession.id, history: [] };
    } catch (err) {
        console.warn('Chat session persistence unavailable, continuing without history:', err.message);
        return { status: 'disabled', sessionId: null, history: [] };
    }
}

async function saveUserMessage(sessionId, message) {
    if (!sessionId) return null;
    try {
        return await ChatMessage.create({
            sessionId,
            role: 'user',
            content: message.trim()
        });
    } catch (err) {
        console.warn('Chat user message save skipped:', err.message);
        return null;
    }
}

function buildFallbackReply(message) {
    const text = String(message || '').toLowerCase();

    if (text.includes('khó ngủ') || text.includes('kho ngu') || text.includes('mất ngủ') || text.includes('mat ngu')) {
        return [
            'Thử routine 20 phút tối nay:',
            '- Giảm đèn và tắt thông báo.',
            '- Bật Mưa rào hoặc Thiền sâu.',
            '- Thở 4-2-6 trong 5 phút.'
        ].join('\n');
    }

    if (text.includes('âm thanh') || text.includes('am thanh') || text.includes('nhạc') || text.includes('nhac')) {
        return [
            'Gợi ý nhanh:',
            '- Mưa rào: che tiếng ồn tốt.',
            '- Sóng biển: nhịp đều, dễ thư giãn.',
            '- Brown Noise: hợp khi cần âm nền ổn định.'
        ].join('\n');
    }

    return [
        'Mình có thể hỗ trợ 3 việc chính:',
        '- Phân tích dữ liệu ngủ gần đây.',
        '- Gợi ý routine thư giãn.',
        '- Chọn âm thanh/ánh sáng phù hợp.'
    ].join('\n');
}

function sendFallbackChatResponse(res, message, sessionId = null) {
    return res.json({
        sessionId,
        reply: buildFallbackReply(message)
    });
}

async function buildSleepContext(userId) {
    try {
        const endDate = new Date();
        endDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() + 1);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7);

        const [records, profile] = await Promise.all([
            SleepRecord.findAll({
                where: {
                    userId,
                    date: { [Op.gte]: startDate, [Op.lt]: endDate }
                },
                order: [['date', 'ASC']]
            }),
            SleepProfile.findOne({ where: { userId } })
        ]);

        if (!records.length) return 'No recent sleep records yet.';
        const avg = (field) => Math.round(records.reduce((sum, record) => sum + (Number(record[field]) || 0), 0) / records.length);
        const targetSleepMin = Number(profile?.targetSleepMin) || 480;
        const avgSleep = avg('totalSleepMin');
        const avgScore = avg('sleepScore');
        const avgLatency = avg('fallAsleepMin');
        const goalDays = records.filter((record) => (Number(record.totalSleepMin) || 0) >= targetSleepMin).length;

        return [
            `Recent records: ${records.length} nights.`,
            `Target sleep: ${targetSleepMin} minutes.`,
            `Average sleep: ${avgSleep} minutes.`,
            `Average score: ${avgScore}/100.`,
            `Average sleep latency: ${avgLatency} minutes.`,
            `Goal days: ${goalDays}/${records.length}.`,
            `Latest date: ${records[records.length - 1].date}.`
        ].join(' ');
    } catch (err) {
        console.warn('AuraBot sleep context skipped:', err.message);
        return 'Sleep context unavailable.';
    }
}

router.post('/send', auth, async (req, res) => {
    try {
        const { sessionId, message } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ message: 'Tin nhan khong hop le' });
        }

        const sessionState = await resolveChatSession(req.user.id, sessionId, message);
        if (sessionState.status === 'not_found') {
            return res.status(404).json({ message: 'Khong tim thay phien chat' });
        }

        const currentSessionId = sessionState.sessionId;
        const recentHistory = sessionState.history || [];
        await saveUserMessage(currentSessionId, message);

        const formattedHistory = recentHistory.reverse().map((msg) => ({
            role: toApiRole(msg.role),
            content: msg.content
        }));

        const sleepContext = await buildSleepContext(req.user.id);
        const apiMessages = buildAuraBotMessages({
            history: formattedHistory,
            message,
            sleepContext
        });

        let botReply = '';
        let aiMode = 'groq';

        if (!process.env.GROQ_API_KEY) {
            aiMode = 'fallback_no_key';
            botReply = buildFallbackReply(message);
        } else {
            try {
                const response = await fetch(GROQ_API_URL, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: GROQ_MODEL,
                        messages: apiMessages,
                        temperature: 0.45,
                        max_tokens: 220
                    })
                });

                if (!response.ok) {
                    const errorText = (await response.text()).slice(0, 240);
                    throw new Error(`Groq API error ${response.status}: ${errorText}`);
                }

                const data = await response.json();
                botReply = data.choices?.[0]?.message?.content || 'AuraBot chua co phan hoi.';
            } catch (aiErr) {
                aiMode = 'fallback_ai_error';
                console.error('AuraBot AI fallback:', aiErr.message);
                botReply = buildFallbackReply(message);
            }
        }

        botReply = sanitizeAuraBotReply(botReply, buildFallbackReply(message));
        const persistedBotMessage = await saveBotMessage(currentSessionId, botReply);

        try {
            await trackActivity(req, {
                userId: req.user.id,
                eventType: 'chat_message_sent',
                entityType: 'chat_session',
                entityId: currentSessionId,
                metadata: {
                    model: aiMode === 'groq' ? GROQ_MODEL : aiMode,
                    messageLength: message.trim().length,
                    replyLength: botReply.length,
                    replyPersisted: Boolean(persistedBotMessage),
                    chatPersistence: sessionState.status
                }
            });
        } catch (trackingErr) {
            console.warn('Chat activity tracking skipped:', trackingErr.message);
        }

        res.json({
            sessionId: currentSessionId,
            reply: botReply
        });
    } catch (err) {
        console.error('Chat error:', err.message);
        const message = typeof req.body?.message === 'string' ? req.body.message : '';
        if (message.trim()) {
            return sendFallbackChatResponse(res, message);
        }
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
