import { apiFetch } from './api.js';

let currentChatSessionId = null;

export function appendMultilineText(element, text) {
  const lines = String(text || '').split('\n');
  lines.forEach((line, index) => {
    if (index > 0) element.appendChild(document.createElement('br'));
    element.appendChild(document.createTextNode(line));
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function scrollChatToBottom(container) {
  if (container) container.scrollTop = container.scrollHeight;
}

async function typeMultilineText(element, text, scrollContainer) {
  const content = String(text || '');
  const shouldReduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (shouldReduceMotion || content.length > 900) {
    appendMultilineText(element, content);
    scrollChatToBottom(scrollContainer);
    return;
  }

  element.classList.add('typing');
  let textNode = null;
  const chars = Array.from(content);
  const batchSize = chars.length > 360 ? 3 : chars.length > 180 ? 2 : 1;

  for (let index = 0; index < chars.length; index += batchSize) {
    const batch = chars.slice(index, index + batchSize);
    batch.forEach((char) => {
      if (char === '\n') {
        element.appendChild(document.createElement('br'));
        textNode = null;
        return;
      }

      if (!textNode) {
        textNode = document.createTextNode('');
        element.appendChild(textNode);
      }
      textNode.textContent += char;
    });
    scrollChatToBottom(scrollContainer);
    await wait(12);
  }

  element.classList.remove('typing');
}

function buildClientChatFallback(messageText) {
  const normalized = String(messageText || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.includes('goi y am thanh') || normalized.includes('am thanh') || normalized.includes('nhac')) {
    return [
      'Gợi ý nhanh:',
      '- Mưa rào: che tiếng ồn tốt.',
      '- Sóng biển: nhịp đều, dễ thư giãn.',
      '- Brown Noise: âm nền ổn định.'
    ].join('\n');
  }

  if (normalized.includes('kho ngu') || normalized.includes('mat ngu')) {
    return [
      'Thử routine 20 phút:',
      '- Giảm đèn và tắt thông báo.',
      '- Bật Mưa rào hoặc Thiền sâu.',
      '- Thở 4-2-6 trong 5 phút.'
    ].join('\n');
  }

  return [
    'Mình có thể giúp bạn:',
    '- Phân tích giấc ngủ.',
    '- Gợi ý routine thư giãn.',
    '- Chọn âm thanh/ánh sáng phù hợp.'
  ].join('\n');
}

export async function sendChatMessage() {
  const inputField = document.getElementById('chat-input-field');
  const sendButton = document.querySelector('.chat-send');
  const messageText = inputField.value.trim();
  if (!messageText) return;

  const chatMessages = document.getElementById('chat-messages');
  
  // Hiển thị tin nhắn của User
  const userMsg = document.createElement('div');
  userMsg.className = 'message user';
  userMsg.textContent = messageText;
  chatMessages.appendChild(userMsg);
  
  inputField.value = '';
  inputField.disabled = true;
  if (sendButton) sendButton.disabled = true;
  scrollChatToBottom(chatMessages);

  // Hiển thị trạng thái đang chờ của Bot
  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'message bot loading';
  loadingMsg.textContent = 'AuraBot đang suy nghĩ...';
  chatMessages.appendChild(loadingMsg);
  scrollChatToBottom(chatMessages);

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
      const serverReply = data.reply || 'AuraBot chưa có phản hồi.';
      chatMessages.appendChild(botMsg);
      await typeMultilineText(botMsg, serverReply, chatMessages);
    } else {
      const errorText = await res.text().catch(() => '');
      console.warn('Chat API error:', res.status, errorText);
      const errorMsg = document.createElement('div');
      errorMsg.className = 'message bot';
      chatMessages.appendChild(errorMsg);
      await typeMultilineText(errorMsg, buildClientChatFallback(messageText), chatMessages);
    }
  } catch (err) { 
    console.error('Lỗi Chat:', err);
    if (loadingMsg.parentNode) chatMessages.removeChild(loadingMsg);
    const errorMsg = document.createElement('div');
    errorMsg.className = 'message bot';
    chatMessages.appendChild(errorMsg);
    await typeMultilineText(errorMsg, buildClientChatFallback(messageText), chatMessages);
  } finally {
    inputField.disabled = false;
    if (sendButton) sendButton.disabled = false;
    inputField.focus();
  }
  
  scrollChatToBottom(chatMessages);
}

window.sendChatMessage = sendChatMessage;

export function handleChatEnter(e) {
  if (e.key === 'Enter') sendChatMessage();
}

window.handleChatEnter = handleChatEnter;
