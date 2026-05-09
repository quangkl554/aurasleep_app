import { apiFetch, getToken } from './api.js';
import { navigateTo, hideSplash, toggleTheme } from './ui.js';
import { fetchUserInfo, initRememberedLogin } from './auth.js';
import { getTodayDateString, loadDashboardData, loadSleepData } from './sleep.js';
import { fetchDeviceData, fetchRoutines, initDeviceControls, initSoundGrid } from './device.js';
import './chat.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Load theme
  const savedTheme = localStorage.getItem('aurasleep_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) themeToggleBtn.checked = (savedTheme === 'light');

  // Handle Initial Screen
  let initialScreen = window.location.hash.replace('#', '') || 'login';
  const token = getToken();

  if (token) {
    const isValid = await fetchUserInfo(token);
    if (isValid) {
      navigateTo('dashboard');
      hideSplash(0);
    } else {
      hideSplash(500);
    }
  } else {
    hideSplash(1500);
    navigateTo('login');
  }

  // Event Listeners for Sliders or other global UI elements not handled in modules
  initRememberedLogin();
  initSoundGrid();
  initDeviceControls();

  const analyticsDateInput = document.getElementById('analytics-date-input');
  if (analyticsDateInput) {
    analyticsDateInput.value = getTodayDateString();
    updateAnalyticsDateLabel();
    analyticsDateInput.addEventListener('change', () => {
      updateAnalyticsDateLabel();
      const activeRange = document.querySelector('#analytics-tabs .auth-tab.active')?.dataset.tab || 'week';
      loadSleepData(activeRange);
    });
  }

  document.querySelectorAll('#analytics-tabs .auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('active')) return;
      document.querySelectorAll('#analytics-tabs .auth-tab').forEach(item => item.classList.remove('active'));
      tab.classList.add('active');
      loadSleepData(tab.dataset.tab || 'week');
    });
  });

});

function formatFriendlyDate(dateString) {
  const today = getTodayDateString();
  const date = new Date(`${dateString}T00:00:00`);
  if (dateString === today) return 'Hôm nay';
  if (Number.isNaN(date.getTime())) return 'Chọn ngày';
  return date.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function updateAnalyticsDateLabel() {
  const input = document.getElementById('analytics-date-input');
  const label = document.getElementById('analytics-date-label');
  if (!input || !label) return;
  if (!input.value) input.value = getTodayDateString();
  label.textContent = formatFriendlyDate(input.value);
}

function reloadActiveAnalytics() {
  const activeRange = document.querySelector('#analytics-tabs .auth-tab.active')?.dataset.tab || 'week';
  loadSleepData(activeRange);
}

function openAnalyticsDatePicker() {
  const input = document.getElementById('analytics-date-input');
  if (!input) return;
  if (typeof input.showPicker === 'function') {
    input.showPicker();
  } else {
    input.focus();
    input.click();
  }
}

function shiftAnalyticsDate(days) {
  const input = document.getElementById('analytics-date-input');
  if (!input) return;
  const base = new Date(`${input.value || getTodayDateString()}T00:00:00`);
  base.setDate(base.getDate() + days);
  const next = new Date(base.getTime() - base.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  input.value = next;
  updateAnalyticsDateLabel();
  reloadActiveAnalytics();
}

window.openAnalyticsDatePicker = openAnalyticsDatePicker;
window.shiftAnalyticsDate = shiftAnalyticsDate;

// Expose some functions to window for global access if needed
window.toggleTheme = toggleTheme;

function switchBilling(element, type) {
  const toggles = element.parentElement.querySelectorAll('.sub-toggle');
  toggles.forEach(toggle => {
    toggle.classList.remove('active');
    toggle.style.background = 'transparent';
    toggle.style.color = 'var(--text-secondary)';
  });

  element.classList.add('active');
  element.style.background = 'var(--card-bg)';
  element.style.color = 'var(--text-primary)';

  const priceEl = document.getElementById('premium-price');
  if (priceEl) {
    priceEl.innerHTML = type === 'year'
      ? '799.000₫ <span>/năm</span>'
      : '99.000₫ <span>/tháng</span>';
  }
}

async function upgradePremium() {
  if (!getToken()) {
    alert('Vui lòng đăng nhập trước khi thanh toán.');
    navigateTo('login');
    return;
  }

  const activeBilling = document.querySelector('.sub-toggle.active');
  const planType = activeBilling?.textContent.includes('Năm') ? 'year' : 'month';
  const amount = planType === 'year' ? 799000 : 99000;

  try {
    const res = await apiFetch('/api/payment/create-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planType, amount })
    });

    if (res.ok) {
      const data = await res.json();
      window.location.href = data.paymentUrl;
    } else {
      const errData = await res.json().catch(() => ({}));
      alert('Lỗi thanh toán: ' + (errData.message || 'Hệ thống đang bận'));
    }
  } catch (err) {
    console.error('Lỗi thanh toán:', err);
    alert('Lỗi kết nối tới máy chủ thanh toán.');
  }
}

window.switchBilling = switchBilling;
window.upgradePremium = upgradePremium;
