import { apiFetch } from './api.js';

const sleepDataCache = new Map();
const SLEEP_CACHE_TTL_MS = 30000;
let sleepProfile = {
  targetSleepMin: 480,
  preferredBedtime: '22:30',
  preferredWakeTime: '06:30',
  chronotype: 'balanced',
  caffeineCutoff: '14:00',
  screenCutoffMin: 60,
  relaxReminderMin: 30
};
let TARGET_SLEEP_MIN = sleepProfile.targetSleepMin;
let GOOD_SLEEP_MIN = Math.max(300, sleepProfile.targetSleepMin - 60);
const GOOD_LATENCY_MIN = 20;
const factorLabels = {
  stress: 'Stress',
  caffeine: 'Caffeine',
  exercise: 'Tập thể dục',
  screen: 'Màn hình khuya',
  nap: 'Ngủ trưa',
  alcohol: 'Rượu bia',
  lateMeal: 'Ăn muộn',
  meditation: 'Thiền'
};

export async function loadSleepProfile() {
  try {
    const res = await apiFetch('/api/auth/profile');
    if (!res.ok) return sleepProfile;
    const profile = await res.json();
    sleepProfile = { ...sleepProfile, ...profile };
    TARGET_SLEEP_MIN = Number(sleepProfile.targetSleepMin) || 480;
    GOOD_SLEEP_MIN = Math.max(300, TARGET_SLEEP_MIN - 60);
    updateSleepProfileUi();
  } catch (err) {
    console.warn('Không thể tải hồ sơ giấc ngủ:', err.message);
  }
  return sleepProfile;
}

export async function saveSleepProfile(event) {
  event?.preventDefault();
  const form = document.getElementById('sleep-profile-form');
  if (!form) return;

  const payload = {
    targetSleepMin: Number(form.elements.targetSleepMin.value),
    preferredBedtime: form.elements.preferredBedtime.value,
    preferredWakeTime: form.elements.preferredWakeTime.value,
    chronotype: form.elements.chronotype.value,
    caffeineCutoff: form.elements.caffeineCutoff.value,
    screenCutoffMin: Number(form.elements.screenCutoffMin.value),
    relaxReminderMin: Number(form.elements.relaxReminderMin.value)
  };

  const submitButton = form.querySelector('button[type="submit"]');
  const originalText = submitButton?.textContent;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Đang lưu...';
  }

  try {
    const res = await apiFetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Không thể lưu hồ sơ giấc ngủ');
    sleepProfile = { ...sleepProfile, ...(await res.json()) };
    TARGET_SLEEP_MIN = Number(sleepProfile.targetSleepMin) || 480;
    GOOD_SLEEP_MIN = Math.max(300, TARGET_SLEEP_MIN - 60);
    updateSleepProfileUi();
    sleepDataCache.clear();
    await loadDashboardData();
    await loadSleepData(document.querySelector('#analytics-tabs .auth-tab.active')?.dataset.tab || 'week');
    closeSleepProfileModal();
    alert('Đã lưu hồ sơ giấc ngủ.');
  } catch (err) {
    alert(err.message);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }
}

export function openSleepProfileModal() {
  updateSleepProfileUi();
  const overlay = document.getElementById('sleep-profile-modal');
  if (!overlay) return;
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
}

export function closeSleepProfileModal() {
  const overlay = document.getElementById('sleep-profile-modal');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
}

function updateSleepProfileUi() {
  const form = document.getElementById('sleep-profile-form');
  if (form) {
    form.elements.targetSleepMin.value = sleepProfile.targetSleepMin || 480;
    form.elements.preferredBedtime.value = sleepProfile.preferredBedtime || '22:30';
    form.elements.preferredWakeTime.value = sleepProfile.preferredWakeTime || '06:30';
    form.elements.chronotype.value = sleepProfile.chronotype || 'balanced';
    form.elements.caffeineCutoff.value = sleepProfile.caffeineCutoff || '14:00';
    form.elements.screenCutoffMin.value = sleepProfile.screenCutoffMin ?? 60;
    form.elements.relaxReminderMin.value = sleepProfile.relaxReminderMin ?? 30;
  }

  setText('#profile-target-sleep', formatSleepDuration(TARGET_SLEEP_MIN));
  setText('#profile-bedtime', sleepProfile.preferredBedtime || '22:30');
  setText('#profile-wake-time', sleepProfile.preferredWakeTime || '06:30');
}

window.saveSleepProfile = saveSleepProfile;
window.openSleepProfileModal = openSleepProfileModal;
window.closeSleepProfileModal = closeSleepProfileModal;

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
  const durationScore = Math.max(0, 100 - Math.abs(totalSleepMin - TARGET_SLEEP_MIN) / TARGET_SLEEP_MIN * 45);
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
  form.elements.bedtime.value = sleepProfile.preferredBedtime || '22:30';
  form.elements.wakeTime.value = sleepProfile.preferredWakeTime || '06:30';
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
  const factors = Array.from(form.querySelectorAll('[name="factors"]:checked')).map(input => input.value);

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
      body: JSON.stringify({ date, ...metrics, factors, notes })
    });

    if (!res.ok) throw new Error('Không thể lưu dữ liệu');
    
    sleepDataCache.clear();
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

function average(records, field) {
  const valid = records
    .map(record => Number(record[field]))
    .filter(value => Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function formatPercentChange(current, previous) {
  if (!previous) return '--';
  const change = Math.round(((current - previous) / previous) * 100);
  if (!Number.isFinite(change)) return '--';
  return `${change > 0 ? '+' : ''}${change}%`;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setStatCard(id, title, value, meta, tone = null) {
  const valueEl = document.getElementById(id);
  const card = valueEl?.closest('.analytics-stat-card');
  const titleEl = card?.querySelector('.stat-title');
  const metaEl = document.getElementById(`${id}-meta`);
  if (titleEl) titleEl.textContent = title;
  if (valueEl) {
    valueEl.textContent = value;
    valueEl.style.color = tone || '';
  }
  if (metaEl) metaEl.textContent = meta;
}

function formatSignedDuration(minutes) {
  const abs = Math.abs(Math.round(minutes));
  const sign = minutes >= 0 ? '+' : '-';
  return `${sign}${formatSleepDuration(abs)}`;
}

function getLatencyMeta(minutes) {
  if (minutes <= GOOD_LATENCY_MIN) return 'Trong ngưỡng tốt';
  if (minutes <= 35) return 'Hơi lâu, nên thư giãn sớm hơn';
  return 'Cao, cần xem lại routine tối';
}

function getBedtimeMinute(record) {
  const date = toDate(record.bedtime);
  if (!date) return null;
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes < 720 ? minutes + 1440 : minutes;
}

function standardDeviation(values) {
  if (values.length <= 1) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function getGoalStreak(records) {
  let streak = 0;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if ((Number(record.totalSleepMin) || 0) >= GOOD_SLEEP_MIN) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

function updateInsightPanel(records) {
  const totalSleep = records.reduce((sum, record) => sum + (Number(record.totalSleepMin) || 0), 0);
  const sleepDebt = Math.max(0, TARGET_SLEEP_MIN * records.length - totalSleep);
  const surplus = Math.max(0, totalSleep - TARGET_SLEEP_MIN * records.length);
  const bedtimeValues = records.map(getBedtimeMinute).filter(value => Number.isFinite(value));
  const bedtimeStd = Math.round(standardDeviation(bedtimeValues));
  const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - (bedtimeStd / 90) * 100)));
  const streak = getGoalStreak(records);

  setText('#insight-sleep-debt', sleepDebt > 0 ? formatSleepDuration(sleepDebt) : `+${formatSleepDuration(surplus)}`);
  setText(
    '#insight-sleep-debt-copy',
    sleepDebt > 0
      ? `Cần bù dần, không nên ngủ bù quá mạnh một đêm.`
      : 'Đang đạt hoặc vượt mục tiêu ngủ trong kỳ.'
  );
  setText('#insight-consistency', `${consistencyScore}/100`);
  setText(
    '#insight-consistency-copy',
    bedtimeStd <= 30
      ? 'Giờ đi ngủ khá đều, tốt cho nhịp sinh học.'
      : `Giờ đi ngủ lệch khoảng ${bedtimeStd} phút, nên cố định hơn.`
  );
  setText('#insight-streak', `${streak} ngày`);
  setText(
    '#insight-streak-copy',
    streak >= 3 ? 'Đang tạo được nhịp ngủ ổn định.' : 'Cần thêm vài ngày đạt mục tiêu liên tiếp.'
  );
}

function renderReportList(selector, items, emptyText) {
  const list = document.querySelector(selector);
  if (!list) return;
  list.innerHTML = '';

  if (!items || !items.length) {
    const item = document.createElement('li');
    item.textContent = emptyText;
    list.appendChild(item);
    return;
  }

  items.forEach(text => {
    const item = document.createElement('li');
    item.textContent = text;
    list.appendChild(item);
  });
}

function renderPremiumLockedReport() {
  const panel = document.getElementById('sleep-report-panel');
  if (!panel) return;
  panel.classList.add('active', 'premium-locked');
  setText('#report-record-count', '--');
}

async function loadSleepReport(range, selectedDate) {
  const panel = document.getElementById('sleep-report-panel');
  if (!panel) return;
  panel.classList.remove('premium-locked');

  if (!window.hasPremiumAccess) {
    renderPremiumLockedReport();
    return;
  }

  try {
    const res = await apiFetch(`/api/sleep/report?range=${range === 'month' ? 'month' : 'week'}&date=${encodeURIComponent(selectedDate)}`);
    if (!res.ok) throw new Error('Không thể tải báo cáo');
    const report = await res.json();

    setText('#report-sleep-debt', formatSleepDuration(report.sleepDebt || 0));
    setText('#report-consistency', `${report.consistencyScore || 0}/100`);
    setText('#report-goal-rate', `${report.goalRate || 0}%`);
    setText('#report-record-count', `${report.recordCount || 0} bản ghi`);
    setText('#report-best-night', report.bestNight?.date ? `${formatDateOnly(report.bestNight.date)} · ${report.bestNight.sleepScore}/100` : '--');
    setText('#report-worst-night', report.worstNight?.date ? `${formatDateOnly(report.worstNight.date)} · ${report.worstNight.sleepScore}/100` : '--');

    const factorTexts = (report.factorInsights || []).slice(0, 3).map(item => {
      const label = factorLabels[item.factor] || item.factor;
      const sign = item.impact > 0 ? '+' : '';
      return `${label}: ${sign}${item.impact} điểm, xuất hiện ${item.count} lần`;
    });
    renderReportList('#report-factor-list', factorTexts, 'Chưa đủ dữ liệu yếu tố ảnh hưởng.');
    renderReportList('#report-recommendations', report.recommendations, 'Duy trì lịch ngủ hiện tại và ghi thêm dữ liệu.');
    panel.classList.add('active');
  } catch (err) {
    console.warn(err.message);
    panel.classList.remove('active');
  }
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDate(dateString) {
  const date = toDate(dateString);
  if (!date) return '--';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMinutesShort(minutes) {
  if (minutes >= 60) return formatSleepDuration(Math.round(minutes));
  return `${Math.round(minutes)}p`;
}

function buildTodayChart(records) {
  const record = records[records.length - 1];
  if (!record) return [];
  const totalSleepMin = Number(record.totalSleepMin) || 0;
  const efficiency = Number(record.efficiency) || 0;
  const latency = Number(record.fallAsleepMin) || 0;
  const score = Number(record.sleepScore) || 0;

  return [
    {
      label: 'Ngủ',
      valueText: formatSleepDuration(totalSleepMin),
      height: Math.max(14, Math.min(100, (totalSleepMin / 540) * 100))
    },
    {
      label: 'Hiệu suất',
      valueText: `${efficiency}%`,
      height: Math.max(14, Math.min(100, efficiency))
    },
    {
      label: 'Chìm',
      valueText: `${latency}p`,
      height: Math.max(14, Math.min(100, 100 - (latency / 45) * 75))
    },
    {
      label: 'Điểm',
      valueText: `${score}/100`,
      height: Math.max(14, Math.min(100, score))
    }
  ];
}

function buildWeekChart(records) {
  const displayData = records.slice(-7);
  const maxMinutes = Math.max(540, ...displayData.map(record => Number(record.totalSleepMin) || 0));
  return displayData.map(record => {
    const minutes = Number(record.totalSleepMin) || 0;
    return {
      label: formatShortDate(record.date),
      valueText: formatMinutesShort(minutes),
      height: Math.max(12, Math.min(100, (minutes / maxMinutes) * 100))
    };
  });
}

function buildMonthChart(records) {
  const displayData = records.slice(-28);
  const bucketCount = Math.min(4, Math.max(1, Math.ceil(displayData.length / 7)));
  const buckets = Array.from({ length: bucketCount }, () => []);
  displayData.forEach((record, index) => {
    const bucketIndex = Math.min(bucketCount - 1, Math.floor(index / Math.ceil(displayData.length / bucketCount)));
    buckets[bucketIndex].push(record);
  });
  const bucketAverages = buckets.map(bucket => Math.round(average(bucket, 'totalSleepMin')));
  const maxMinutes = Math.max(540, ...bucketAverages);

  return buckets.map((bucket, index) => {
    const avgMinutes = bucketAverages[index] || 0;
    const first = bucket[0]?.date ? formatShortDate(bucket[0].date) : '';
    const last = bucket[bucket.length - 1]?.date ? formatShortDate(bucket[bucket.length - 1].date) : '';
    return {
      label: `T${index + 1}`,
      valueText: formatMinutesShort(avgMinutes),
      height: Math.max(12, Math.min(100, (avgMinutes / maxMinutes) * 100)),
      title: first && last ? `${first}-${last}` : `Tuần ${index + 1}`
    };
  });
}

function getRangeCopy(range, recordCount) {
  if (range === 'today') {
    return {
      title: 'Tổng quan theo ngày',
      label: 'Ngày đã chọn',
      empty: 'Chưa có dữ liệu cho ngày đã chọn. Hãy ghi nhận giấc ngủ hoặc chọn ngày khác.',
      noDataTitle: 'Chưa có dữ liệu ngày này'
    };
  }
  if (range === 'month') {
    return {
      title: 'Xu hướng theo tuần',
      label: recordCount ? `${recordCount} bản ghi trong tháng` : '30 ngày gần nhất',
      empty: 'Chưa có đủ dữ liệu tháng. Hãy ghi nhận thêm để AuraSleep gom xu hướng theo tuần.',
      noDataTitle: 'Chưa có dữ liệu tháng'
    };
  }
  return {
    title: 'Thời lượng ngủ',
    label: '7 ngày gần nhất',
    empty: 'Chưa có dữ liệu. Hãy ghi nhận giấc ngủ để xem biểu đồ.',
    noDataTitle: 'Chưa có dữ liệu'
  };
}

function getAnalyticsDate() {
  const input = document.getElementById('analytics-date-input');
  if (!input) return getTodayDateString();
  if (!input.value) input.value = getTodayDateString();
  return input.value;
}

function setRing(selector, value, label) {
  const ring = document.querySelector(selector);
  if (!ring) return;
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  ring.style.setProperty('--ring-value', `${safeValue}%`);
  const labelEl = ring.querySelector('span');
  if (labelEl) labelEl.textContent = label;
}

function updateDayRings(record, isVisible) {
  const grid = document.getElementById('day-rings-grid');
  if (!grid) return;
  grid.classList.toggle('active', Boolean(isVisible && record));
  grid.setAttribute('aria-hidden', String(!(isVisible && record)));
  if (!isVisible || !record) return;

  const totalSleepMin = Number(record.totalSleepMin) || 0;
  const efficiency = Number(record.efficiency) || 0;
  const latency = Number(record.fallAsleepMin) || 0;
  const score = Number(record.sleepScore) || 0;
  const durationPercent = Math.max(0, Math.min(100, (totalSleepMin / TARGET_SLEEP_MIN) * 100));
  const latencyPercent = Math.max(0, Math.min(100, 100 - (latency / 45) * 75));

  setRing('[data-ring="duration"]', durationPercent, formatSleepDuration(totalSleepMin));
  setRing('[data-ring="efficiency"]', efficiency, `${efficiency}%`);
  setRing('[data-ring="latency"]', latencyPercent, `${latency}p`);
  setRing('[data-ring="score"]', score, `${score}`);
}

export function getRhythmLabel(record) {
  if (!record) return 'Chưa có dữ liệu';
  if ((record.sleepScore || 0) >= 85 && (record.efficiency || 0) >= 85) return 'Ổn định';
  if ((record.sleepScore || 0) >= 70) return 'Cần theo dõi';
  return 'Cần cải thiện';
}

export function getDashboardSuggestion(record) {
  if (!record) return 'Hãy ghi nhận giấc ngủ đầu tiên để AuraBot phân tích.';
  if ((record.totalSleepMin || 0) < GOOD_SLEEP_MIN) return 'Thời gian ngủ còn thấp. Hãy đi ngủ sớm hơn tối nay.';
  return 'Giấc ngủ đang ở mức tốt. Hãy duy trì thói quen này.';
}

export async function loadDashboardData() {
  try {
    const res = await apiFetch('/api/sleep?range=week');
    const records = await res.json();
    const lastRecord = records[records.length - 1];

    const scoreValue = document.querySelector('#dashboard-screen .score-value');
    const scoreCircle = document.querySelector('#dashboard-screen .score-circle');
    const statVals = document.querySelectorAll('#dashboard-screen .stat-val');
    const aiSuggestion = document.querySelector('#dashboard-screen .ai-card p');
    const entryTitle = document.getElementById('dashboard-entry-title');
    const entryCopy = document.getElementById('dashboard-entry-copy');

    if (!lastRecord) return;

    if (scoreValue) scoreValue.textContent = lastRecord.sleepScore ?? '--';
    if (scoreCircle) {
      const score = Math.max(0, Math.min(100, Number(lastRecord.sleepScore) || 0));
      scoreCircle.style.background = `conic-gradient(var(--accent-primary) ${score}%, var(--card-bg) 0)`;
    }
    if (statVals.length >= 3) {
      statVals[0].textContent = formatSleepDuration(lastRecord.totalSleepMin);
      statVals[1].textContent = `${lastRecord.efficiency}%`;
      statVals[2].textContent = getRhythmLabel(lastRecord);
    }
    if (aiSuggestion) aiSuggestion.textContent = getDashboardSuggestion(lastRecord);
    if (entryTitle) entryTitle.textContent = 'Cập nhật giấc ngủ';
    if (entryCopy) entryCopy.textContent = `Dữ liệu gần nhất: ${formatDateOnly(lastRecord.date)}. Bạn có thể cập nhật để phân tích chính xác hơn.`;
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
    const selectedDate = getAnalyticsDate();
    const cacheKey = `${range}:${selectedDate}`;
    const cached = sleepDataCache.get(cacheKey);
    let data;
    if (cached && Date.now() - cached.timestamp < SLEEP_CACHE_TTL_MS) {
      data = cached.data;
    } else {
      const res = await apiFetch(`/api/sleep?range=${range}&date=${encodeURIComponent(selectedDate)}`);
      data = await res.json();
      sleepDataCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    
    const bars = document.querySelectorAll('#sleep-chart .chart-bar');
    const vals = document.querySelectorAll('#sleep-chart .chart-value');
    const containers = document.querySelectorAll('#sleep-chart .chart-bar-container');
    const emptyState = document.getElementById('chart-empty-state');
    const rangeLabel = document.getElementById('chart-range-label');
    const chartTitle = document.querySelector('#sleep-chart .chart-header h3');
    const rangeCopy = getRangeCopy(range, data?.length || 0);
    if (rangeLabel) rangeLabel.textContent = rangeCopy.label;
    if (chartTitle) chartTitle.textContent = rangeCopy.title;
    updateDayRings(null, false);

    bars.forEach(bar => {
      bar.style.height = '10%';
      bar.style.background = 'var(--border)';
      bar.style.boxShadow = 'none';
    });
    vals.forEach(val => {
      val.textContent = '';
      val.style.color = 'var(--text-secondary)';
      val.style.fontWeight = '600';
    });
    containers.forEach(container => {
      container.classList.remove('active');
      container.style.visibility = 'visible';
      const dayLabel = container.querySelector('.chart-label');
      if (dayLabel) dayLabel.textContent = '--';
      container.removeAttribute('title');
    });

    if (!data || data.length === 0) {
      emptyState?.classList.add('visible');
      if (emptyState) emptyState.textContent = rangeCopy.empty;
      setStatCard('analytics-avg', 'Thời lượng', '--', 'Chưa có bản ghi');
      setStatCard('analytics-change', 'Mục tiêu', '--', 'Cần dữ liệu để so sánh');
      setStatCard('analytics-latency', 'Chìm giấc', '--', 'Chưa có dữ liệu');
      setStatCard('analytics-quality', 'Chất lượng', '--', 'Chưa có dữ liệu');
      setText('#insight-sleep-debt', '--');
      setText('#insight-sleep-debt-copy', `So với mục tiêu ${formatSleepDuration(TARGET_SLEEP_MIN)} mỗi đêm.`);
      setText('#insight-consistency', '--');
      setText('#insight-consistency-copy', 'Dựa trên độ lệch giờ đi ngủ.');
      setText('#insight-streak', '--');
      setText('#insight-streak-copy', `Số bản ghi liên tiếp đạt từ ${formatSleepDuration(GOOD_SLEEP_MIN)}.`);
      setText('#analytics-screen .ai-card h4', rangeCopy.noDataTitle);
      setText('#analytics-screen .ai-card p', rangeCopy.empty);
      document.getElementById('sleep-report-panel')?.classList.remove('active');
      return;
    }

    emptyState?.classList.remove('visible');
    const dayRecord = data[data.length - 1];
    const chartData = range === 'today'
      ? buildTodayChart(data)
      : range === 'month'
        ? buildMonthChart(data)
        : buildWeekChart(data);

    containers.forEach((container, index) => {
      container.style.visibility = chartData[index] ? 'visible' : 'hidden';
    });

    chartData.forEach((item, index) => {
      if (!bars[index]) return;
      bars[index].style.height = item.height + '%';
      
      if (vals[index]) vals[index].textContent = item.valueText;
      
      const dayLabel = containers[index]?.querySelector('.chart-label');
      if (dayLabel) dayLabel.textContent = item.label;
      if (item.title && containers[index]) containers[index].setAttribute('title', item.title);
    });
    updateDayRings(dayRecord, range === 'today');

    const avgSleep = Math.round(average(data, 'totalSleepMin'));
    const avgLatency = Math.round(average(data, 'fallAsleepMin'));
    const avgQuality = Math.round(average(data, 'sleepScore'));
    const avgEfficiency = Math.round(average(data, 'efficiency'));
    const daysAtGoal = data.filter(record => (Number(record.totalSleepMin) || 0) >= GOOD_SLEEP_MIN).length;
    const goalRate = data.length ? Math.round((daysAtGoal / data.length) * 100) : 0;
    const latestSleep = Number(dayRecord.totalSleepMin) || 0;
    const latestLatency = Number(dayRecord.fallAsleepMin) || 0;
    const latestEfficiency = Number(dayRecord.efficiency) || 0;
    const latestScore = Number(dayRecord.sleepScore) || 0;
    const midpoint = Math.floor(data.length / 2);
    const previousRecords = data.slice(0, midpoint);
    const currentRecords = data.slice(midpoint);
    const currentAvg = average(currentRecords, 'totalSleepMin');
    const previousAvg = average(previousRecords, 'totalSleepMin');
    const changeText = data.length > 1 ? formatPercentChange(currentAvg, previousAvg) : '--';
    const changeEl = document.getElementById('analytics-change');

    if (range === 'today') {
      const delta = latestSleep - TARGET_SLEEP_MIN;
      setStatCard('analytics-avg', 'Ngủ thực tế', formatSleepDuration(latestSleep), `Mục tiêu ${formatSleepDuration(TARGET_SLEEP_MIN)} mỗi đêm`, 'var(--accent-primary)');
      setStatCard(
        'analytics-change',
        'So với mục tiêu',
        formatSignedDuration(delta),
        delta >= 0 ? 'Đã đạt mục tiêu hôm nay' : 'Thiếu ngủ so với mục tiêu',
        delta >= 0 ? '#10b981' : '#ef4444'
      );
      setStatCard('analytics-latency', 'Chìm giấc', `${latestLatency} phút`, getLatencyMeta(latestLatency));
      setStatCard('analytics-quality', 'Hiệu suất', `${latestEfficiency}%`, `Điểm ngủ ${latestScore}/100`);
    } else {
      setStatCard('analytics-avg', 'TB mỗi ngày', formatSleepDuration(avgSleep), `${data.length} bản ghi trong kỳ`, 'var(--accent-primary)');
      setStatCard('analytics-change', 'Đạt mục tiêu', `${goalRate}%`, `${daysAtGoal}/${data.length} ngày đạt mục tiêu`, goalRate >= 70 ? '#10b981' : '#ef4444');
      setStatCard('analytics-latency', 'Chìm giấc TB', `${avgLatency} phút`, getLatencyMeta(avgLatency));
      setStatCard('analytics-quality', 'Chất lượng TB', `${avgQuality}/100`, `Hiệu suất TB ${avgEfficiency}%`);
    }
    if (changeEl && range !== 'today') changeEl.style.color = goalRate >= 70 ? '#10b981' : '#ef4444';
    updateInsightPanel(data);
    await loadSleepReport(range, selectedDate);

    const trendTitle = avgQuality >= 85 ? 'Giấc ngủ đang ổn định' : 'Cần cải thiện nhẹ';
    const trendPrefix = range === 'today' ? 'Ngày đã chọn' : range === 'month' ? 'Tháng này' : 'Tuần này';
    const trendCopy = avgQuality >= 85
      ? `${trendPrefix}: trung bình ${formatSleepDuration(avgSleep)}, chất lượng ${avgQuality}/100. Hãy giữ khung giờ ngủ hiện tại.`
      : `${trendPrefix}: trung bình ${formatSleepDuration(avgSleep)}, chất lượng ${avgQuality}/100. Hãy thử giảm ánh sáng mạnh và bắt đầu routine sớm hơn.`;
    setText('#analytics-screen .ai-card h4', trendTitle);
    setText('#analytics-screen .ai-card p', trendCopy);

    const activeIndex = chartData.length - 1;
    if (containers[activeIndex]) selectBar(containers[activeIndex]);
  } catch (err) { 
    console.error('Lỗi tải dữ liệu giấc ngủ:', err);
  }
}

window.loadSleepData = loadSleepData;

export function selectBar(element) {
  const containers = document.querySelectorAll('#sleep-chart .chart-bar-container');
  containers.forEach(c => {
    c.classList.remove('active');
    const bar = c.querySelector('.chart-bar');
    const value = c.querySelector('.chart-value');
    if (bar) {
      bar.style.background = 'var(--border)';
      bar.style.boxShadow = 'none';
    }
    if (value) {
      value.style.color = 'var(--text-secondary)';
      value.style.fontWeight = '600';
    }
  });
  element.classList.add('active');
  const activeBar = element.querySelector('.chart-bar');
  const activeValue = element.querySelector('.chart-value');
  if (activeBar) {
    activeBar.style.background = 'var(--accent-primary)';
    activeBar.style.boxShadow = '0 0 14px rgba(244,162,97,0.55)';
  }
  if (activeValue) {
    activeValue.style.color = 'var(--accent-primary)';
    activeValue.style.fontWeight = '800';
  }
}

window.selectBar = selectBar;
