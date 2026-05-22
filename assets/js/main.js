import { apiFetch, getToken } from './api.js';
import { navigateTo, hideSplash, toggleTheme } from './ui.js';
import { fetchUserInfo, initRememberedLogin } from './auth.js';
import { getTodayDateString, loadDashboardData, loadSleepData, loadSleepProfile } from './sleep.js';
import { fetchDeviceData, fetchRoutines, initDeviceControls, initSoundGrid } from './device.js';
import './chat.js';

let calendarCursorDate = null;
let activeCalendarPicker = null;
let activeTimeInput = null;
let timePickerValue = { hour: 22, minute: 30 };

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
  const sleepEntryModal = document.getElementById('sleep-entry-modal');
  if (sleepEntryModal) initCustomTimeInputs(sleepEntryModal);

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

function padTimePart(value) {
  return String(value).padStart(2, '0');
}

function normalizeTimeParts(hour, minute) {
  let safeHour = Number(hour);
  let safeMinute = Number(minute);
  if (!Number.isFinite(safeHour)) safeHour = 22;
  if (!Number.isFinite(safeMinute)) safeMinute = 30;

  safeHour = ((Math.round(safeHour) % 24) + 24) % 24;
  safeMinute = Math.round(safeMinute / 5) * 5;

  while (safeMinute >= 60) {
    safeMinute -= 60;
    safeHour = (safeHour + 1) % 24;
  }
  while (safeMinute < 0) {
    safeMinute += 60;
    safeHour = (safeHour + 23) % 24;
  }

  return { hour: safeHour, minute: safeMinute };
}

function parseTimeValue(value, fallback = '22:30') {
  const source = /^\d{2}:\d{2}$/.test(value || '') ? value : fallback;
  const [hour, minute] = source.split(':').map(Number);
  return normalizeTimeParts(hour, minute);
}

function formatTimeValue(value) {
  const { hour, minute } = parseTimeValue(value);
  return `${padTimePart(hour)}:${padTimePart(minute)}`;
}

function getTimeInputLabel(input) {
  return input?.closest('label')?.querySelector('span')?.textContent?.trim() || 'Chọn giờ';
}

function getTimePresets(input) {
  const name = String(input?.name || '').toLowerCase();
  if (name.includes('wake')) return ['05:30', '06:00', '06:30', '07:00', '07:30'];
  if (name.includes('caffeine')) return ['12:00', '13:00', '14:00', '15:00', '16:00'];
  if (name.includes('start')) return ['20:30', '21:00', '21:30', '22:00', '22:30'];
  return ['21:30', '22:00', '22:30', '23:00', '23:30'];
}

function updateTimeButton(input) {
  const button = input?.nextElementSibling?.classList?.contains('time-picker-button')
    ? input.nextElementSibling
    : null;
  if (!button) return;
  const valueEl = button.querySelector('strong');
  if (valueEl) valueEl.textContent = formatTimeValue(input.value || input.dataset.fallback || '22:30');
  button.setAttribute('aria-label', `${getTimeInputLabel(input)} ${valueEl?.textContent || ''}`);
}

function refreshTimePickerButtons(root = document) {
  root.querySelectorAll('input[data-time-enhanced="true"]').forEach(updateTimeButton);
}

function initCustomTimeInputs(root = document) {
  root.querySelectorAll('input[type="time"]:not([data-time-enhanced="true"])').forEach(input => {
    const fallback = input.getAttribute('value') || input.value || '22:30';
    input.dataset.timeEnhanced = 'true';
    input.dataset.fallback = fallback;
    input.classList.add('time-input-native');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'time-picker-button';
    button.innerHTML = '<i class="fa-regular fa-clock"></i><strong>--:--</strong>';
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', () => openTimePicker(input));
    input.insertAdjacentElement('afterend', button);
    input.addEventListener('change', () => updateTimeButton(input));
    updateTimeButton(input);
  });
}

function openTimePicker(input) {
  activeTimeInput = typeof input === 'string' ? document.querySelector(input) : input;
  if (!activeTimeInput) return;
  timePickerValue = parseTimeValue(activeTimeInput.value, activeTimeInput.dataset.fallback || '22:30');

  const title = document.getElementById('time-picker-title');
  if (title) title.textContent = getTimeInputLabel(activeTimeInput);

  renderTimePicker();
  const modal = document.getElementById('time-picker-modal');
  modal?.classList.add('active');
  modal?.setAttribute('aria-hidden', 'false');
}

function closeTimePicker() {
  const modal = document.getElementById('time-picker-modal');
  modal?.classList.remove('active');
  modal?.setAttribute('aria-hidden', 'true');
}

function setTimePickerPreset(value) {
  timePickerValue = parseTimeValue(value);
  renderTimePicker();
}

function shiftTimePicker(part, amount) {
  const delta = Number(amount) || 0;
  if (part === 'hour') {
    timePickerValue = normalizeTimeParts(timePickerValue.hour + delta, timePickerValue.minute);
  } else {
    timePickerValue = normalizeTimeParts(timePickerValue.hour, timePickerValue.minute + delta);
  }
  renderTimePicker();
}

function renderTimePicker() {
  const value = `${padTimePart(timePickerValue.hour)}:${padTimePart(timePickerValue.minute)}`;
  const preview = document.getElementById('time-picker-value');
  const hour = document.getElementById('time-picker-hour');
  const minute = document.getElementById('time-picker-minute');
  const presets = document.getElementById('time-picker-presets');
  if (preview) preview.textContent = value;
  if (hour) hour.textContent = padTimePart(timePickerValue.hour);
  if (minute) minute.textContent = padTimePart(timePickerValue.minute);
  if (!presets) return;

  presets.innerHTML = '';
  getTimePresets(activeTimeInput).forEach(preset => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = preset;
    button.className = preset === value ? 'active' : '';
    button.addEventListener('click', () => setTimePickerPreset(preset));
    presets.appendChild(button);
  });
}

function applyTimePicker() {
  if (!activeTimeInput) return;
  activeTimeInput.value = `${padTimePart(timePickerValue.hour)}:${padTimePart(timePickerValue.minute)}`;
  activeTimeInput.dispatchEvent(new Event('change', { bubbles: true }));
  updateTimeButton(activeTimeInput);
  closeTimePicker();
}

window.closeTimePicker = closeTimePicker;
window.shiftTimePicker = shiftTimePicker;
window.applyTimePicker = applyTimePicker;
window.refreshTimePickerButtons = refreshTimePickerButtons;

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
