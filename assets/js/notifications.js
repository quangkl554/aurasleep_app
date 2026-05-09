import { apiFetch, getToken } from './api.js';

const STORAGE_PREFIX = 'aurasleep_notifications_';

function getUserKey(user = null) {
  const explicitId = user?.id || user?.email;
  if (explicitId) return String(explicitId);
  return localStorage.getItem('aurasleep_user_key') || 'guest';
}

function getStorageKey(user = null) {
  return STORAGE_PREFIX + getUserKey(user);
}

function readNotifications(user = null) {
  try {
    return JSON.parse(localStorage.getItem(getStorageKey(user)) || '[]');
  } catch {
    return [];
  }
}

function writeNotifications(notifications, user = null) {
  localStorage.setItem(getStorageKey(user), JSON.stringify(notifications));
}

export function rememberNotificationUser(user) {
  const key = getUserKey(user);
  localStorage.setItem('aurasleep_user_key', key);
}

export function addNotification({ title, message, type = 'system', createdAt = new Date().toISOString() }, user = null) {
  const notifications = readNotifications(user);
  notifications.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    message,
    type,
    createdAt
  });
  writeNotifications(notifications.slice(0, 50), user);
}

export function ensureWelcomeNotification(user) {
  rememberNotificationUser(user);
  if (getToken()) return;

  const notifications = readNotifications(user);
  const hasWelcome = notifications.some(item => item.type === 'welcome');
  if (hasWelcome) return;

  addNotification({
    title: 'Chào mừng đến với AuraSleep',
    message: 'Tài khoản của bạn đã sẵn sàng. Hãy ghi nhận giấc ngủ đầu tiên để dashboard bắt đầu phân tích bằng dữ liệu thật.',
    type: 'welcome'
  }, user);
}

function formatNotificationTime(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function fetchBackendNotifications() {
  if (!getToken()) return null;
  const res = await apiFetch('/api/auth/notifications');
  if (!res.ok) throw new Error('Không thể tải thông báo');
  return res.json();
}

function renderNotifications(list, container) {
  container.innerHTML = '';

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'notification-empty';
    empty.innerHTML = `
      <i class="fa-regular fa-bell"></i>
      <strong>Chưa có thông báo mới</strong>
      <p>Lịch sử nhắc nhở, cảnh báo thiếu ngủ và cập nhật routine sẽ xuất hiện tại đây.</p>
    `;
    container.appendChild(empty);
    return;
  }

  list.forEach(item => {
    const row = document.createElement('div');
    row.className = `notification-item ${item.readAt ? '' : 'unread'}`;
    row.innerHTML = `
      <div class="notification-item-icon"><i class="fa-solid fa-bell"></i></div>
      <div>
        <h4></h4>
        <p></p>
        <div class="notification-time"></div>
      </div>
    `;
    row.querySelector('h4').textContent = item.title || 'Thông báo';
    row.querySelector('p').textContent = item.message || '';
    row.querySelector('.notification-time').textContent = formatNotificationTime(item.createdAt || item.created_at);
    container.appendChild(row);
  });
}

export async function openNotificationHistory() {
  const overlay = document.getElementById('notification-history-modal');
  const list = document.getElementById('notification-history-list');
  if (!overlay || !list) return;

  list.innerHTML = '<div class="notification-loading">Đang tải lịch sử...</div>';
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');

  try {
    const notifications = await fetchBackendNotifications();
    renderNotifications(notifications || readNotifications(), list);
  } catch (err) {
    console.warn(err.message);
    renderNotifications(readNotifications(), list);
  }
}

export function closeNotificationHistory() {
  const overlay = document.getElementById('notification-history-modal');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
}

window.openNotificationHistory = openNotificationHistory;
window.closeNotificationHistory = closeNotificationHistory;
