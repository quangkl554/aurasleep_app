import { apiFetch } from './api.js';

let currentChatSessionId = null;

export function appendMultilineText(element, text) {
  const lines = String(text || '').split('\n');
  lines.forEach((line, index) => {
    if (index > 0) element.appendChild(document.createElement('br'));
    element.appendChild(document.createTextNode(line));
  });
}

function buildClientChatFallback(messageText) {
  const normalized = String(messageText || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.includes('goi y am thanh') || normalized.includes('am thanh') || normalized.includes('nhac')) {
    return [
      'AuraBot đang dùng chế độ dự phòng vì AI cloud chưa phản hồi ổn định.',
      '',
      'Gợi ý âm thanh cho tối nay:',
      '- Mưa rào: che tiếng ồn tốt, dễ thư giãn.',
      '- Sóng biển: nhịp đều, phù hợp trước khi ngủ.',
      '- Brown Noise hoặc Pink Noise: âm nền ổn định.',
      '- Thiền sâu hoặc Piano: phù hợp khi muốn thả lỏng nhẹ nhàng.'
    ].join('\n');
  }

  if (normalized.includes('kho ngu') || normalized.includes('mat ngu')) {
    return [
      'AuraBot đang dùng chế độ dự phòng vì AI cloud chưa phản hồi ổn định.',
      '',
      'Bạn có thể thử routine 20-30 phút:',
      '- Giảm ánh sáng mạnh và tắt bớt thông báo.',
      '- Chọn âm thanh nhẹ như Mưa rào hoặc Thiền sâu.',
      '- Hít vào 4 giây, giữ 2 giây, thở ra 6 giây.',
      '- Nếu vẫn tỉnh sau 20 phút, rời giường một lúc rồi quay lại khi buồn ngủ.'
    ].join('\n');
  }

  return [
    'AuraBot đang dùng chế độ dự phòng vì AI cloud chưa phản hồi ổn định.',
    '',
    'Bạn vẫn có thể ghi nhận giấc ngủ, xem dashboard, chọn âm thanh và bật routine thư giãn. Mình sẽ hỗ trợ bằng các gợi ý cơ bản trong lúc AI cloud được khôi phục.'
  ].join('\n');
}

export async function sendChatMessage() {
  const inputField = document.getElementById('chat-input-field');
  const messageText = inputField.value.trim();
  if (!messageText) return;

  const chatMessages = document.getElementById('chat-messages');
  
  // Hiển thị tin nhắn của User
  const userMsg = document.createElement('div');
  userMsg.className = 'message user';
  userMsg.textContent = messageText;
  chatMessages.appendChild(userMsg);
  
  inputField.value = '';
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Hiển thị trạng thái đang chờ của Bot
  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'message bot loading';
  loadingMsg.textContent = 'AuraBot đang suy nghĩ...';
  chatMessages.appendChild(loadingMsg);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const res = await apiFetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: currentChatSessionId, message: messageText })
    });

    // Xóa dòng loading
    if (loadingMsg.parentNode) {
      chatMessages.removeChild(loadingMsg);
    }

    if (res.ok) {
      const data = await res.json();
      currentChatSessionId = data.sessionId;
      const botMsg = document.createElement('div');
      botMsg.className = 'message bot';
      appendMultilineText(botMsg, data.reply);
      chatMessages.appendChild(botMsg);
    } else {
      const errorMsg = document.createElement('div');
      errorMsg.className = 'message bot';
      appendMultilineText(errorMsg, buildClientChatFallback(messageText));
      chatMessages.appendChild(errorMsg);
    }
  } catch (err) { 
    console.error('Lỗi Chat:', err);
    if (loadingMsg.parentNode) chatMessages.removeChild(loadingMsg);
    const errorMsg = document.createElement('div');
    errorMsg.className = 'message bot';
    appendMultilineText(errorMsg, buildClientChatFallback(messageText));
    chatMessages.appendChild(errorMsg);
  }
  
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.sendChatMessage = sendChatMessage;

export function handleChatEnter(e) {
  if (e.key === 'Enter') sendChatMessage();
}

window.handleChatEnter = handleChatEnter;
