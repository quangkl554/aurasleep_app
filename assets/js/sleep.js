import { apiFetch } from './api.js';

const sleepDataCache = new Map();
const SLEEP_CACHE_TTL_MS = 30000;

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
  const durationPercent = Math.max(0, Math.min(100, (totalSleepMin / 480) * 100));
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
  if ((record.totalSleepMin || 0) < 420) return 'Thời gian ngủ còn thấp. Hãy đi ngủ sớm hơn tối nay.';
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
      setText('#analytics-avg', '--');
      setText('#analytics-change', '--');
      setText('#analytics-latency', '--');
      setText('#analytics-quality', '--');
      setText('#analytics-screen .ai-card h4', rangeCopy.noDataTitle);
      setText('#analytics-screen .ai-card p', rangeCopy.empty);
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
    const midpoint = Math.floor(data.length / 2);
    const previousRecords = data.slice(0, midpoint);
    const currentRecords = data.slice(midpoint);
    const currentAvg = average(currentRecords, 'totalSleepMin');
    const previousAvg = average(previousRecords, 'totalSleepMin');
    const changeText = data.length > 1 ? formatPercentChange(currentAvg, previousAvg) : '--';
    const changeEl = document.getElementById('analytics-change');

    setText('#analytics-avg', formatSleepDuration(avgSleep));
    setText('#analytics-change', changeText);
    setText('#analytics-latency', `${avgLatency} phút`);
    setText('#analytics-quality', `${avgQuality}/100`);
    if (changeEl) changeEl.style.color = changeText.startsWith('-') ? '#ef4444' : '#10b981';

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
