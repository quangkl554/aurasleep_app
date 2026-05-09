import { apiFetch, clearSession, getToken } from './api.js';
import { isAudioSessionActive, stopActiveSound } from './device.js';

let appAlertCloseHandler = null;
let appPromptResolver = null;
let appConfirmResolver = null;
let currentScreenId = null;
const nativeAlert = window.alert.bind(window);

const profileInfoContent = {
  security: {
    icon: 'fa-solid fa-shield-halved',
    title: 'Bảo mật & Quyền riêng tư',
    description: 'Các thiết lập tạm để bạn thay bằng chính sách thật sau khi hoàn thiện hệ thống tài khoản.',
    items: [
      ['Đăng nhập an toàn', 'Tài khoản đang dùng xác thực bằng email hoặc số điện thoại và mật khẩu. Phiên đăng nhập được lưu bằng token bảo mật.'],
      ['Dữ liệu giấc ngủ', 'Dữ liệu ghi nhận giấc ngủ chỉ dùng để tạo dashboard, biểu đồ phân tích và gợi ý cá nhân trong AuraSleep.'],
      ['Quyền riêng tư', 'AuraSleep không hiển thị dữ liệu cá nhân cho người dùng khác. Nội dung này có thể thay bằng điều khoản chính thức của bạn.']
    ]
  },
  support: {
    icon: 'fa-regular fa-circle-question',
    title: 'Trung tâm hỗ trợ',
    description: 'Khu vực hỗ trợ mẫu cho các câu hỏi thường gặp, kết nối thiết bị và vấn đề tài khoản.',
    items: [
      ['Kết nối thiết bị', 'Nếu đèn không phản hồi, hãy kiểm tra nguồn, Bluetooth/Wi-Fi và mở lại màn hình Thiết bị để đồng bộ.'],
      ['Ghi nhận giấc ngủ', 'Vào Trang chủ, chọn Ghi nhận, nhập giờ ngủ và giờ thức dậy để cập nhật dashboard.'],
      ['Liên hệ hỗ trợ', 'Email hỗ trợ mẫu: support@aurasleep.vn. Bạn có thể thay bằng kênh CSKH thật sau.']
    ]
  },
  terms: {
    icon: 'fa-solid fa-file-contract',
    title: 'Điều khoản sử dụng',
    description: 'Bản tóm tắt tạm thời để app có nội dung hoàn chỉnh trước khi bạn import điều khoản pháp lý thật.',
    items: [
      ['Mục đích sử dụng', 'AuraSleep hỗ trợ theo dõi thói quen ngủ, điều khiển ánh sáng, âm thanh và routine thư giãn.'],
      ['Giới hạn tư vấn', 'AuraBot cung cấp gợi ý sinh hoạt và không thay thế tư vấn y tế chuyên môn.'],
      ['Thanh toán & gói dịch vụ', 'Các gói nâng cấp, giá và quyền lợi có thể thay đổi theo chính sách kinh doanh chính thức.']
    ]
  }
};

export function showAppAlert(message, title = 'AuraSleep') {
  const overlay = document.getElementById('app-alert');
  const titleEl = document.getElementById('app-alert-title');
  const messageEl = document.getElementById('app-alert-message');

  if (!overlay || !titleEl || !messageEl) {
    nativeAlert(String(message || ''));
    return;
  }

  titleEl.textContent = title;
  messageEl.textContent = String(message || '');
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('alert-open');
}

export function closeAppAlert() {
  const overlay = document.getElementById('app-alert');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('alert-open');
  if (typeof appAlertCloseHandler === 'function') {
    const handler = appAlertCloseHandler;
    appAlertCloseHandler = null;
    handler();
  }
}

// Override window.alert
window.alert = (message) => showAppAlert(message);
window.closeAppAlert = closeAppAlert;

export function showAppPrompt(message, defaultValue = '', title = 'AuraSleep') {
  const overlay = document.getElementById('app-prompt');
  const titleEl = document.getElementById('app-prompt-title');
  const messageEl = document.getElementById('app-prompt-message');
  const input = document.getElementById('app-prompt-input');

  if (!overlay || !titleEl || !messageEl || !input) {
    return Promise.resolve(window.prompt(message, defaultValue));
  }

  titleEl.textContent = title;
  messageEl.textContent = String(message || '');
  input.value = defaultValue || '';
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');

  setTimeout(() => {
    input.focus();
    input.select();
  }, 30);

  return new Promise(resolve => {
    appPromptResolver = resolve;
  });
}

export function closeAppPrompt(value) {
  const overlay = document.getElementById('app-prompt');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
  }

  if (typeof appPromptResolver === 'function') {
    const resolver = appPromptResolver;
    appPromptResolver = null;
    resolver(value);
  }
}

export function submitAppPrompt() {
  closeAppPrompt(document.getElementById('app-prompt-input')?.value || '');
}

export function cancelAppPrompt() {
  closeAppPrompt(null);
}

window.submitAppPrompt = submitAppPrompt;
window.cancelAppPrompt = cancelAppPrompt;

export function showAppConfirm(message, title = 'Xác nhận') {
  const overlay = document.getElementById('app-confirm');
  const titleEl = document.getElementById('app-confirm-title');
  const messageEl = document.getElementById('app-confirm-message');

  if (!overlay || !titleEl || !messageEl) {
    return Promise.resolve(window.confirm(message));
  }

  titleEl.textContent = title;
  messageEl.textContent = String(message || '');
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');

  return new Promise(resolve => {
    appConfirmResolver = resolve;
  });
}

export function resolveAppConfirm(value) {
  const overlay = document.getElementById('app-confirm');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
  }

  if (typeof appConfirmResolver === 'function') {
    const resolver = appConfirmResolver;
    appConfirmResolver = null;
    resolver(Boolean(value));
  }
}

window.resolveAppConfirm = resolveAppConfirm;

export function openProfileInfo(type) {
  const content = profileInfoContent[type] || profileInfoContent.security;
  const overlay = document.getElementById('profile-info-modal');
  const icon = document.getElementById('profile-info-icon');
  const title = document.getElementById('profile-info-title');
  const description = document.getElementById('profile-info-description');
  const list = document.getElementById('profile-info-list');
  if (!overlay || !icon || !title || !description || !list) return;

  icon.innerHTML = `<i class="${content.icon}"></i>`;
  title.textContent = content.title;
  description.textContent = content.description;
  list.innerHTML = '';
  content.items.forEach(([itemTitle, itemCopy]) => {
    const item = document.createElement('div');
    item.className = 'profile-info-item';
    item.innerHTML = '<h4></h4><p></p>';
    item.querySelector('h4').textContent = itemTitle;
    item.querySelector('p').textContent = itemCopy;
    list.appendChild(item);
  });

  if (type === 'security') {
    const actions = document.createElement('div');
    actions.className = 'profile-info-actions';
    actions.innerHTML = `
      <button type="button" class="app-alert-button app-prompt-primary" onclick="exportAccountData()">Xuất dữ liệu</button>
      <button type="button" class="app-prompt-secondary danger" onclick="deleteAccountData()">Xóa tài khoản</button>
    `;
    list.appendChild(actions);
  }

  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
}

export function closeProfileInfo() {
  const overlay = document.getElementById('profile-info-modal');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
}

window.openProfileInfo = openProfileInfo;
window.closeProfileInfo = closeProfileInfo;

export async function exportAccountData() {
  try {
    const res = await apiFetch('/api/auth/export');
    if (!res.ok) throw new Error('Không thể xuất dữ liệu');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aurasleep-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message);
  }
}

export async function deleteAccountData() {
  const ok = await showAppConfirm('Hành động này sẽ xóa tài khoản và dữ liệu liên quan. Bạn có chắc chắn không?', 'Xóa tài khoản');
  if (!ok) return;
  try {
    const res = await apiFetch('/api/auth/account', { method: 'DELETE' });
    if (!res.ok) throw new Error('Không thể xóa tài khoản');
    clearSession();
    closeProfileInfo();
    navigateTo('login');
  } catch (err) {
    alert(err.message);
  }
}

window.exportAccountData = exportAccountData;
window.deleteAccountData = deleteAccountData;

export function toggleTheme() {
  const htmlEl = document.documentElement;
  const currentTheme = htmlEl.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  htmlEl.setAttribute('data-theme', newTheme);
  localStorage.setItem('aurasleep_theme', newTheme);
  
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.checked = (newTheme === 'light');
  }
}

window.toggleTheme = toggleTheme;

export function updateBottomNavVisibility(screenId) {
  const bottomNav = document.getElementById('bottom-nav');
  if (['login', 'chat', 'blog', 'routine'].includes(screenId)) {
    bottomNav.style.display = 'none';
  } else {
    bottomNav.style.display = 'flex';
  }
}

export function navigateTo(screenId, navElement = null) {
  const protectedScreens = ['dashboard', 'device', 'analytics', 'profile', 'chat', 'routine'];
  if (protectedScreens.includes(screenId) && !getToken()) {
    screenId = 'login';
    navElement = null;
  }

  const isSameScreen = currentScreenId === screenId;

  if (!isSameScreen) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
  }

  const targetScreen = document.getElementById(screenId + '-screen');
  if (targetScreen && !isSameScreen) {
    targetScreen.classList.add('active');
    targetScreen.scrollTop = 0;
  }

  // Tự động ngắt nhạc nếu chỉ là nghe thử và chuyển màn hình
  if (!isAudioSessionActive) {
    stopActiveSound();
    // Tắt hiệu ứng Visualizer trên màn hình Thiết bị
    const visualizer = document.getElementById('audio-visualizer');
    if (visualizer) visualizer.style.display = 'none';
    document.querySelectorAll('.sound-item').forEach(i => i.classList.remove('active'));
  }

  updateBottomNavVisibility(screenId);

  // Trigger data loading based on screen
  if (!isSameScreen && screenId === 'dashboard' && window.loadDashboardData) window.loadDashboardData();
  if (!isSameScreen && screenId === 'device' && window.fetchDeviceData) window.fetchDeviceData();
  if (!isSameScreen && screenId === 'analytics' && window.loadSleepData) {
    const activeRange = document.querySelector('#analytics-tabs .auth-tab.active')?.dataset.tab || 'week';
    window.loadSleepData(activeRange);
  }
  if (!isSameScreen && screenId === 'routine' && window.fetchRoutines) window.fetchRoutines();

  const pulseNavItem = (item) => {
    if (!item) return;
    item.classList.remove('nav-pressed');
    void item.offsetWidth;
    item.classList.add('nav-pressed');
    setTimeout(() => item.classList.remove('nav-pressed'), 520);
  };

  if (navElement) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    navElement.classList.add('active');
    pulseNavItem(navElement);
  } else {
    const navMapping = { 'device': 0, 'analytics': 1, 'dashboard': 2, 'store': 3, 'profile': 4 };
    if (navMapping[screenId] !== undefined) {
      const navItems = document.querySelectorAll('.nav-item');
      navItems.forEach(item => item.classList.remove('active'));
      navItems[navMapping[screenId]].classList.add('active');
      pulseNavItem(navItems[navMapping[screenId]]);
    }
  }
  
  currentScreenId = screenId;
  window.location.hash = screenId;
}

window.navigateTo = navigateTo;

export function hideSplash(delay = 0) {
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.style.display = 'none', 500);
    }
  }, delay);
}
