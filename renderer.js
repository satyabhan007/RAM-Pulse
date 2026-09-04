// Dual Bridge API (Electron + Edge App / HTTP Desktop Server)
const isElectron = typeof window.electronAPI !== 'undefined';

async function fetchMemoryStatsApi() {
  if (isElectron) {
    return await window.electronAPI.getMemoryStats();
  } else {
    const res = await fetch('/api/telemetry');
    return await res.json();
  }
}

async function runOptimizeMemoryApi() {
  if (isElectron) {
    return await window.electronAPI.optimizeMemory();
  } else {
    const res = await fetch('/api/optimize', { method: 'POST' });
    return await res.json();
  }
}

function minimizeWindowApi() {
  if (isElectron && window.electronAPI.minimizeWindow) {
    window.electronAPI.minimizeWindow();
  } else {
    window.blur();
  }
}

function closeWindowApi() {
  if (isElectron && window.electronAPI.closeWindow) {
    window.electronAPI.closeWindow();
  } else {
    window.close();
  }
}

// State Variables
let telemetryHistory = [];
const maxHistoryLength = 30; // 60s timeline
let totalFreedInSessionMB = 0;
let isOptimizing = false;
let isPinned = false;
let pollingTimer = null;

// DOM Elements
const ramPercentEl = document.getElementById('ramPercent');
const ramUsedTotalEl = document.getElementById('ramUsedTotal');
const gaugeArcEl = document.getElementById('gaugeArc');
const statusBadgeEl = document.getElementById('statusBadge');
const statusTextEl = document.getElementById('statusText');
const lastUpdatedEl = document.getElementById('lastUpdated');

const freeRamValueEl = document.getElementById('freeRamValue');
const freeRamBarEl = document.getElementById('freeRamBar');
const cachedRamValueEl = document.getElementById('cachedRamValue');
const commitValueEl = document.getElementById('commitValue');
const commitTotalLabelEl = document.getElementById('commitTotalLabel');
const sessionFreedValueEl = document.getElementById('sessionFreedValue');

const btnOptimize = document.getElementById('btnOptimize');
const optimizeBtnLabel = document.getElementById('optimizeBtnLabel');
const processListEl = document.getElementById('processList');
const autoBoostToggle = document.getElementById('autoBoostToggle');

const btnPin = document.getElementById('btnPin');
const btnMinimize = document.getElementById('btnMinimize');
const btnClose = document.getElementById('btnClose');
const themeToggle = document.getElementById('themeToggle');

const toastNotification = document.getElementById('toastNotification');
const toastTitle = document.getElementById('toastTitle');
const toastBody = document.getElementById('toastBody');

// Canvas Setup
const canvas = document.getElementById('telemetryChart');
const ctx = canvas ? canvas.getContext('2d') : null;

// Initialize Widget
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();

  // Initial fetch immediately
  fetchTelemetry();

  if (isElectron) {
    // In Electron mode, poll IPC on interval
    pollingTimer = setInterval(fetchTelemetry, 2000);
  } else {
    // In Web / Edge App mode, try WebSocket first, fallback to polling
    initWebSocket();
  }
});

function initWebSocket() {
  try {
    const ws = new WebSocket('ws://localhost:3888');
    let connected = false;

    ws.addEventListener('open', () => {
      connected = true;
      console.log('WebSocket connection established');
      if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
      }
    });

    ws.addEventListener('message', (event) => {
      try {
        const stats = JSON.parse(event.data);
        applyTelemetry(stats);
      } catch (e) {
        console.error('Failed to parse WebSocket message', e);
      }
    });

    ws.addEventListener('close', () => {
      console.warn('WebSocket connection closed, falling back to HTTP polling');
      if (!pollingTimer) {
        pollingTimer = setInterval(fetchTelemetry, 2000);
      }
    });

    ws.addEventListener('error', (err) => {
      console.warn('WebSocket error, falling back to HTTP polling', err);
      if (!pollingTimer) {
        pollingTimer = setInterval(fetchTelemetry, 2000);
      }
    });
  } catch (err) {
    console.warn('Failed to construct WebSocket, using polling', err);
    if (!pollingTimer) {
      pollingTimer = setInterval(fetchTelemetry, 2000);
    }
  }
}

function setupEventListeners() {
  if (btnOptimize) btnOptimize.addEventListener('click', handleOptimize);
  if (btnMinimize) btnMinimize.addEventListener('click', minimizeWindowApi);
  if (btnClose) btnClose.addEventListener('click', closeWindowApi);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark');
    });
  }

  if (btnPin) {
    if (!isElectron) {
      btnPin.style.display = 'none';
    } else {
      btnPin.addEventListener('click', async () => {
        if (window.electronAPI && window.electronAPI.toggleAlwaysOnTop) {
          isPinned = await window.electronAPI.toggleAlwaysOnTop();
          if (isPinned) {
            btnPin.classList.add('active');
          } else {
            btnPin.classList.remove('active');
          }
        }
      });
    }
  }
}

// Fetch System Telemetry via API
async function fetchTelemetry() {
  try {
    const stats = await fetchMemoryStatsApi();
    applyTelemetry(stats);
  } catch (err) {
    console.error('Error fetching telemetry:', err);
  }
}

// Apply telemetry update to UI
function applyTelemetry(stats) {
  if (!stats || stats.error) {
    if (stats && stats.error) {
      console.warn('Telemetry error:', stats.error);
    }
    return;
  }

  updateGauge(stats.percentUsed, stats.usedRamGB, stats.totalRamGB);
  updateStatusBadge(stats.status, stats.percentUsed);
  updateMetrics(stats);
  updateChart(stats.percentUsed);
  updateProcessList(stats.topProcesses);

  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = `Updated ${stats.timestamp || new Date().toLocaleTimeString()}`;
  }

  // Auto-Boost Trigger Check
  if (autoBoostToggle && autoBoostToggle.checked && stats.percentUsed >= 85) {
    handleOptimize();
  }
}

// Update Gauge Display
function updateGauge(percent, usedGB, totalGB) {
  const safePercent = Number(percent) || 0;
  const safeUsed = Number(usedGB) || 0;
  const safeTotal = Number(totalGB) || 0;

  if (ramPercentEl) ramPercentEl.textContent = `${safePercent.toFixed(1)}%`;
  if (ramUsedTotalEl) ramUsedTotalEl.textContent = `${safeUsed.toFixed(2)} / ${safeTotal.toFixed(2)} GB`;

  if (gaugeArcEl) {
    const circumference = 364.4;
    const offset = circumference - (safePercent / 100) * circumference;
    gaugeArcEl.style.strokeDashoffset = Math.max(0, offset);

    if (safePercent >= 85) {
      gaugeArcEl.style.stroke = 'url(#gaugeGradientWarning)';
    } else {
      gaugeArcEl.style.stroke = 'url(#gaugeGradient)';
    }
  }
}

// Update Status Badge
function updateStatusBadge(status, percent) {
  if (!statusBadgeEl || !statusTextEl) return;
  statusBadgeEl.className = 'status-badge';

  const safePercent = Number(percent) || 0;
  if (safePercent >= 85 || status === 'CRITICAL') {
    statusBadgeEl.classList.add('critical');
    statusTextEl.textContent = 'CRITICAL LOAD';
  } else if (safePercent >= 70 || status === 'MODERATE') {
    statusBadgeEl.classList.add('moderate');
    statusTextEl.textContent = 'MODERATE PRESSURE';
  } else {
    statusTextEl.textContent = 'OPTIMAL PERFORMANCE';
  }
}

// Update Metric Cards
function updateMetrics(stats) {
  const freeGB = Number(stats.freeRamGB) || 0;
  const totalGB = Number(stats.totalRamGB) || 1;
  const cachedGB = Number(stats.cachedGB) || 0;
  const commitUsedGB = Number(stats.commitUsedGB) || 0;
  const commitTotalGB = Number(stats.commitTotalGB) || 0;

  if (freeRamValueEl) freeRamValueEl.textContent = `${freeGB.toFixed(2)} GB`;
  if (freeRamBarEl) {
    const freePct = (freeGB / totalGB) * 100;
    freeRamBarEl.style.width = `${Math.min(freePct, 100)}%`;
  }
  if (cachedRamValueEl) cachedRamValueEl.textContent = `${cachedGB.toFixed(2)} GB`;
  if (commitValueEl) commitValueEl.textContent = `${commitUsedGB.toFixed(2)} GB`;
  if (commitTotalLabelEl) commitTotalLabelEl.textContent = `Limit: ${commitTotalGB.toFixed(1)} GB`;
}

// Update Real-Time Chart
function updateChart(percent) {
  if (!ctx || !canvas) return;

  const safePercent = Number(percent) || 0;
  telemetryHistory.push(safePercent);
  if (telemetryHistory.length > maxHistoryLength) {
    telemetryHistory.shift();
  }

  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  if (telemetryHistory.length < 2) return;

  // Draw Gradient Fill
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(0, 242, 254, 0.35)');
  gradient.addColorStop(1, 'rgba(0, 242, 254, 0.0)');

  ctx.beginPath();
  const step = width / (maxHistoryLength - 1);

  ctx.moveTo(0, height);
  for (let i = 0; i < telemetryHistory.length; i++) {
    const x = i * step;
    const y = height - (telemetryHistory[i] / 100) * height;
    if (i === 0) {
      ctx.lineTo(x, y);
    } else {
      const prevX = (i - 1) * step;
      const prevY = height - (telemetryHistory[i - 1] / 100) * height;
      const cpX = (prevX + x) / 2;
      ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
    }
  }

  ctx.lineTo((telemetryHistory.length - 1) * step, height);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw Spline Line
  ctx.beginPath();
  for (let i = 0; i < telemetryHistory.length; i++) {
    const x = i * step;
    const y = height - (telemetryHistory[i] / 100) * height;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      const prevX = (i - 1) * step;
      const prevY = height - (telemetryHistory[i - 1] / 100) * height;
      const cpX = (prevX + x) / 2;
      ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
    }
  }

  ctx.strokeStyle = '#00f2fe';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Draw Glowing Endpoint Dot
  const lastIndex = telemetryHistory.length - 1;
  const lastX = lastIndex * step;
  const lastY = height - (telemetryHistory[lastIndex] / 100) * height;

  ctx.beginPath();
  ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#00f2fe';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
}

// Update Top Processes List
function updateProcessList(processes) {
  if (!processListEl) return;
  if (!processes || processes.length === 0) {
    processListEl.innerHTML = '<div class="process-placeholder">No process telemetry</div>';
    return;
  }

  let html = '';
  processes.forEach((proc) => {
    const memMB = Number(proc.workingSetMB) || 0;
    html += `
      <div class="process-item">
        <div class="process-info">
          <span class="process-name" title="${proc.name}">${proc.name}</span>
          <span class="process-pid">PID ${proc.pid}</span>
        </div>
        <span class="process-ram">${memMB.toFixed(1)} MB</span>
      </div>
    `;
  });

  processListEl.innerHTML = html;
}

// Handle 1-Click Memory Optimization
async function handleOptimize() {
  if (isOptimizing) return;
  isOptimizing = true;

  if (btnOptimize) btnOptimize.classList.add('loading');
  if (optimizeBtnLabel) optimizeBtnLabel.textContent = 'OPTIMIZING...';

  try {
    const result = await runOptimizeMemoryApi();

    if (result && !result.error) {
      const freedMB = result.freedMB || 0;
      totalFreedInSessionMB += freedMB;

      const freedGBStr = (totalFreedInSessionMB / 1024).toFixed(2);
      if (sessionFreedValueEl) sessionFreedValueEl.textContent = `${freedGBStr} GB`;

      showToast(
        'Memory Optimized!',
        `Trimmed ${result.processesTrimmed || 0} processes & freed ${freedMB} MB RAM.`
      );
    } else {
      showToast('Optimization Warning', 'Could not trim process memory.');
    }
  } catch (err) {
    console.error('Optimization error:', err);
    showToast('Error', 'Failed to run memory boost.');
  } finally {
    if (btnOptimize) btnOptimize.classList.remove('loading');
    if (optimizeBtnLabel) optimizeBtnLabel.textContent = 'BOOST MEMORY';
    isOptimizing = false;

    // Refresh telemetry immediately
    setTimeout(fetchTelemetry, 300);
  }
}

// Show Toast Notification
function showToast(title, body) {
  if (!toastNotification || !toastTitle || !toastBody) return;
  toastTitle.textContent = title;
  toastBody.textContent = body;
  toastNotification.classList.remove('hidden');

  setTimeout(() => {
    toastNotification.classList.add('hidden');
  }, 4000);
}
