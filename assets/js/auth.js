import { apiFetch, clearSession } from './api.js';
import { navigateTo, showAppConfirm } from './ui.js';
import { stopActiveSound } from './device.js';
import { ensureWelcomeNotification, rememberNotificationUser } from './notifications.js';

const REMEMBER_LOGIN_KEY = 'aurasleep_remember_login';
let currentUser = null;

function getUserPlan(user = currentUser) {
  return user?.subscription?.plan || user?.Subscriptions?.[0]?.plan || 'free';
}

export function hasPremiumAccess() {
  return getUserPlan() !== 'free';
}

export function isAdminUser() {
  return currentUser?.role === 'admin';
}

function applyMembershipUi(user) {
  const plan = getUserPlan(user);
  const isPremium = plan !== 'free';
  const isAdmin = user?.role === 'admin';

  window.aurasleepCurrentUser = user;
  window.aurasleepPlan = plan;
  window.hasPremiumAccess = isPremium;
  document.documentElement.dataset.plan = isPremium ? 'premium' : 'free';
  document.documentElement.dataset.admin = isAdmin ? 'true' : 'false';

  const adminPanel = document.getElementById('admin-membership-panel');
  if (adminPanel) adminPanel.hidden = !isAdmin;

  document.querySelectorAll('[data-admin-plan]').forEach(button => {
    button.classList.toggle('active', button.dataset.adminPlan === (isPremium ? 'premium_monthly' : 'free'));
    button.disabled = !isAdmin;
  });

  const premiumCta = document.getElementById('premium-cta-button');
  if (premiumCta) {
    premiumCta.disabled = isPremium;
    premiumCta.innerHTML = isPremium
      ? '<i class="fa-solid fa-check" style="margin-right: 8px;"></i> Premium đang hoạt động'
      : '<i class="fa-solid fa-crown" style="margin-right: 8px;"></i> Đăng ký Premium';
  }

  const freeCurrent = document.getElementById('free-plan-current');
  if (freeCurrent) {
    freeCurrent.innerHTML = isPremium
      ? '<i class="fa-solid fa-arrow-up" style="margin-right: 8px;"></i> Đã nâng cấp'
      : '<i class="fa-solid fa-check" style="margin-right: 8px;"></i> Đang sử dụng';
  }
}

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
  currentUser = user;
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

  const planBadge = document.getElementById('profile-plan-badge');
  if (planBadge) {
    const plan = getUserPlan(user);
    const isPremium = plan !== 'free';
    planBadge.textContent = isPremium ? 'Premium Member' : 'Free Member';
    planBadge.style.color = isPremium ? 'var(--accent-primary)' : 'var(--text-secondary)';
  }

  applyMembershipUi(user);
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
      await import('./sleep.js').then(module => module.loadSleepProfile());
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
      await import('./sleep.js').then(module => module.loadSleepProfile());
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

export async function setAdminMembership(plan) {
  if (!isAdminUser()) {
    alert('Chỉ tài khoản quản trị mới có thể chuyển trạng thái test.');
    return;
  }

  const targetPlan = plan === 'premium_monthly' ? 'premium_monthly' : 'free';
  try {
    const res = await apiFetch('/api/auth/membership', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: targetPlan })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Không thể chuyển trạng thái thành viên');
    updateUserUi(data.user);
    await import('./sleep.js').then(module => {
      const activeRange = document.querySelector('#analytics-tabs .auth-tab.active')?.dataset.tab || 'week';
      return module.loadSleepData(activeRange);
    });
    alert(targetPlan === 'premium_monthly' ? 'Đã chuyển sang Premium Member.' : 'Đã chuyển sang Free Member.');
  } catch (err) {
    alert(err.message);
  }
}

window.setAdminMembership = setAdminMembership;

export async function confirmLogout() {
  const res = await showAppConfirm('Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng không?', 'Xác nhận đăng xuất');
  if (res) {
    stopActiveSound();
    clearSession();
    navigateTo('login');
  }
}

window.confirmLogout = confirmLogout;
