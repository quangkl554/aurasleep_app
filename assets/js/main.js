import { getToken } from './api.js';
import { navigateTo, hideSplash, toggleTheme } from './ui.js';
import { fetchUserInfo } from './auth.js';
import { loadDashboardData, loadSleepData } from './sleep.js';
import { fetchDeviceData, fetchRoutines } from './device.js';

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
  const intensitySlider = document.getElementById('intensity-slider');
  if (intensitySlider) {
    intensitySlider.addEventListener('input', (e) => {
      document.getElementById('light-val').textContent = e.target.value + '%';
    });
  }
});

// Expose some functions to window for global access if needed
window.toggleTheme = toggleTheme;
