import { apiFetch } from './api.js';
import { showAppPrompt } from './ui.js';

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
      // Update Sliders UI here if needed
      setActiveSoundUi(dev.activeSound);
    }
  } catch (e) { console.error(e); }
}

window.fetchDeviceData = fetchDeviceData;

export async function toggleSleepMode(btn) {
  const isSleep = btn.classList.contains('active-sleep');
  if (!isSleep) {
    btn.classList.add('active-sleep');
    btn.innerHTML = '<i class="fa-solid fa-moon"></i> Đang bật...';
    playSound('white', 30);
  } else {
    btn.classList.remove('active-sleep');
    btn.innerHTML = '<i class="fa-solid fa-power-off"></i> Kích hoạt';
    stopActiveSound();
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
  } else {
    playSound('rain', 45);
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
