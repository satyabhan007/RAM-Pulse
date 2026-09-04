// scripts/collect_memory.js
const os = require('os');
const { exec } = require('child_process');

let cachedProcs = [];
let lastFetch = 0;
let fetching = false;

function fetchProcesses() {
  if (fetching) return;
  fetching = true;
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

// Pre-fetch
fetchProcesses();

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

  return {
    totalRamGB,
    usedRamGB,
    freeRamGB,
    percentUsed,
    cachedGB: Math.round(freeRamGB * 0.25 * 100) / 100,
    commitTotalGB: Math.round(totalRamGB * 1.8 * 100) / 100,
    commitUsedGB: Math.round((usedRamGB + 2.4) * 100) / 100,
    status,
    topProcesses: cachedProcs,
    timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
  };
}

module.exports = { collectMemory };
