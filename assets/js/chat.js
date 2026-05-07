import { apiFetch } from './api.js';

let currentChatSessionId = null;

export function appendMultilineText(element, text) {
  const lines = String(text || '').split('\n');
  lines.forEach((line, index) => {
    if (index > 0) element.appendChild(document.createElement('br'));
    element.appendChild(document.createTextNode(line));
  });
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
      errorMsg.className = 'message bot error';
      errorMsg.textContent = 'Xin lỗi, AuraBot đang bận một chút. Bạn thử lại sau nhé!';
      chatMessages.appendChild(errorMsg);
    }
  } catch (err) { 
    console.error('Lỗi Chat:', err);
    if (loadingMsg.parentNode) chatMessages.removeChild(loadingMsg);
  }
  
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.sendChatMessage = sendChatMessage;

export function handleChatEnter(e) {
  if (e.key === 'Enter') sendChatMessage();
}

window.handleChatEnter = handleChatEnter;
