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
  } catch (e) { console.error(e); }
}

window.fetchDeviceData = fetchDeviceData;

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
    // Update UI
  } catch (e) { console.error(e); }
}

window.fetchRoutines = fetchRoutines;

export async function activateRoutine(btn) {
  if (btn.classList.contains('routine-active')) {
    stopActiveSound();
    btn.classList.remove('routine-active');
    btn.innerHTML = '<i class="fa-solid fa-play"></i> Bắt đầu';
    isAudioSessionActive = false;
  } else {
    playSound('rain', 45);
    isAudioSessionActive = true;
    btn.classList.add('routine-active');
    btn.innerHTML = '<i class="fa-solid fa-stop"></i> Dừng';
  }
}

window.activateRoutine = activateRoutine;

export function selectRoutineSound(button) {
  document.querySelectorAll('.routine-sound-option').forEach(opt => opt.classList.remove('active'));
  button.classList.add('active');
  const soundKey = button.dataset.routineSound;
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

  soundItems.forEach(item => {
    item.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      const soundKey = item.dataset.sound;

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
