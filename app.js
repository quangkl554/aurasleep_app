const API_BASE_URL = (window.AURASLEEP_CONFIG?.API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const TOKEN_KEY = 'aurasleep_token';
const SOUND_EXTENSIONS = ['mp3', 'mp4', 'm4a', 'wav', 'ogg'];
const SOUND_FILE_MAP = {
  rain: 'rain.mp3',
  ocean: 'ocean wave.mp3',
  brown: 'brown noise.mp3',
  fire: 'fire.mp3',
  pink: 'pink noise.mp3',
  piano: 'piano.mp3',
  stream: 'water stream.mp3',
  white: 'white noise.mp3',
  birds: 'bird.mp3',
  wind: 'wind.mp3',
  meditation: 'deep relaxing.mp3',
  alpha: 'alpha waves.mp3'
};
const SLEEP_MODE_SOUND_MINUTES = 30;
const ROUTINE_SOUND_MINUTES = 45;
const soundPlayer = new Audio();
soundPlayer.loop = true;
soundPlayer.preload = 'auto';
let activeSoundKey = null;
let soundErrorNotifiedKey = null;
let soundStopTimerId = null;
let appAlertCloseHandler = null;
let appPromptResolver = null;
const nativeAlert = window.alert.bind(window);

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

function showAppAlert(message, title = 'AuraSleep') {
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

function closeAppAlert() {
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

window.alert = (message) => showAppAlert(message);
window.closeAppAlert = closeAppAlert;

function showAppPrompt(message, defaultValue = '', title = 'AuraSleep') {
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

function closeAppPrompt(value) {
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

function submitAppPrompt() {
  closeAppPrompt(document.getElementById('app-prompt-input')?.value || '');
}

function cancelAppPrompt() {
  closeAppPrompt(null);
}

window.submitAppPrompt = submitAppPrompt;
window.cancelAppPrompt = cancelAppPrompt;

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

function formatSleepDuration(totalSleepMin = 0) {
  const safeMinutes = Math.max(0, Number(totalSleepMin) || 0);
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  return `${h}h ${m}m`;
}

function getRhythmLabel(record) {
  if (!record) return 'Chưa có dữ liệu';
  if ((record.sleepScore || 0) >= 85 && (record.efficiency || 0) >= 85) return 'Ổn định';
  if ((record.sleepScore || 0) >= 70) return 'Cần theo dõi';
  return 'Cần cải thiện';
}

function getDashboardSuggestion(record) {
  if (!record) {
    return 'Chưa có dữ liệu giấc ngủ. Hãy ghi nhận giấc ngủ đầu tiên để AuraBot phân tích chính xác hơn.';
  }

  if ((record.totalSleepMin || 0) < 420) {
    return 'Dữ liệu gần nhất cho thấy thời gian ngủ còn thấp. Tối nay bạn nên bắt đầu routine sớm hơn và ưu tiên âm thanh thư giãn nhẹ.';
  }

  if ((record.sleepScore || 0) < 70) {
    return 'Điểm ngủ gần nhất chưa tốt. Hãy giữ giờ ngủ cố định, giảm ánh sáng mạnh trước khi ngủ và theo dõi lại vào ngày mai.';
  }

  return 'Giấc ngủ gần nhất đang ở mức tốt. Hãy duy trì giờ ngủ hiện tại và routine thư giãn trước khi ngủ.';
}

function isSleepAnalysisPrompt(text) {
  const normalized = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized.includes('phan tich') && normalized.includes('giac ngu');
}

function removeTypingIndicator() {
  const typing = document.getElementById('typing-indicator');
  if (typing) typing.remove();
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
  const appAlert = document.getElementById('app-alert');
  if (appAlert) {
    appAlert.addEventListener('click', (event) => {
      if (event.target === appAlert) closeAppAlert();
    });
  }

  const appPrompt = document.getElementById('app-prompt');
  if (appPrompt) {
    appPrompt.addEventListener('click', (event) => {
      if (event.target === appPrompt) cancelAppPrompt();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAppAlert();
      cancelAppPrompt();
    }
  });

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
async function handleLogin(identifier, password) {
  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, email: identifier, password })
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
  const identifierInput = form?.querySelector('[name="identifier"]');
  const passInput = form?.querySelector('[name="password"]');
  const identifier = identifierInput?.value.trim();
  const password = passInput?.value;

  if (!identifier || !password) {
    alert('Vui lòng nhập email hoặc số điện thoại và mật khẩu.');
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Đang đăng nhập...';
  await handleLogin(identifier, password);
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
  const confirmPassword = form?.querySelector('[name="confirmPassword"]')?.value;

  if (!fullName || !email || !password) {
    alert('Vui lòng nhập họ tên, email và mật khẩu.');
    return;
  }

  if (fullName.length > 50) {
    alert('Họ tên không được vượt quá 50 ký tự.');
    return;
  }

  if (password.length < 6 || password.length > 30) {
    alert('Mật khẩu phải từ 6 đến 30 ký tự.');
    return;
  }

  if (password !== confirmPassword) {
    alert('Mật khẩu nhập lại chưa trùng khớp.');
    return;
  }

  if (phone && !/^(0|\+84)(\d{9}|\d{10})$/.test(phone)) {
    alert('Số điện thoại phải đúng định dạng Việt Nam 10-11 số.');
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Đang tạo...';
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
  if (screenId === 'dashboard') {
    loadDashboardData();
  } else if (screenId === 'device') {
    fetchDeviceData();
  } else if (screenId === 'analytics') {
    loadSleepData('week');
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
        
        setActiveSoundUi(dev.activeSound, false);
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

function getSoundCandidates(soundKey) {
  const mappedFile = SOUND_FILE_MAP[soundKey];
  const fallbackFiles = SOUND_EXTENSIONS.map(ext => `${soundKey}.${ext}`);
  const files = mappedFile ? [mappedFile, ...fallbackFiles] : fallbackFiles;
  return [...new Set(files)].map(file => encodeURI(`assets/sounds/${file}`));
}

function setActiveSoundUi(soundKey, shouldShowVisualizer = true) {
  soundItems.forEach(item => {
    const isMatch = item.dataset.sound === soundKey;
    item.classList.toggle('active', Boolean(isMatch));
    if (isMatch && visualizer && shouldShowVisualizer) {
      visualizer.style.display = 'flex';
      soundNameSpan.textContent = item.querySelector('span')?.textContent || soundKey;
      soundFreqSpan.textContent = item.getAttribute('data-freq') || 'Audio thư giãn';
    }
  });

  if (!soundKey && visualizer) {
    visualizer.style.display = 'none';
  }
}

function getSelectedSoundKey(defaultSoundKey = 'white') {
  return document.querySelector('.sound-item.active')?.dataset.sound || activeSoundKey || defaultSoundKey;
}

function stopActiveSound() {
  soundPlayer.pause();
  soundPlayer.removeAttribute('src');
  soundPlayer.load();
  activeSoundKey = null;
  clearSoundStopTimer();
}

function clearSoundStopTimer() {
  if (soundStopTimerId) {
    clearTimeout(soundStopTimerId);
    soundStopTimerId = null;
  }
}

function scheduleSoundStop(minutes) {
  clearSoundStopTimer();
  if (!minutes) return;
  soundStopTimerId = setTimeout(() => {
    stopActiveSound();
    setActiveSoundUi(null);
  }, minutes * 60 * 1000);
}

function playSoundCandidate(soundKey, candidates, index = 0) {
  if (index >= candidates.length) {
    stopActiveSound();
    if (soundErrorNotifiedKey !== soundKey) {
      soundErrorNotifiedKey = soundKey;
      alert(`Chưa tìm thấy file âm thanh cho "${soundKey}". Hãy thêm file vào assets/sounds/${soundKey}.mp3 hoặc .mp4.`);
    }
    return;
  }

  soundPlayer.onerror = () => playSoundCandidate(soundKey, candidates, index + 1);
  soundPlayer.src = candidates[index];
  soundPlayer.play().then(() => {
    activeSoundKey = soundKey;
    soundErrorNotifiedKey = null;
  }).catch(() => playSoundCandidate(soundKey, candidates, index + 1));
}

function playSound(soundKey, stopAfterMinutes = null) {
  if (!soundKey) {
    stopActiveSound();
    return;
  }
  if (stopAfterMinutes) {
    scheduleSoundStop(stopAfterMinutes);
  } else {
    clearSoundStopTimer();
  }
  playSoundCandidate(soundKey, getSoundCandidates(soundKey));
}

soundItems.forEach(item => {
  item.addEventListener('click', () => {
    const isActive = item.classList.contains('active');
    
    if (!isActive) {
      soundItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const soundKey = item.dataset.sound;
      
      if (visualizer) {
        visualizer.style.display = 'flex';
        soundNameSpan.textContent = item.querySelector('span').textContent;
        soundFreqSpan.textContent = item.getAttribute('data-freq') || 'Audio thư giãn';
      }

      playSound(soundKey);
      debounceUpdateSettings({ activeSound: soundKey });
    } else {
      item.classList.remove('active');
      if (visualizer) visualizer.style.display = 'none';
      stopActiveSound();
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
    const soundKey = getSelectedSoundKey('white');
    setActiveSoundUi(soundKey);
    playSound(soundKey, SLEEP_MODE_SOUND_MINUTES);
    alert(`Khởi động Chế độ Ngủ. Âm thanh sẽ lặp và tự dừng sau ${SLEEP_MODE_SOUND_MINUTES} phút.`);
  } else {
    btn.classList.remove('active-sleep');
    btn.innerHTML = '<i class="fa-solid fa-power-off" style="margin-right: 8px;"></i> Kích hoạt chế độ ngủ';
    btn.style.background = '';
    btn.style.boxShadow = '';
    stopActiveSound();
    setActiveSoundUi(null);
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

  if (btn.classList.contains('routine-active')) {
    stopActiveSound();
    setActiveSoundUi(null);
    btn.classList.remove('routine-active');
    btn.innerHTML = '<i class="fa-solid fa-play" style="margin-right: 8px;"></i> Kích hoạt Routine Này';
    btn.style.background = '';
    alert('Đã hủy Routine và dừng âm thanh.');
    return;
  }
  
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
  const soundKey = getSelectedSoundKey('rain');
  setActiveSoundUi(soundKey);
  playSound(soundKey, ROUTINE_SOUND_MINUTES);
  btn.classList.add('routine-active');
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
async function loadDashboardData() {
  const token = localStorage.getItem('aurasleep_token');
  if (!token) return;

  const scoreValue = document.querySelector('#dashboard-screen .score-value');
  const statVals = document.querySelectorAll('#dashboard-screen .stat-val');
  const aiSuggestion = document.querySelector('#dashboard-screen .ai-card p');

  try {
    const res = await apiFetch('/api/sleep?range=week', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch dashboard sleep data');

    const data = await res.json();
    const records = Array.isArray(data) ? data : [];
    const lastRecord = records[records.length - 1];

    if (!lastRecord) {
      if (scoreValue) scoreValue.textContent = '--';
      if (statVals.length >= 3) {
        statVals[0].textContent = '0h 0m';
        statVals[1].textContent = '--';
        statVals[2].textContent = 'Chưa có dữ liệu';
      }
      if (aiSuggestion) aiSuggestion.textContent = getDashboardSuggestion(null);
      return;
    }

    if (scoreValue) scoreValue.textContent = lastRecord.sleepScore ?? '--';
    if (statVals.length >= 3) {
      statVals[0].textContent = formatSleepDuration(lastRecord.totalSleepMin);
      statVals[1].textContent = lastRecord.efficiency ? `${lastRecord.efficiency}%` : '--';
      statVals[2].textContent = getRhythmLabel(lastRecord);
    }
    if (aiSuggestion) aiSuggestion.textContent = getDashboardSuggestion(lastRecord);
  } catch (err) {
    console.error('Lỗi khi tải dashboard sleep data', err);
    if (scoreValue) scoreValue.textContent = '--';
    if (statVals.length >= 3) {
      statVals[0].textContent = '0h 0m';
      statVals[1].textContent = '--';
      statVals[2].textContent = 'Không tải được';
    }
    if (aiSuggestion) aiSuggestion.textContent = 'Chưa tải được dữ liệu giấc ngủ. Hãy kiểm tra kết nối rồi thử lại.';
  }
}

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
        statVals[0].textContent = formatSleepDuration(lastRecord.totalSleepMin);
        
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
    } else {
      const statVals = document.querySelectorAll('#analytics-screen .stat-val');
      if (statVals.length >= 4) {
        statVals[0].textContent = '0h 0m';
        statVals[1].textContent = '--';
        statVals[1].style.color = 'var(--text-secondary)';
        statVals[2].textContent = '--';
        statVals[3].textContent = '--';
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
async function editTime(btn) {
  const timeDiv = btn.parentElement.querySelector('.routine-time');
  if (timeDiv) {
    const currentTime = timeDiv.textContent;
    const newTime = await showAppPrompt('Nhập thời gian mới theo định dạng HH:MM.', currentTime, 'Chỉnh thời gian');
    if (newTime && newTime.trim() !== '') {
      const trimmedTime = newTime.trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmedTime)) {
        alert('Thời gian phải đúng định dạng HH:MM, ví dụ 22:00.');
        return;
      }
      timeDiv.textContent = trimmedTime;
    }
  }
}

// Chatbot Functionality (Calling Real Groq API)
let currentChatSessionId = null;

async function buildLocalSleepAnalysisMessage() {
  const res = await apiFetch('/api/sleep?range=week');
  if (!res.ok) {
    return 'Mình chưa tải được dữ liệu giấc ngủ từ server. Bạn thử lại sau ít phút nhé.';
  }

  const records = await res.json();
  if (!Array.isArray(records) || records.length === 0) {
    return 'Bạn chưa có dữ liệu giấc ngủ để phân tích. Sau khi có bản ghi đầu tiên, AuraBot sẽ dựa trên thời lượng ngủ, hiệu suất, thời gian chìm giấc và điểm ngủ để đưa ra gợi ý cá nhân.';
  }

  const last7 = records.slice(-7);
  const latest = last7[last7.length - 1];
  const avgMinutes = Math.round(last7.reduce((sum, item) => sum + (item.totalSleepMin || 0), 0) / last7.length);
  const avgScore = Math.round(last7.reduce((sum, item) => sum + (item.sleepScore || 0), 0) / last7.length);
  const avgEfficiency = Math.round(last7.reduce((sum, item) => sum + (item.efficiency || 0), 0) / last7.length);

  return [
    'Phân tích giấc ngủ từ dữ liệu thật của bạn:',
    `- Gần nhất: ${formatSleepDuration(latest.totalSleepMin)}, điểm ${latest.sleepScore || '--'}/100, hiệu suất ${latest.efficiency || '--'}%.`,
    `- Trung bình ${last7.length} bản ghi gần nhất: ${formatSleepDuration(avgMinutes)}, điểm ${avgScore}/100, hiệu suất ${avgEfficiency}%.`,
    `- Đánh giá: ${getRhythmLabel(latest)}.`,
    getDashboardSuggestion(latest)
  ].join('\n');
}

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
    if (isSleepAnalysisPrompt(messageText)) {
      const reply = await buildLocalSleepAnalysisMessage();
      removeTypingIndicator();
      const botMsg = document.createElement('div');
      botMsg.className = 'message bot';
      appendMultilineText(botMsg, reply);
      chatMessages.appendChild(botMsg);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return;
    }

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
    removeTypingIndicator();

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
      botMsg.textContent = errData.message?.includes('Groq')
        ? 'AuraBot AI chưa được cấu hình Groq trên server. Riêng phần phân tích giấc ngủ vẫn có thể dùng dữ liệu thật của bạn.'
        : 'Lỗi từ Server: ' + (errData.message || 'Hệ thống đang bận');
      chatMessages.appendChild(botMsg);
    }
  } catch (err) {
    removeTypingIndicator();
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
