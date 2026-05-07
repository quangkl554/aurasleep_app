import { apiFetch, getToken } from './api.js';
import { navigateTo, hideSplash, toggleTheme } from './ui.js';
import { fetchUserInfo } from './auth.js';
import { loadDashboardData, loadSleepData } from './sleep.js';
import { fetchDeviceData, fetchRoutines, initSoundGrid } from './device.js';
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
  initSoundGrid();

  document.querySelectorAll('#analytics-tabs .auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#analytics-tabs .auth-tab').forEach(item => item.classList.remove('active'));
      tab.classList.add('active');
      loadSleepData(tab.dataset.tab || 'week');
    });
  });

  const intensitySlider = document.getElementById('intensity-slider');
  if (intensitySlider) {
    intensitySlider.addEventListener('input', (e) => {
      document.getElementById('light-val').textContent = e.target.value + '%';
    });
  }
});

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
