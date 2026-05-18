import { apiFetch, getToken } from './api.js';
import { navigateTo, hideSplash, toggleTheme } from './ui.js';
import { fetchUserInfo, initRememberedLogin } from './auth.js';
import { getTodayDateString, loadDashboardData, loadSleepData, loadSleepProfile } from './sleep.js';
import { fetchDeviceData, fetchRoutines, initDeviceControls, initSoundGrid } from './device.js';
import './chat.js';

let calendarCursorDate = null;
let activeCalendarPicker = null;

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
      await loadSleepProfile();
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

function openCalendarPicker({ input, title = 'Lịch phân tích', kicker = 'Chọn ngày', onSelect = null, closeOnSelect = true } = {}) {
  const targetInput = typeof input === 'string' ? document.querySelector(input) : input;
  if (!targetInput) return;

  activeCalendarPicker = {
    input: targetInput,
    onSelect: typeof onSelect === 'function' ? onSelect : null,
    closeOnSelect
  };

  const titleEl = document.getElementById('analytics-calendar-title');
  const kickerEl = document.querySelector('#analytics-calendar-modal .calendar-header .chart-kicker');
  if (titleEl) titleEl.textContent = title;
  if (kickerEl) kickerEl.textContent = kicker;

  calendarCursorDate = new Date(`${targetInput.value || getTodayDateString()}T00:00:00`);
  renderAnalyticsCalendar();
  const modal = document.getElementById('analytics-calendar-modal');
  modal?.classList.add('active');
  modal?.setAttribute('aria-hidden', 'false');
}

function openAnalyticsDatePicker() {
  const input = document.getElementById('analytics-date-input');
  openCalendarPicker({
    input,
    title: 'Lịch phân tích',
    kicker: 'Chọn ngày',
    onSelect: () => {
      updateAnalyticsDateLabel();
      reloadActiveAnalytics();
    }
  });
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

function closeAnalyticsCalendar() {
  const modal = document.getElementById('analytics-calendar-modal');
  modal?.classList.remove('active');
  modal?.setAttribute('aria-hidden', 'true');
}

function shiftCalendarMonth(months) {
  const input = activeCalendarPicker?.input || document.getElementById('analytics-date-input');
  const base = calendarCursorDate || new Date(`${input?.value || getTodayDateString()}T00:00:00`);
  calendarCursorDate = new Date(base.getFullYear(), base.getMonth() + months, 1);
  renderAnalyticsCalendar();
}

function selectAnalyticsDate(dateString) {
  const input = activeCalendarPicker?.input || document.getElementById('analytics-date-input');
  if (!input) return;
  input.value = dateString;
  calendarCursorDate = new Date(`${dateString}T00:00:00`);
  if (activeCalendarPicker?.onSelect) {
    activeCalendarPicker.onSelect(dateString, input);
  } else {
    updateAnalyticsDateLabel();
    reloadActiveAnalytics();
  }
  if (activeCalendarPicker?.closeOnSelect !== false) closeAnalyticsCalendar();
}

function toDateInputValue(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function renderAnalyticsCalendar() {
  const grid = document.getElementById('analytics-calendar-grid');
  const label = document.getElementById('calendar-month-label');
  const input = activeCalendarPicker?.input || document.getElementById('analytics-date-input');
  if (!grid || !label || !input) return;

  const selectedValue = input.value || getTodayDateString();
  const todayValue = getTodayDateString();
  const cursor = calendarCursorDate || new Date(`${selectedValue}T00:00:00`);
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - startOffset);

  label.textContent = monthStart.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  grid.innerHTML = '';

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const value = toDateInputValue(date);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-day';
    button.textContent = String(date.getDate());
    if (date.getMonth() !== monthStart.getMonth()) button.classList.add('muted');
    if (value === todayValue) button.classList.add('today');
    if (value === selectedValue) button.classList.add('selected');
    button.addEventListener('click', () => selectAnalyticsDate(value));
    grid.appendChild(button);
  }
}

window.closeAnalyticsCalendar = closeAnalyticsCalendar;
window.openCalendarPicker = openCalendarPicker;
window.shiftCalendarMonth = shiftCalendarMonth;
window.selectAnalyticsDate = selectAnalyticsDate;
window.getTodayDateString = getTodayDateString;

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
      ? '588.000₫ <span>/năm</span>'
      : '49.000₫ <span>/tháng</span>';
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
  const amount = planType === 'year' ? 588000 : 49000;

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
