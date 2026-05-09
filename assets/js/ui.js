import { getToken } from './api.js';
import { isAudioSessionActive, stopActiveSound } from './device.js';

let appAlertCloseHandler = null;
let appPromptResolver = null;
let appConfirmResolver = null;
const nativeAlert = window.alert.bind(window);

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

  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => screen.classList.remove('active'));

  const targetScreen = document.getElementById(screenId + '-screen');
  if (targetScreen) {
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
  if (screenId === 'dashboard' && window.loadDashboardData) window.loadDashboardData();
  if (screenId === 'device' && window.fetchDeviceData) window.fetchDeviceData();
  if (screenId === 'analytics' && window.loadSleepData) window.loadSleepData('week');
  if (screenId === 'routine' && window.fetchRoutines) window.fetchRoutines();

  if (navElement) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    navElement.classList.add('active');
  } else {
    const navMapping = { 'device': 0, 'analytics': 1, 'dashboard': 2, 'store': 3, 'profile': 4 };
    if (navMapping[screenId] !== undefined) {
      const navItems = document.querySelectorAll('.nav-item');
      navItems.forEach(item => item.classList.remove('active'));
      navItems[navMapping[screenId]].classList.add('active');
    }
  }
  
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
