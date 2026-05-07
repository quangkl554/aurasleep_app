import { apiFetch } from './api.js';

export function getTodayDateString() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function combineDateAndTime(dateString, timeString) {
  return new Date(`${dateString}T${timeString}:00`);
}

export function calculateSleepMetrics({ date, bedtime, wakeTime, fallAsleepMin }) {
  const bedDate = combineDateAndTime(date, bedtime);
  let wakeDate = combineDateAndTime(date, wakeTime);
  if (wakeDate <= bedDate) {
    wakeDate.setDate(wakeDate.getDate() + 1);
  }

  const inBedMin = Math.max(0, Math.round((wakeDate - bedDate) / 60000));
  const safeFallAsleepMin = Math.max(0, Number(fallAsleepMin) || 0);
  const totalSleepMin = Math.max(0, inBedMin - safeFallAsleepMin);
  const efficiency = inBedMin > 0 ? Math.max(0, Math.min(100, Math.round((totalSleepMin / inBedMin) * 100))) : 0;
  const durationScore = Math.max(0, 100 - Math.abs(totalSleepMin - 480) / 480 * 45);
  const latencyPenalty = Math.min(20, Math.max(0, safeFallAsleepMin - 15) * 0.6);
  const sleepScore = Math.max(0, Math.min(100, Math.round(durationScore * 0.65 + efficiency * 0.35 - latencyPenalty)));

  return {
    bedtime: bedDate.toISOString(),
    wakeTime: wakeDate.toISOString(),
    totalSleepMin,
    efficiency,
    sleepScore,
    fallAsleepMin: safeFallAsleepMin
  };
}

export function formatDateOnly(dateString) {
  if (!dateString) return '--';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
}

export function openSleepEntryModal() {
  const overlay = document.getElementById('sleep-entry-modal');
  const form = overlay?.querySelector('form');
  if (!overlay || !form) return;
  form.reset();
  form.elements.date.value = getTodayDateString();
  form.elements.bedtime.value = '22:30';
  form.elements.wakeTime.value = '06:30';
  form.elements.fallAsleepMin.value = '15';
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
}

export function closeSleepEntryModal() {
  const overlay = document.getElementById('sleep-entry-modal');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
}

window.openSleepEntryModal = openSleepEntryModal;
window.closeSleepEntryModal = closeSleepEntryModal;

export async function submitSleepEntry(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const date = form.elements.date.value;
  const bedtime = form.elements.bedtime.value;
  const wakeTime = form.elements.wakeTime.value;
  const fallAsleepMin = Number(form.elements.fallAsleepMin.value);
  const notes = form.elements.notes.value.trim();

  if (!date || !bedtime || !wakeTime) {
    alert('Vui lòng nhập đầy đủ ngày ngủ, giờ đi ngủ và giờ thức dậy.');
    return;
  }

  const metrics = calculateSleepMetrics({ date, bedtime, wakeTime, fallAsleepMin });
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = 'Đang lưu...';

  try {
    const res = await apiFetch('/api/sleep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, ...metrics, notes })
    });

    if (!res.ok) throw new Error('Không thể lưu dữ liệu');
    
    closeSleepEntryModal();
    await loadDashboardData();
    await loadSleepData('week');
    alert('Đã lưu dữ liệu giấc ngủ.');
  } catch (err) {
    alert(err.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
}

window.submitSleepEntry = submitSleepEntry;

export function formatSleepDuration(totalSleepMin = 0) {
  const safeMinutes = Math.max(0, Number(totalSleepMin) || 0);
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  return `${h}h ${m}m`;
}

export function getRhythmLabel(record) {
  if (!record) return 'Chưa có dữ liệu';
  if ((record.sleepScore || 0) >= 85 && (record.efficiency || 0) >= 85) return 'Ổn định';
  if ((record.sleepScore || 0) >= 70) return 'Cần theo dõi';
  return 'Cần cải thiện';
}

export function getDashboardSuggestion(record) {
  if (!record) return 'Hãy ghi nhận giấc ngủ đầu tiên để AuraBot phân tích.';
  if ((record.totalSleepMin || 0) < 420) return 'Thời gian ngủ còn thấp. Hãy đi ngủ sớm hơn tối nay.';
  return 'Giấc ngủ đang ở mức tốt. Hãy duy trì thói quen này.';
}

export async function loadDashboardData() {
  try {
    const res = await apiFetch('/api/sleep?range=week');
    const records = await res.json();
    const lastRecord = records[records.length - 1];

    const scoreValue = document.querySelector('#dashboard-screen .score-value');
    const statVals = document.querySelectorAll('#dashboard-screen .stat-val');
    const aiSuggestion = document.querySelector('#dashboard-screen .ai-card p');

    if (!lastRecord) return;

    if (scoreValue) scoreValue.textContent = lastRecord.sleepScore ?? '--';
    if (statVals.length >= 3) {
      statVals[0].textContent = formatSleepDuration(lastRecord.totalSleepMin);
      statVals[1].textContent = `${lastRecord.efficiency}%`;
      statVals[2].textContent = getRhythmLabel(lastRecord);
    }
    if (aiSuggestion) aiSuggestion.textContent = getDashboardSuggestion(lastRecord);
  } catch (err) { console.error(err); }
}

window.loadDashboardData = loadDashboardData;

export async function loadSleepData(range = 'week') {
  // Cập nhật UI cho các Tab
  const tabs = document.querySelectorAll('#analytics-tabs .auth-tab');
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === range);
  });

  try {
    const res = await apiFetch('/api/sleep?range=' + range);
    const data = await res.json();
    
    const bars = document.querySelectorAll('.chart-bar');
    const vals = document.querySelectorAll('.chart-value');
    const days = document.querySelectorAll('.chart-day');

    // Reset toàn bộ biểu đồ về trạng thái trống trước khi nạp dữ liệu thật
    bars.forEach(bar => bar.style.height = '0%');
    vals.forEach(val => val.textContent = '');

    if (!data || data.length === 0) return;

    // Lấy tối đa 7 bản ghi gần nhất để hiển thị lên biểu đồ 7 cột
    const displayData = data.slice(-7);
    
    displayData.forEach((record, index) => {
      if (bars[index]) {
        const hours = (record.totalSleepMin / 60);
        // Giả sử 9 tiếng là 100% chiều cao biểu đồ
        const heightPercent = Math.max(10, Math.min(100, (hours / 9) * 100));
        bars[index].style.height = heightPercent + '%';
        
        if (vals[index]) vals[index].textContent = hours.toFixed(1) + 'h';
        
        // Cập nhật nhãn ngày nếu có
        if (days[index] && record.date) {
          const d = new Date(record.date);
          days[index].textContent = d.getDate() + '/' + (d.getMonth() + 1);
        }
      }
    });
  } catch (err) { 
    console.error('Lỗi tải dữ liệu giấc ngủ:', err);
  }
}

window.loadSleepData = loadSleepData;

export function selectBar(element) {
  const containers = document.querySelectorAll('.chart-bar-container');
  containers.forEach(c => c.classList.remove('active'));
  element.classList.add('active');
}

window.selectBar = selectBar;
