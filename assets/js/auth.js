import { apiFetch, clearSession } from './api.js';
import { navigateTo, showAppConfirm } from './ui.js';
import { stopActiveSound } from './device.js';
import { ensureWelcomeNotification, rememberNotificationUser } from './notifications.js';

const REMEMBER_LOGIN_KEY = 'aurasleep_remember_login';

function saveRememberedLogin(identifier, shouldRemember) {
  if (!shouldRemember) {
    localStorage.removeItem(REMEMBER_LOGIN_KEY);
    return;
  }

  localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({
    identifier,
    savedAt: new Date().toISOString()
  }));
}

export function initRememberedLogin() {
  const form = document.getElementById('login-form');
  const checkbox = document.getElementById('remember-login');
  if (!form || !checkbox) return;

  try {
    const saved = JSON.parse(localStorage.getItem(REMEMBER_LOGIN_KEY) || 'null');
    if (!saved) return;
    const identifierInput = form.querySelector('[name="identifier"]');
    if (identifierInput) identifierInput.value = saved.identifier || '';
    checkbox.checked = true;
  } catch {
    localStorage.removeItem(REMEMBER_LOGIN_KEY);
  }
}

export function updateUserUi(user) {
  rememberNotificationUser(user);
  const displayName = user.fullName || 'AURASLEEP';
  const nameElements = document.querySelectorAll('.header-greeting h2, h2');
  nameElements.forEach(el => {
    if (el.matches('.header-greeting h2') || el.textContent === 'AURASLEEP' || el.classList.contains('user-name')) {
      el.textContent = displayName;
    }
  });
  document.querySelectorAll('.avatar').forEach(el => {
    el.textContent = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  });
}

export async function fetchUserInfo(token) {
  try {
    const res = await apiFetch('/api/auth/me');
    if (res.ok) {
      const user = await res.json();
      updateUserUi(user);
      ensureWelcomeNotification(user);
      return true;
    } else {
      clearSession();
      navigateTo('login');
      return false;
    }
  } catch (e) {
    console.error('Lỗi khi lấy thông tin user:', e);
    clearSession();
    navigateTo('login');
    return false;
  }
}

export async function handleLogin(identifier, password, rememberLogin = false) {
  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, email: identifier, password })
    });
    
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('aurasleep_token', data.token);
      updateUserUi(data.user);
      ensureWelcomeNotification(data.user);
      saveRememberedLogin(identifier, rememberLogin);
      navigateTo('dashboard');
    } else {
      const err = await res.json().catch(() => ({}));
      alert('Đăng nhập thất bại: ' + err.message);
    }
  } catch (e) {
    alert('Lỗi kết nối tới Server!');
  }
}

export async function handleLoginFromForm(button) {
  const form = document.getElementById('login-form');
  const identifier = form?.querySelector('[name="identifier"]')?.value.trim();
  const password = form?.querySelector('[name="password"]')?.value;
  const rememberLogin = Boolean(form?.querySelector('[name="rememberLogin"]')?.checked);

  if (!identifier || !password) {
    alert('Vui lòng nhập email hoặc số điện thoại và mật khẩu.');
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Đang đăng nhập...';
  await handleLogin(identifier, password, rememberLogin);
  button.disabled = false;
  button.textContent = originalText;
}

window.handleLoginFromForm = handleLoginFromForm;

export function switchAuthMode(mode) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginTab = document.getElementById('login-tab');
  const registerTab = document.getElementById('register-tab');
  const isRegister = mode === 'register';

  if (loginForm) loginForm.style.display = isRegister ? 'none' : 'block';
  if (registerForm) registerForm.style.display = isRegister ? 'block' : 'none';
  if (loginTab) loginTab.classList.toggle('active', !isRegister);
  if (registerTab) registerTab.classList.toggle('active', isRegister);
}

window.switchAuthMode = switchAuthMode;

export async function handleRegister(fullName, email, password, phone) {
  try {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password, phone })
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('aurasleep_token', data.token);
      updateUserUi(data.user);
      ensureWelcomeNotification(data.user);
      navigateTo('dashboard');
    } else {
      const err = await res.json().catch(() => ({}));
      alert('Đăng ký thất bại: ' + (err.message || 'Không thể tạo tài khoản'));
    }
  } catch (e) {
    alert('Lỗi kết nối tới Server!');
  }
}

export async function handleRegisterFromForm(button) {
  const form = document.getElementById('register-form');
  const fullName = form?.querySelector('[name="fullName"]')?.value.trim();
  const email = form?.querySelector('[name="email"]')?.value.trim();
  const phone = form?.querySelector('[name="phone"]')?.value.trim();
  const password = form?.querySelector('[name="password"]')?.value;
  const confirmPassword = form?.querySelector('[name="confirmPassword"]')?.value;

  if (!fullName || !email || !password) {
    alert('Vui lòng nhập họ tên, email và mật khẩu.');
    return;
  }

  if (password !== confirmPassword) {
    alert('Mật khẩu nhập lại chưa trùng khớp.');
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Đang tạo...';
  await handleRegister(fullName, email, password, phone);
  button.disabled = false;
  button.textContent = originalText;
}

window.handleRegisterFromForm = handleRegisterFromForm;

export async function confirmLogout() {
  const res = await showAppConfirm('Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng không?', 'Xác nhận đăng xuất');
  if (res) {
    stopActiveSound();
    clearSession();
    navigateTo('login');
  }
}

window.confirmLogout = confirmLogout;
