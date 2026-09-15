// scripts/collect_memory.js — cross-platform (Windows + Linux + macOS)
const os = require('os');
const { exec } = require('child_process');
const fs = require('fs');

let cachedProcs = [];
let lastFetch = 0;
let fetching = false;

function fetchProcessesWindows() {
  const cmd = `powershell -NoProfile -Command "[System.Diagnostics.Process]::GetProcesses() | Where-Object { $_.WorkingSet64 -gt 25MB } | Sort-Object WorkingSet64 -Descending | Select-Object -First 5 | ForEach-Object { [PSCustomObject]@{ name = $_.ProcessName; pid = $_.Id; workingSetMB = [math]::Round($_.WorkingSet64 / 1MB, 1) } } | ConvertTo-Json"`;
  exec(cmd, { windowsHide: true }, (err, stdout) => {
    fetching = false;
    if (err || !stdout) return;
    try {
      const parsed = JSON.parse(stdout.trim());
      cachedProcs = Array.isArray(parsed) ? parsed : [parsed];
      lastFetch = Date.now();
    } catch (e) {}
  });
}

function fetchProcessesUnix() {
  // ps: comm, pid, rss(KB) sorted desc — works on Linux and macOS
  exec('ps -eo comm=,pid=,rss= --sort=-rss 2>/dev/null | head -n 6', (err, stdout) => {
    fetching = false;
    if (err || !stdout) return;
    try {
      const lines = stdout.trim().split('\n');
      const procs = [];
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 3) continue;
        const rssKB = parseFloat(parts[parts.length - 1]);
        const pid = parseInt(parts[parts.length - 2], 10);
        const name = parts.slice(0, parts.length - 2).join(' ').split('/').pop();
        if (!pid || isNaN(rssKB)) continue;
        const workingSetMB = Math.round((rssKB / 1024) * 10) / 10;
        if (workingSetMB < 25) continue; // match Windows 25MB threshold
        procs.push({ name: name.substring(0, 40), pid, workingSetMB });
        if (procs.length >= 5) break;
      }
      if (procs.length > 0) {
        cachedProcs = procs;
        lastFetch = Date.now();
      }
    } catch (e) {}
  });
}

function fetchProcesses() {
  if (fetching) return;
  fetching = true;
  if (process.platform === 'win32') fetchProcessesWindows();
  else fetchProcessesUnix();
}

// Pre-fetch
fetchProcesses();

function readMeminfo() {
  // Linux: richer numbers from /proc/meminfo (kB)
  try {
    if (process.platform !== 'linux') return null;
    const txt = fs.readFileSync('/proc/meminfo', 'utf8');
    const get = (k) => {
      const m = txt.match(new RegExp('^' + k + ':\\s+(\\d+)', 'm'));
      return m ? parseInt(m[1], 10) : 0;
    };
    return {
      memTotalKB: get('MemTotal'),
      memAvailableKB: get('MemAvailable'),
      cachedKB: get('Cached'),
      buffersKB: get('Buffers'),
      sReclaimableKB: get('SReclaimable'),
      swapTotalKB: get('SwapTotal'),
      swapFreeKB: get('SwapFree'),
    };
  } catch (e) {
    return null;
  }
}

async function collectMemory() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const percentUsed = Math.round((usedBytes / totalBytes) * 1000) / 10;

  const totalRamGB = Math.round((totalBytes / (1024 * 1024 * 1024)) * 100) / 100;
  const usedRamGB = Math.round((usedBytes / (1024 * 1024 * 1024)) * 100) / 100;
  const freeRamGB = Math.round((freeBytes / (1024 * 1024 * 1024)) * 100) / 100;

  let status = 'OPTIMAL';
  if (percentUsed >= 85) status = 'CRITICAL';
  else if (percentUsed >= 70) status = 'MODERATE';

  if (Date.now() - lastFetch > 6000) {
    fetchProcesses();
  }

  // Defaults (match original Windows estimates)
  let cachedGB = Math.round(freeRamGB * 0.25 * 100) / 100;
  let commitTotalGB = Math.round(totalRamGB * 1.8 * 100) / 100;
  let commitUsedGB = Math.round((usedRamGB + 2.4) * 100) / 100;

  // Linux: use real /proc/meminfo numbers
  const mi = readMeminfo();
  if (mi && mi.memTotalKB > 0) {
    const toGB = (kb) => Math.round((kb / 1024 / 1024) * 100) / 100;
    cachedGB = toGB(mi.cachedKB + mi.buffersKB + mi.sReclaimableKB);
    const swapTotalGB = toGB(mi.swapTotalKB);
    commitTotalGB = Math.round((totalRamGB + swapTotalGB) * 100) / 100;
    const swapUsedGB = toGB(mi.swapTotalKB - mi.swapFreeKB);
    commitUsedGB = Math.round((usedRamGB + swapUsedGB) * 100) / 100;
  }

  return {
    totalRamGB,
    usedRamGB,
    freeRamGB,
    percentUsed,
    cachedGB,
    commitTotalGB,
    commitUsedGB,
    status,
    topProcesses: cachedProcs,
    platform: process.platform,
    timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
  };
}

module.exports = { collectMemory };
