const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { ChatSession, ChatMessage } = require('../models');
const { trackActivity } = require('../utils/tracking');

const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

function buildFallbackReply(message) {
    const text = String(message || '').toLowerCase();

    if (text.includes('khó ngủ') || text.includes('kho ngu') || text.includes('mất ngủ') || text.includes('mat ngu')) {
        return [
            'Mình đang dùng chế độ AuraBot dự phòng vì AI cloud chưa phản hồi ổn định.',
            '',
            'Tối nay bạn có thể thử routine 20-30 phút:',
            '- Giảm ánh sáng màn hình và đèn phòng.',
            '- Chọn âm thanh nhẹ như Mưa rào, Sóng biển hoặc Thiền sâu.',
            '- Hít vào 4 giây, giữ 2 giây, thở ra 6 giây trong 5 phút.',
            '- Nếu sau 20 phút vẫn tỉnh táo, rời giường một lúc và quay lại khi buồn ngủ.'
        ].join('\n');
    }

    if (text.includes('âm thanh') || text.includes('am thanh') || text.includes('nhạc') || text.includes('nhac')) {
        return [
            'Mình đang dùng chế độ AuraBot dự phòng vì AI cloud chưa phản hồi ổn định.',
            '',
            'Gợi ý âm thanh:',
            '- Mưa rào: phù hợp khi cần che tiếng ồn bên ngoài.',
            '- Sóng biển: nhịp đều, dễ thư giãn.',
            '- Brown Noise hoặc Pink Noise: phù hợp khi cần âm nền ổn định.',
            '- Thiền sâu hoặc Piano: phù hợp trước khi ngủ 15-30 phút.'
        ].join('\n');
    }

    return [
        'Mình đang dùng chế độ AuraBot dự phòng vì AI cloud chưa phản hồi ổn định.',
        '',
        'Bạn có thể bắt đầu bằng 3 việc đơn giản:',
        '- Ghi nhận giấc ngủ tối qua để dashboard có dữ liệu thật.',
        '- Chọn một routine thư giãn 30-45 phút.',
        '- Giữ giờ ngủ/thức dậy ổn định trong vài ngày để AuraSleep phân tích chính xác hơn.'
    ].join('\n');
}

router.post('/send', auth, async (req, res) => {
    try {
        const { sessionId, message } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ message: 'Tin nhan khong hop le' });
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
                        temperature: 0.7,
                        max_tokens: 500
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
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
                model: aiMode === 'groq' ? GROQ_MODEL : aiMode,
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
