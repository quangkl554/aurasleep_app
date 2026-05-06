const API_BASE_URL = (window.AURASLEEP_CONFIG?.API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const TOKEN_KEY = 'aurasleep_token';

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  currentChatSessionId = null;
  document.querySelectorAll('.header-greeting h2').forEach(el => {
    el.textContent = 'AURASLEEP';
  });
  document.querySelectorAll('.avatar').forEach(el => {
    el.textContent = 'AS';
  });
}

function updateUserUi(user) {
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

function handleUnauthorized() {
  clearSession();
  navigateTo('login');
}

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl(path), { ...options, headers });

  if (response.status === 401) {
    handleUnauthorized();
  }

  return response;
}

function appendMultilineText(element, text) {
  const lines = String(text || '').split('\n');
  lines.forEach((line, index) => {
    if (index > 0) element.appendChild(document.createElement('br'));
    element.appendChild(document.createTextNode(line));
  });
}

function hideSplash(delay = 0) {
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.style.display = 'none', 500);
    }
  }, delay);
}

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved theme
  const savedTheme = localStorage.getItem('aurasleep_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  // Update toggle button state if on profile screen
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.checked = (savedTheme === 'light');
  }

  const authTabs = document.querySelectorAll('#login-screen .auth-tab');
  if (authTabs.length >= 2) {
    authTabs[0].id = 'login-tab';
    authTabs[1].id = 'register-tab';
    authTabs[0].addEventListener('click', () => switchAuthMode('login'));
    authTabs[1].addEventListener('click', () => switchAuthMode('register'));
  }

  // Set initial screen based on URL hash or default to login
  let initialScreen = window.location.hash.replace('#', '') || 'login';
  
  // Check if it's a valid screen, otherwise default to login
  const validScreens = ['login', 'dashboard', 'device', 'analytics', 'store', 'profile', 'chat', 'blog', 'routine'];
  if (!validScreens.includes(initialScreen)) {
    initialScreen = 'login';
  }
  
  // Initial setup: hide bottom nav on login screen
  updateBottomNavVisibility(initialScreen);
  
  const token = getToken();
  if (token) {
    const isValidSession = await fetchUserInfo(token);
    if (isValidSession) {
      navigateTo('dashboard');
      const splash = document.getElementById('splash-screen');
      if (splash) splash.style.display = 'none';
    } else {
      hideSplash(500);
    }
  } else {
    hideSplash(1500);
  }
    
  // Initialize audio visualizer for active sound
  const activeSound = document.querySelector('.sound-item.active');
  if (activeSound) {
    const visualizer = document.getElementById('audio-visualizer');
    const soundNameSpan = document.getElementById('playing-sound-name');
    const soundFreqSpan = document.getElementById('playing-sound-freq');
    if (visualizer) {
      visualizer.style.display = 'flex';
      soundNameSpan.textContent = activeSound.querySelector('span').textContent;
      soundFreqSpan.textContent = activeSound.getAttribute('data-freq') || 'Băng thông rộng (20Hz - 20kHz)';
    }
  }
});

// Theme Toggle Function
function toggleTheme() {
  const htmlEl = document.documentElement;
  const currentTheme = htmlEl.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  htmlEl.setAttribute('data-theme', newTheme);
  localStorage.setItem('aurasleep_theme', newTheme);
  
  // Keep toggle switch in sync if it exists
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.checked = (newTheme === 'light');
  }
}

// Fetch User Info
async function fetchUserInfo(token) {
  try {
    const res = await apiFetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const user = await res.json();
      updateUserUi(user);
      return true;
    } else {
      // Token hết hạn hoặc không hợp lệ
      clearSession();
      navigateTo('login');
      // Hiện splash rồi mới vào login cho mượt
      const splash = document.getElementById('splash-screen');
      if (splash) {
        splash.style.display = 'flex';
        splash.style.opacity = '1';
        setTimeout(() => {
          splash.style.opacity = '0';
          setTimeout(() => splash.style.display = 'none', 500);
        }, 1000);
      }
      return false;
    }
  } catch (e) {
    console.error('Lỗi khi lấy thông tin user:', e);
    clearSession();
    navigateTo('login');
    return false;
  }
}

// API Login
async function handleLogin(email, password) {
  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      updateUserUi(data.user);
      
      navigateTo('dashboard');
    } else {
      const err = await res.json().catch(() => ({}));
      alert('Đăng nhập thất bại: ' + err.message);
    }
  } catch (e) {
    alert('Lỗi kết nối tới Server!');
    console.error(e);
  }
}

async function handleLoginFromForm(button) {
  const form = document.getElementById('login-form');
  const emailInput = form?.querySelector('input[type="email"]');
  const passInput = form?.querySelector('input[type="password"]');
  const email = emailInput?.value.trim();
  const password = passInput?.value;

  if (!email || !password) {
    alert('Vui long nhap email va mat khau.');
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Dang dang nhap...';
  await handleLogin(email, password);
  button.disabled = false;
  button.textContent = originalText;
}

function switchAuthMode(mode) {
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

async function handleRegister(fullName, email, password, phone) {
  try {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password, phone })
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      updateUserUi(data.user);
      navigateTo('dashboard');
    } else {
      const err = await res.json().catch(() => ({}));
      alert('Dang ky that bai: ' + (err.message || 'Khong the tao tai khoan'));
    }
  } catch (e) {
    alert('Loi ket noi toi Server!');
    console.error(e);
  }
}

async function handleRegisterFromForm(button) {
  const form = document.getElementById('register-form');
  const fullName = form?.querySelector('[name="fullName"]')?.value.trim();
  const email = form?.querySelector('[name="email"]')?.value.trim();
  const phone = form?.querySelector('[name="phone"]')?.value.trim();
  const password = form?.querySelector('[name="password"]')?.value;

  if (!fullName || !email || !password) {
    alert('Vui long nhap ho ten, email va mat khau.');
    return;
  }

  if (password.length < 6 || password.length > 72) {
    alert('Mat khau phai tu 6 den 72 ky tu.');
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Dang tao...';
  await handleRegister(fullName, email, password, phone);
  button.disabled = false;
  button.textContent = originalText;
}

// Navigation Function
function navigateTo(screenId, navElement = null) {
  const protectedScreens = ['dashboard', 'device', 'analytics', 'profile', 'chat', 'routine'];
  if (protectedScreens.includes(screenId) && !getToken()) {
    screenId = 'login';
    navElement = null;
  }

  // 1. Hide all screens
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => {
    screen.classList.remove('active');
  });

  // 2. Show target screen
  const targetScreen = document.getElementById(screenId + '-screen');
  if (targetScreen) {
    targetScreen.classList.add('active');
    
    // Scroll to top
    targetScreen.scrollTop = 0;
  }

  // 3. Update Bottom Nav UI
  updateBottomNavVisibility(screenId);

  // 4. Gọi API tùy theo màn hình
  if (screenId === 'device') {
    fetchDeviceData();
  } else if (screenId === 'routine') {
    fetchRoutines();
  }

  // 5. Kiểm tra nếu url có param vnp_ResponseId -> thông báo nạp thẻ thành công
  if (screenId === 'profile' && window.location.href.includes('vnp_SecureHash')) {
    alert('Thanh toán VNPay thành công! Gói Premium đã được kích hoạt.');
    // Xóa param trên thanh địa chỉ để không hiện lại popup
    window.history.replaceState({}, document.title, `${window.location.pathname}#profile`);
  }

  if (navElement) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    navElement.classList.add('active');
  } else {
    // If navigated via code (not clicking bottom nav), try to find the matching nav item
    const navMapping = {
      'dashboard': 0,
      'device': 1,
      'analytics': 2,
      'store': 3,
      'profile': 4
    };
    
    if (navMapping[screenId] !== undefined) {
      const navItems = document.querySelectorAll('.nav-item');
      navItems.forEach(item => item.classList.remove('active'));
      navItems[navMapping[screenId]].classList.add('active');
    }
  }
  
  // Update URL hash for simple state management
  window.location.hash = screenId;

}

function updateBottomNavVisibility(screenId) {
  const bottomNav = document.getElementById('bottom-nav');
  // Hide bottom nav on login, chat, blog, routine
  if (['login', 'chat', 'blog', 'routine'].includes(screenId)) {
    bottomNav.style.display = 'none';
  } else {
    bottomNav.style.display = 'flex';
  }
}

// Device Control Interactions
const intensitySlider = document.getElementById('intensity-slider');
const tempSlider = document.getElementById('temp-slider');
const lightVal = document.getElementById('light-val');
const lightIcon = document.getElementById('light-icon');
const lightDisplay = document.getElementById('light-display');

function getLightColor(temp) {
  // Simple mapping: 2700K (warm/orange) to 6500K (cool/blue-white)
  // 2700: #ff8c00, 4500: #fefcf3, 6500: #e0f2fe
  if (temp < 3500) return '#ff8c00'; // Warm Amber
  if (temp < 5000) return '#fefcf3'; // Soft White
  return '#e0f2fe'; // Cool Blue
}

// Fetch Device Data from API
let currentDeviceId = null;
async function fetchDeviceData() {
  const token = localStorage.getItem('aurasleep_token');
  if (!token) return;
  try {
    const res = await apiFetch('/api/devices', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const devices = await res.json();
      if (devices.length > 0) {
        const dev = devices[0];
        currentDeviceId = dev.id;
        
        // Update UI based on data
        if (intensitySlider) {
          intensitySlider.value = dev.lightIntensity;
          intensitySlider.dispatchEvent(new Event('input'));
        }
        if (tempSlider) {
          tempSlider.value = dev.colorTemp;
          tempSlider.dispatchEvent(new Event('input'));
        }
        
        // Update Sound
        const soundItems = document.querySelectorAll('.sound-item');
        soundItems.forEach(item => {
          item.classList.remove('active');
          if (item.getAttribute('data-freq') && item.getAttribute('data-freq').includes(dev.activeSound)) {
            item.classList.add('active');
            item.click(); // Trigger visualizer update
          }
        });
      }
    }
  } catch (e) {
    console.error('Lỗi tải thiết bị:', e);
  }
}

// Debounce helper to avoid spamming API when dragging slider
let timeoutId;
function debounceUpdateSettings(data) {
  clearTimeout(timeoutId);
  timeoutId = setTimeout(async () => {
    if (!currentDeviceId) return;
    const token = localStorage.getItem('aurasleep_token');
    try {
      await apiFetch(`/api/devices/${currentDeviceId}/settings`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(data)
      });
    } catch (e) {
      console.error('Lỗi lưu cài đặt:', e);
    }
  }, 500); // Wait 0.5s after stop dragging
}

if (intensitySlider && lightDisplay) {
  intensitySlider.addEventListener('input', (e) => {
    const val = e.target.value;
    lightVal.textContent = val + '%';
    
    const opacity = (val / 100).toFixed(2);
    const color = tempSlider ? getLightColor(tempSlider.value) : 'var(--accent-primary)';
    
    lightIcon.style.color = color;
    lightIcon.style.textShadow = `0 0 ${val}px ${color}`;
    
    let rgb = '244, 162, 97';
    if (tempSlider) {
      if (tempSlider.value < 3500) rgb = '255, 140, 0';
      else if (tempSlider.value < 5000) rgb = '254, 252, 243';
      else rgb = '224, 242, 254';
    }
    lightDisplay.style.background = `radial-gradient(circle, rgba(${rgb}, ${opacity}) 0%, rgba(${rgb}, 0) 70%)`;

    // Save to DB
    debounceUpdateSettings({ lightIntensity: parseInt(val) });
  });
}

if (tempSlider && lightDisplay) {
  tempSlider.addEventListener('input', (e) => {
    // Trigger intensity update to apply color
    intensitySlider.dispatchEvent(new Event('input'));
  });
}

// Sound grid toggle and Visualizer logic
const soundItems = document.querySelectorAll('.sound-item');
const visualizer = document.getElementById('audio-visualizer');
const soundNameSpan = document.getElementById('playing-sound-name');
const soundFreqSpan = document.getElementById('playing-sound-freq');

soundItems.forEach(item => {
  item.addEventListener('click', () => {
    const isActive = item.classList.contains('active');
    
    if (!isActive) {
      soundItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      if (visualizer) {
        visualizer.style.display = 'flex';
        soundNameSpan.textContent = item.querySelector('span').textContent;
        soundFreqSpan.textContent = item.getAttribute('data-freq') || 'Băng thông rộng (20Hz - 20kHz)';
        
        // Save to DB
        debounceUpdateSettings({ activeSound: soundNameSpan.textContent });
      }
    } else {
      item.classList.remove('active');
      if (visualizer) visualizer.style.display = 'none';
      debounceUpdateSettings({ activeSound: null });
    }
  });
});

// Sleep Mode Activation (Calling API)
async function toggleSleepMode(btn) {
  const isSleep = btn.classList.contains('active-sleep');
  if (!isSleep) {
    if (currentDeviceId) {
      const token = localStorage.getItem('aurasleep_token');
      try {
        await apiFetch(`/api/devices/${currentDeviceId}/sleep-mode`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) { console.error('Lỗi bật sleep mode:', e); }
    }

    btn.classList.add('active-sleep');
    btn.innerHTML = '<i class="fa-solid fa-moon" style="margin-right: 8px;"></i> Chế độ ngủ đang bật...';
    btn.style.background = '#10b981';
    btn.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.4)';
    alert('Khởi động Chế độ Ngủ. Ánh sáng sẽ giảm dần trong 30 phút tới.');
  } else {
    btn.classList.remove('active-sleep');
    btn.innerHTML = '<i class="fa-solid fa-power-off" style="margin-right: 8px;"></i> Kích hoạt chế độ ngủ';
    btn.style.background = '';
    btn.style.boxShadow = '';
  }
}

// Routine Logic (Gọi API)
async function fetchRoutines() {
  const token = localStorage.getItem('aurasleep_token');
  if (!token) return;
  try {
    const res = await apiFetch('/api/routines', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const routines = await res.json();
      if (routines.length > 0) {
        // Cập nhật giao diện nếu đã có routine lưu
        const r = routines[0];
        const timeDivs = document.querySelectorAll('.routine-time');
        if (timeDivs.length > 0) {
          timeDivs[0].textContent = r.scheduledTime || '22:00';
        }
      }
    }
  } catch (e) {
    console.error('Lỗi lấy routine:', e);
  }
}

async function activateRoutine(btn) {
  const timeDivs = document.querySelectorAll('.routine-time');
  const targetTime = timeDivs.length > 0 ? timeDivs[0].textContent : '22:00';
  
  const token = localStorage.getItem('aurasleep_token');
  if (token) {
    try {
      await apiFetch('/api/routines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: 'My Routine',
          scheduledTime: targetTime,
          steps: [
            { deviceType: 'light', action: 'set_intensity_30', durationMin: 30 }
          ]
        })
      });
    } catch (e) { console.error(e); }
  }

  alert(`Đã lên lịch Sleep Routine! Báo thức tự nhiên sẽ kêu vào ${targetTime} sáng mai.`);
  btn.innerHTML = '<i class="fa-solid fa-check" style="margin-right: 8px;"></i> Đã kích hoạt';
  btn.style.background = '#10b981';
}

// Logout Confirmation
function confirmLogout() {
  const res = confirm("Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng không?");
  if (res) {
    clearSession();
    navigateTo('login');
  }
}

// Store Pricing Toggle & VNPay Payment
function switchBilling(element, type) {
  // Update UI toggles
  const toggles = element.parentElement.querySelectorAll('.sub-toggle');
  toggles.forEach(t => {
    t.classList.remove('active');
    t.style.background = 'transparent';
    t.style.color = 'var(--text-secondary)';
  });
  
  element.classList.add('active');
  element.style.background = 'var(--card-bg)';
  element.style.color = 'var(--text-primary)';
  
  // Update Price
  const priceDisplay = document.getElementById('premium-price');
  if (type === 'month') {
    priceDisplay.innerHTML = '99.000₫ <span>/tháng</span>';
    priceDisplay.setAttribute('data-plan', 'month');
    priceDisplay.setAttribute('data-price', '99000');
  } else {
    priceDisplay.innerHTML = '799.000₫ <span>/năm</span>';
    priceDisplay.setAttribute('data-plan', 'year');
    priceDisplay.setAttribute('data-price', '799000');
  }
}

async function upgradePremium() {
  const priceDisplay = document.getElementById('premium-price');
  const amount = priceDisplay ? parseInt(priceDisplay.getAttribute('data-price') || '99000') : 99000;
  const planType = priceDisplay ? priceDisplay.getAttribute('data-plan') || 'month' : 'month';
  const token = localStorage.getItem('aurasleep_token');
  if (!token) {
    alert('Vui long dang nhap truoc khi thanh toan.');
    navigateTo('login');
    return;
  }
  
  try {
    const res = await apiFetch('/api/payment/create-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ amount, planType })
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

// Analytics Tabs Logic
const analyticsTabs = document.querySelectorAll('#analytics-tabs .auth-tab');
if (analyticsTabs) {
  analyticsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      analyticsTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const range = tab.dataset.tab; // 'today', 'week', 'month'
      loadSleepData(range);
    });
  });
}

// Gọi API lấy dữ liệu giấc ngủ thật
async function loadSleepData(range) {
  const token = localStorage.getItem('aurasleep_token');
  if (!token) return;

  try {
    const res = await apiFetch('/api/sleep?range=' + encodeURIComponent(range), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch data');
    const data = await res.json();
    
    // Cập nhật biểu đồ (nếu có dữ liệu)
    const bars = document.querySelectorAll('.chart-bar');
    const vals = document.querySelectorAll('.chart-value');
    const containers = document.querySelectorAll('.chart-bar-container');
    const dayLabels = document.querySelectorAll('.chart-bar-container > span:last-child');
    
    // Lấy 7 bản ghi cuối cùng
    const last7 = data.slice(-7);
    
    bars.forEach((bar, index) => {
      const record = last7[index];
      
      // Reset all to inactive
      containers[index].classList.remove('active');
      bar.style.background = 'var(--border)';
      bar.style.boxShadow = 'none';
      if (vals[index]) {
        vals[index].style.color = 'var(--text-secondary)';
        vals[index].style.fontWeight = '600';
      }

      if (record) {
        // Dữ liệu thật từ DB
        const heightPercent = Math.max(30, Math.min(100, (record.totalSleepMin / 60) / 9 * 100));
        bar.style.height = heightPercent + '%';
        
        if (vals[index]) {
          const hours = (record.totalSleepMin / 60).toFixed(1);
          vals[index].textContent = hours + 'h';
        }

        if (dayLabels[index]) {
          const date = new Date(record.date);
          const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
          dayLabels[index].textContent = days[date.getDay()];
        }
      } else {
        // Không có dữ liệu
        bar.style.height = '10%';
        if (vals[index]) vals[index].textContent = '0h';
      }
    });
    
    // Highlight ngày cuối cùng có dữ liệu
    if (last7.length > 0) {
      const activeIndex = last7.length - 1;
      containers[activeIndex].classList.add('active');
      bars[activeIndex].style.background = 'var(--accent-primary)';
      bars[activeIndex].style.boxShadow = '0 0 10px rgba(244,162,97,0.5)';
      if (vals[activeIndex]) {
        vals[activeIndex].style.color = 'var(--accent-primary)';
        vals[activeIndex].style.fontWeight = '800';
      }
      
      // Cập nhật 4 thẻ số liệu dựa trên ngày cuối cùng (Hôm nay)
      const lastRecord = last7[activeIndex];
      const statVals = document.querySelectorAll('#analytics-screen .stat-val');
      if (statVals.length >= 4) {
        const h = Math.floor(lastRecord.totalSleepMin / 60);
        const m = lastRecord.totalSleepMin % 60;
        statVals[0].textContent = `${h}h ${m}m`;
        
        // Tính % thay đổi so với ngày trước đó
        let change = 0;
        if (last7.length >= 2) {
            const prevRecord = last7[activeIndex - 1];
            change = Math.round(((lastRecord.totalSleepMin - prevRecord.totalSleepMin) / prevRecord.totalSleepMin) * 100);
        }
        statVals[1].textContent = (change >= 0 ? '+' : '') + change + '%';
        statVals[1].style.color = change >= 0 ? '#10b981' : '#ef4444';
        
        statVals[2].textContent = lastRecord.fallAsleepMin + ' phút';
        statVals[3].textContent = lastRecord.sleepScore + '/100';
      }
    }
  } catch (err) {
    console.error('Lỗi khi tải dữ liệu giấc ngủ', err);
  }
}

// Select specific bar on click
function selectBar(element) {
  const containers = document.querySelectorAll('.chart-bar-container');
  const bars = document.querySelectorAll('.chart-bar');
  const vals = document.querySelectorAll('.chart-value');

  containers.forEach((c, i) => {
    c.classList.remove('active');
    bars[i].style.background = 'var(--border)';
    bars[i].style.boxShadow = 'none';
    if (vals[i]) {
      vals[i].style.color = 'var(--text-secondary)';
      vals[i].style.fontWeight = '600';
    }
  });

  element.classList.add('active');
  const bar = element.querySelector('.chart-bar');
  const val = element.querySelector('.chart-value');
  
  bar.style.background = 'var(--accent-primary)';
  bar.style.boxShadow = '0 0 10px rgba(244,162,97,0.5)';
  if (val) {
    val.style.color = 'var(--accent-primary)';
    val.style.fontWeight = '800';
  }
}

// Edit Time Function
function editTime(btn) {
  const timeDiv = btn.parentElement.querySelector('.routine-time');
  if (timeDiv) {
    const currentTime = timeDiv.textContent;
    const newTime = prompt('Nhập thời gian mới (HH:MM):', currentTime);
    if (newTime && newTime.trim() !== '') {
      timeDiv.textContent = newTime.trim();
    }
  }
}

// Chatbot Functionality (Calling Real Groq API)
let currentChatSessionId = null;

async function sendChatMessage() {
  const inputField = document.getElementById('chat-input-field');
  const messageText = inputField.value.trim();
  
  if (messageText === '') return;
  
  const chatMessages = document.getElementById('chat-messages');
  
  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'message user';
  userMsg.textContent = messageText;
  chatMessages.appendChild(userMsg);
  
  // Clear input
  inputField.value = '';
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Add typing indicator
  const typingMsg = document.createElement('div');
  typingMsg.className = 'message bot';
  typingMsg.id = 'typing-indicator';
  typingMsg.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  chatMessages.appendChild(typingMsg);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Call API
  const token = localStorage.getItem('aurasleep_token');
  try {
    const res = await apiFetch('/api/chat/send', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({
        sessionId: currentChatSessionId,
        message: messageText
      })
    });

    // Remove typing indicator
    document.getElementById('typing-indicator').remove();

    if (res.ok) {
      const data = await res.json();
      currentChatSessionId = data.sessionId; // Lưu sessionId cho các tin nhắn sau

      const botMsg = document.createElement('div');
      botMsg.className = 'message bot';
      appendMultilineText(botMsg, data.reply);
      chatMessages.appendChild(botMsg);
    } else {
      const errData = await res.json();
      const botMsg = document.createElement('div');
      botMsg.className = 'message bot';
      botMsg.textContent = 'Lỗi từ Server: ' + (errData.message || 'Hệ thống đang bận');
      chatMessages.appendChild(botMsg);
    }
  } catch (err) {
    document.getElementById('typing-indicator').remove();
    const botMsg = document.createElement('div');
    botMsg.className = 'message bot';
    botMsg.textContent = 'Mất kết nối tới server AI.';
    chatMessages.appendChild(botMsg);
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Allow Enter key to send message
function handleChatEnter(e) {
  if (e.key === 'Enter') {
    sendChatMessage();
  }
}
