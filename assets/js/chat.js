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
  const userMsg = document.createElement('div');
  userMsg.className = 'message user';
  userMsg.textContent = messageText;
  chatMessages.appendChild(userMsg);
  
  inputField.value = '';
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const res = await apiFetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: currentChatSessionId, message: messageText })
    });

    if (res.ok) {
      const data = await res.json();
      currentChatSessionId = data.sessionId;
      const botMsg = document.createElement('div');
      botMsg.className = 'message bot';
      appendMultilineText(botMsg, data.reply);
      chatMessages.appendChild(botMsg);
    }
  } catch (err) { console.error(err); }
  
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.sendChatMessage = sendChatMessage;

export function handleChatEnter(e) {
  if (e.key === 'Enter') sendChatMessage();
}

window.handleChatEnter = handleChatEnter;
