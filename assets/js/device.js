import { apiFetch } from './api.js';
import { showAppPrompt } from './ui.js';

let updateSettingsTimeout;
function debounceUpdateSettings(data) {
  clearTimeout(updateSettingsTimeout);
  updateSettingsTimeout = setTimeout(async () => {
    try {
      const resDev = await apiFetch('/api/devices');
      const devices = await resDev.json();
      if (devices.length > 0) {
        await apiFetch(`/api/devices/${devices[0].id}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
    } catch (e) { console.error('Lưu cài đặt lỗi:', e); }
  }, 500);
}

function colorTempToRgb(kelvin) {
  const temp = Math.max(2700, Math.min(6500, Number(kelvin) || 3200)) / 100;
  let red;
  let green;
  let blue;

  if (temp <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(temp) - 161.1195681661;
    blue = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  } else {
    red = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    green = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
    blue = 255;
  }

  const clamp = value => Math.round(Math.max(0, Math.min(255, value)));
  return `${clamp(red)}, ${clamp(green)}, ${clamp(blue)}`;
}

function getTempLabel(colorTemp) {
  if (colorTemp < 3400) return 'Ấm áp';
  if (colorTemp < 5000) return 'Trung tính';
  return 'Mát dịu';
}

export function updateLightPreview({ lightIntensity, colorTemp }) {
  const intensity = Math.max(0, Math.min(100, Number(lightIntensity) || 0));
  const temp = Math.max(2700, Math.min(6500, Number(colorTemp) || 3200));
  const rgb = colorTempToRgb(temp);
  const display = document.getElementById('light-display');
  const icon = document.getElementById('light-icon');
  const lightVal = document.getElementById('light-val');
  const tempVal = document.getElementById('temp-val');
  const alpha = Math.max(0.08, intensity / 100);

  if (lightVal) lightVal.textContent = `${intensity}%`;
  if (tempVal) tempVal.textContent = `${temp}K · ${getTempLabel(temp)}`;
  if (display) {
    display.style.background = `radial-gradient(circle, rgba(${rgb}, ${0.18 + alpha * 0.48}) 0%, rgba(${rgb}, ${0.08 + alpha * 0.22}) 42%, rgba(${rgb}, 0) 72%)`;
    display.style.boxShadow = intensity > 0 ? `0 0 ${18 + intensity * 0.45}px rgba(${rgb}, ${0.12 + alpha * 0.34})` : 'none';
    display.style.opacity = intensity > 0 ? '1' : '0.45';
  }
  if (icon) {
    icon.style.color = `rgb(${rgb})`;
    icon.style.textShadow = intensity > 0 ? `0 0 ${14 + intensity * 0.45}px rgba(${rgb}, ${0.35 + alpha * 0.45})` : 'none';
    icon.style.transform = `scale(${0.92 + intensity / 900})`;
  }
}

export const SOUND_FILE_MAP = {
  rain: 'rain.mp3', ocean: 'ocean wave.mp3', brown: 'brown noise.mp3',
  fire: 'fire.mp3', pink: 'pink noise.mp3', piano: 'piano.mp3',
  stream: 'water stream.mp3', white: 'white noise.mp3', birds: 'bird.mp3',
  wind: 'wind.mp3', meditation: 'deep relaxing.mp3', alpha: 'alpha waves.mp3'
};
const FREE_SOUND_KEYS = new Set(['rain', 'ocean', 'brown', 'pink', 'piano', 'white']);

export const soundPlayer = new Audio();
soundPlayer.loop = true;
let activeSoundKey = null;
let soundStopTimerId = null;
export let isAudioSessionActive = false; // Flag: true nếu được bật qua Mode hoặc Routine

export function stopActiveSound() {
  soundPlayer.pause();
  soundPlayer.removeAttribute('src');
  soundPlayer.load();
  activeSoundKey = null;
  if (soundStopTimerId) clearTimeout(soundStopTimerId);
}

export function playSound(soundKey, stopAfterMinutes = null) {
  if (!soundKey) { stopActiveSound(); return; }
  if (isSoundLocked(soundKey)) {
    alert('Âm thanh này được mở khóa trong bản Premium.');
    return;
  }
  const fileName = SOUND_FILE_MAP[soundKey];
  if (!fileName) return;

  soundPlayer.src = `assets/sounds/${fileName}`;
  soundPlayer.play().then(() => {
    activeSoundKey = soundKey;
    if (stopAfterMinutes) {
      soundStopTimerId = setTimeout(stopActiveSound, stopAfterMinutes * 60 * 1000);
    }
  }).catch(err => console.error('Lỗi phát âm thanh:', err));
}

export function setActiveSoundUi(soundKey) {
  document.querySelectorAll('.sound-item').forEach(item => {
    item.classList.toggle('active', item.dataset.sound === soundKey);
  });
}

export async function fetchDeviceData() {
  try {
    const res = await apiFetch('/api/devices');
    const devices = await res.json();
    if (devices.length > 0) {
      const dev = devices[0];
      const intensitySlider = document.getElementById('intensity-slider');
      const tempSlider = document.getElementById('temp-slider');
      if (intensitySlider) intensitySlider.value = dev.lightIntensity ?? 60;
      if (tempSlider) tempSlider.value = dev.colorTemp ?? 3200;
      updateLightPreview({
        lightIntensity: dev.lightIntensity ?? 60,
        colorTemp: dev.colorTemp ?? 3200
      });
      setActiveSoundUi(dev.activeSound);
    }
    await fetchDeviceHistory();
  } catch (e) { console.error(e); }
}

window.fetchDeviceData = fetchDeviceData;

function isSoundLocked(soundKey) {
  return !window.hasPremiumAccess && !FREE_SOUND_KEYS.has(soundKey);
}

export function applySoundAccessUi() {
  document.querySelectorAll('.sound-item, .routine-sound-option').forEach(item => {
    const soundKey = item.dataset.sound || item.dataset.routineSound;
    const locked = isSoundLocked(soundKey);
    item.classList.toggle('sound-locked', locked);
    item.setAttribute('aria-disabled', String(locked));
    item.title = locked ? 'Mở khóa trong bản Premium' : '';
  });

  const activeRoutine = document.querySelector('.routine-sound-option.active');
  if (activeRoutine && isSoundLocked(activeRoutine.dataset.routineSound)) {
    const fallback = document.querySelector('.routine-sound-option[data-routine-sound="rain"]');
    if (fallback) selectRoutineSound(fallback);
  }

  const activeSound = document.querySelector('.sound-item.active');
  if (activeSound && isSoundLocked(activeSound.dataset.sound)) {
    activeSound.classList.remove('active');
    stopActiveSound();
  }
}

window.applySoundAccessUi = applySoundAccessUi;

export function toggleDeviceHistory() {
  const card = document.getElementById('device-history-card');
  const button = card?.querySelector('.device-history-toggle');
  if (!card || !button) return;
  const willOpen = card.classList.contains('is-collapsed');
  card.classList.toggle('is-collapsed', !willOpen);
  button.setAttribute('aria-expanded', String(willOpen));
}

window.toggleDeviceHistory = toggleDeviceHistory;

export function initDeviceControls() {
  const intensitySlider = document.getElementById('intensity-slider');
  const tempSlider = document.getElementById('temp-slider');
  const getState = () => ({
    lightIntensity: Number(intensitySlider?.value || 60),
    colorTemp: Number(tempSlider?.value || 3200)
  });

  updateLightPreview(getState());

  if (intensitySlider) {
    intensitySlider.addEventListener('input', () => {
      const state = getState();
      updateLightPreview(state);
      debounceUpdateSettings({ lightIntensity: state.lightIntensity });
    });
  }

  if (tempSlider) {
    tempSlider.addEventListener('input', () => {
      const state = getState();
      updateLightPreview(state);
      debounceUpdateSettings({ colorTemp: state.colorTemp });
    });
  }
}

export async function toggleSleepMode(btn) {
  const isSleep = btn.classList.contains('active-sleep');
  if (!isSleep) {
    btn.classList.add('active-sleep');
    btn.innerHTML = '<i class="fa-solid fa-moon"></i> Đang bật...';
    playSound('white', 30);
    isAudioSessionActive = true; 
  } else {
    btn.classList.remove('active-sleep');
    btn.innerHTML = '<i class="fa-solid fa-power-off"></i> Kích hoạt';
    stopActiveSound();
    isAudioSessionActive = false;
  }
}

window.toggleSleepMode = toggleSleepMode;

export async function fetchRoutines() {
  try {
    const res = await apiFetch('/api/routines');
    const routines = await res.json();
    renderSavedRoutines(Array.isArray(routines) ? routines : []);
  } catch (e) { console.error(e); }
}

window.fetchRoutines = fetchRoutines;

function formatRepeatDays(value) {
  const labels = { mon: 'T2', tue: 'T3', wed: 'T4', thu: 'T5', fri: 'T6', sat: 'T7', sun: 'CN' };
  return String(value || '').split(',').filter(Boolean).map(day => labels[day] || day).join(', ') || 'Chưa đặt lịch';
}

function renderSavedRoutines(routines) {
  const list = document.getElementById('routine-saved-list');
  if (!list) return;
  list.innerHTML = '';

  if (!routines.length) {
    list.innerHTML = '<div class="routine-empty">Chưa có routine đã lưu. Tạo routine đầu tiên để AuraSleep nhắc bạn đúng lịch.</div>';
    return;
  }

  routines.forEach(routine => {
    const firstStep = [...(routine.steps || [])].sort((a, b) => a.stepOrder - b.stepOrder)[0];
    const card = document.createElement('div');
    card.className = 'routine-saved-card';
    card.innerHTML = `
      <div>
        <strong></strong>
        <p></p>
      </div>
      <button type="button" class="routine-toggle-btn"></button>
    `;
    card.querySelector('strong').textContent = routine.name || 'Routine thư giãn';
    card.querySelector('p').textContent = `${firstStep?.time || '--:--'} · ${formatRepeatDays(routine.repeatDays)} · ${(routine.steps || []).length} bước`;
    const toggle = card.querySelector('button');
    toggle.textContent = routine.isActive ? 'Đang bật' : 'Đã tắt';
    toggle.classList.toggle('active', Boolean(routine.isActive));
    toggle.addEventListener('click', () => toggleRoutineActive(routine, toggle));
    list.appendChild(card);
  });
}

async function toggleRoutineActive(routine, button) {
  const nextActive = !routine.isActive;
  button.disabled = true;
  try {
    const res = await apiFetch(`/api/routines/${routine.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: nextActive })
    });
    if (!res.ok) throw new Error('Không thể cập nhật routine');
    await fetchRoutines();
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
  }
}

export async function saveRoutineBuilder(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const selectedSound = document.querySelector('.routine-sound-option.active')?.dataset.routineSound || 'rain';
  if (isSoundLocked(selectedSound)) {
    alert('Âm thanh này được mở khóa trong bản Premium.');
    return;
  }
  const soundName = document.querySelector('.routine-sound-option.active span')?.textContent || 'Mưa rào';
  const repeatDays = Array.from(form.querySelectorAll('[name="repeatDays"]:checked')).map(input => input.value);
  const startTime = form.elements.startTime.value || '22:00';
  const sleepTime = form.elements.sleepTime.value || '22:30';
  const wakeTime = form.elements.wakeTime.value || '06:30';
  const payload = {
    name: form.elements.name.value.trim() || 'Routine thư giãn',
    repeatDays,
    sound: selectedSound,
    steps: [
      {
        time: startTime,
        action: 'sound',
        label: 'Bắt đầu thư giãn',
        sound: selectedSound,
        soundVolume: 35,
        lightIntensity: 30,
        colorTemp: 3000,
        description: `Phát ${soundName}, giảm ánh sáng và chuẩn bị ngủ.`
      },
      {
        time: sleepTime,
        action: 'breathing',
        label: 'Đi vào giấc ngủ',
        description: 'Thở chậm và giữ âm nền nhẹ trong 45 phút.'
      },
      {
        time: wakeTime,
        action: 'wake',
        label: 'Báo thức bình minh',
        lightIntensity: 70,
        colorTemp: 4200,
        description: 'Tăng sáng dần để thức dậy tự nhiên hơn.'
      }
    ]
  };

  const button = form.querySelector('button[type="submit"]');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Đang lưu...';

  try {
    const res = await apiFetch('/api/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Không thể lưu routine');
    await fetchRoutines();
    alert('Đã lưu routine.');
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

window.saveRoutineBuilder = saveRoutineBuilder;

async function fetchDeviceHistory() {
  const list = document.getElementById('device-history-list');
  if (!list) return;
  try {
    const res = await apiFetch('/api/devices/history');
    if (!res.ok) return;
    const commands = await res.json();
    list.innerHTML = '';
    if (!commands.length) {
      list.innerHTML = '<div class="device-history-empty">Chưa có hoạt động đồng bộ. Hãy thử đổi độ sáng, nhiệt độ màu hoặc âm thanh.</div>';
      return;
    }
    commands.slice(0, 5).forEach(command => {
      const item = document.createElement('div');
      item.className = 'device-history-item';
      item.innerHTML = '<div><strong></strong><small></small></div><time></time>';
      item.querySelector('strong').textContent = getDeviceCommandLabel(command.command);
      item.querySelector('small').textContent = getDeviceCommandDetail(command);
      item.querySelector('time').textContent = new Date(command.createdAt || command.created_at).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      list.appendChild(item);
    });
  } catch (err) {
    console.warn('Không thể tải lịch sử thiết bị:', err.message);
  }
}

function getDeviceCommandLabel(command) {
  const labels = {
    update_settings: 'Cập nhật cài đặt',
    sleep_mode: 'Bật chế độ ngủ'
  };
  return labels[command] || 'Đồng bộ thiết bị';
}

function getDeviceCommandDetail(command) {
  const payload = command.payload || {};
  const details = [];
  if (payload.lightIntensity !== undefined) details.push(`Đèn ${payload.lightIntensity}%`);
  if (payload.colorTemp !== undefined) details.push(`${payload.colorTemp}K`);
  if (payload.activeSound !== undefined) details.push(payload.activeSound ? `Âm thanh ${payload.activeSound}` : 'Tắt âm thanh');
  if (payload.soundVolume !== undefined) details.push(`Âm lượng ${payload.soundVolume}%`);
  if (command.command === 'sleep_mode') details.push('Giảm sáng trong 30 phút');
  return details.filter(Boolean).join(' · ') || 'Đã gửi từ app';
}

export async function activateRoutine(btn) {
  if (btn.classList.contains('routine-active')) {
    stopActiveSound();
    btn.classList.remove('routine-active');
    btn.innerHTML = '<i class="fa-solid fa-play"></i> Bắt đầu';
    isAudioSessionActive = false;
  } else {
    const selectedSound = document.querySelector('.routine-sound-option.active')?.dataset.routineSound || 'rain';
    if (isSoundLocked(selectedSound)) {
      alert('Âm thanh này được mở khóa trong bản Premium.');
      return;
    }
    playSound(selectedSound, 45);
    isAudioSessionActive = true;
    btn.classList.add('routine-active');
    btn.innerHTML = '<i class="fa-solid fa-stop"></i> Dừng';
  }
}

window.activateRoutine = activateRoutine;

export function selectRoutineSound(button) {
  const soundKey = button.dataset.routineSound;
  if (isSoundLocked(soundKey)) {
    alert('Âm thanh này được mở khóa trong bản Premium.');
    return;
  }
  document.querySelectorAll('.routine-sound-option').forEach(opt => opt.classList.remove('active'));
  button.classList.add('active');
  document.querySelectorAll('.routine-selected-sound').forEach(el => el.textContent = button.querySelector('span').textContent);
}

window.selectRoutineSound = selectRoutineSound;

export async function editTime(btn) {
  const timeDiv = btn.parentElement.querySelector('.routine-time');
  const newTime = await showAppPrompt('Nhập thời gian (HH:MM)', timeDiv.textContent);
  if (newTime) timeDiv.textContent = newTime;
}

window.editTime = editTime;

export function initSoundGrid() {
  const soundItems = document.querySelectorAll('.sound-item');
  const visualizer = document.getElementById('audio-visualizer');
  const soundNameSpan = document.getElementById('playing-sound-name');
  const soundFreqSpan = document.getElementById('playing-sound-freq');
  applySoundAccessUi();

  soundItems.forEach(item => {
    item.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      const soundKey = item.dataset.sound;
      if (isSoundLocked(soundKey)) {
        alert('Âm thanh này được mở khóa trong bản Premium.');
        return;
      }

      if (!isActive) {
        soundItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        if (visualizer) {
          visualizer.style.display = 'flex';
          soundNameSpan.textContent = item.querySelector('span').textContent;
          soundFreqSpan.textContent = item.getAttribute('data-freq') || 'Audio thư giãn';
        }

        playSound(soundKey);
        isAudioSessionActive = false; // Nghe thử từ grid thì không phải session
        debounceUpdateSettings({ activeSound: soundKey });
      } else {
        item.classList.remove('active');
        if (visualizer) visualizer.style.display = 'none';
        stopActiveSound();
        debounceUpdateSettings({ activeSound: null });
      }
    });
  });
}
