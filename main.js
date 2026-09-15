const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

// Single Instance Lock: prevent duplicate widgets
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Disable GPU to avoid GPU cache creation errors on Windows
app.commandLine.appendSwitch('disable-gpu');

// Linux: sandbox needs privileges the dev container may not grant; running
// with --no-sandbox (or this switch) avoids the chrome-sandbox setuid error.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}

// Set a custom cache directory with guaranteed write permissions
// Windows: %LOCALAPPDATA%/RAMPulseCache | Linux: ~/.cache/rampulse
const cacheDir =
  process.platform === 'win32'
    ? path.join(os.homedir(), 'AppData', 'Local', 'RAMPulseCache')
    : path.join(os.homedir(), '.cache', 'rampulse');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}
app.whenReady().then(() => {
  app.setPath('cache', cacheDir);
});

let mainWindow = null;
let tray = null;
let isAlwaysOnTop = false;
let isQuitting = false;
let hasShownTrayNotice = false;

// Startup shortcut path
const startupDir = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const startupShortcutPath = path.join(startupDir, 'RAM Pulse Widget.lnk');

function isAutoStartEnabled() {
  try {
    if (process.platform === 'win32') {
      return fs.existsSync(startupShortcutPath);
    }
    // Linux: XDG autostart .desktop entry
    return fs.existsSync(
      path.join(os.homedir(), '.config', 'autostart', 'rampulse.desktop')
    );
  } catch (e) {
    return false;
  }
}

function setAutoStart(enable) {
  if (process.platform !== 'win32') {
    // Linux: create/remove ~/.config/autostart/rampulse.desktop
    try {
      const autostartDir = path.join(os.homedir(), '.config', 'autostart');
      const desktopFile = path.join(autostartDir, 'rampulse.desktop');
      if (enable) {
        fs.mkdirSync(autostartDir, { recursive: true });
        const electronBin = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron');
        const entry = `[Desktop Entry]\nType=Application\nName=RAM Pulse\nComment=Live Memory Telemetry Widget\nExec="${electronBin}" "${__dirname}"\nIcon=${path.join(__dirname, 'assets', 'icon.png')}\nTerminal=false\nCategories=System;Monitor;\nX-GNOME-Autostart-enabled=true\n`;
        fs.writeFileSync(desktopFile, entry);
      } else {
        if (fs.existsSync(desktopFile)) fs.unlinkSync(desktopFile);
      }
    } catch (e) {
      console.error('Failed to update Linux autostart:', e);
    }
    return;
  }
  const electronExe = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  const projectDir = __dirname;

  if (enable) {
    const psCmd = `
      $ws = New-Object -ComObject WScript.Shell;
      $s = $ws.CreateShortcut('${startupShortcutPath.replace(/'/g, "''")}');
      $s.TargetPath = '${electronExe.replace(/'/g, "''")}';
      $s.Arguments = '${projectDir.replace(/'/g, "''")}';
      $s.WorkingDirectory = '${projectDir.replace(/'/g, "''")}';
      $s.IconLocation = '${iconPath.replace(/'/g, "''")},0';
      $s.Description = 'RAM Pulse - Live Desktop Memory Widget & Optimizer';
      $s.Save();
    `;
    exec(`powershell -NoProfile -Command "${psCmd.replace(/\r?\n/g, ' ')}"`, { windowsHide: true });
  } else {
    try {
      if (fs.existsSync(startupShortcutPath)) {
        fs.unlinkSync(startupShortcutPath);
      }
    } catch (e) {
      console.error('Failed to remove startup shortcut:', e);
    }
  }
}

function createWindow() {
  const iconFile = path.join(__dirname, 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 380,
    height: 640,
    minWidth: 340,
    minHeight: 520,
    frame: false,
    transparent: true,
    hasShadow: true,
    alwaysOnTop: isAlwaysOnTop,
    resizable: true,
    icon: fs.existsSync(iconFile) ? iconFile : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Intercept window close to hide to tray instead of exiting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (tray && !hasShownTrayNotice) {
        tray.displayBalloon({
          title: 'RAM Pulse is still active',
          content: 'Widget minimized to system tray. Click the tray icon to reopen.',
        });
        hasShownTrayNotice = true;
      }
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;

  const isVisible = mainWindow && mainWindow.isVisible();
  const autoStart = isAutoStartEnabled();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isVisible ? 'Hide Widget' : 'Show Widget',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
        updateTrayMenu();
      },
    },
    {
      label: '⚡ Boost Memory Now',
      click: async () => {
        try {
          let result;
          if (process.platform === 'win32') {
            result = await runPowerShellScript('scripts/optimize_memory.ps1');
          } else {
            result = await optimizeMemoryLinux();
          }
          if (tray) {
            tray.displayBalloon({
              title: 'RAM Boosted!',
              content: `Freed ${result.freedMB || 0} MB across ${result.processesTrimmed || 0} processes.`,
            });
          }
        } catch (err) {
          console.error('Tray boost error:', err);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: isAlwaysOnTop,
      click: (item) => {
        isAlwaysOnTop = item.checked;
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(isAlwaysOnTop, 'floating');
        }
      },
    },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: autoStart,
      click: (item) => {
        setAutoStart(item.checked);
        setTimeout(updateTrayMenu, 500);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit RAM Pulse',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const trayIcon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(trayIcon);
  tray.setToolTip('RAM Pulse - Live Memory Optimizer');

  updateTrayMenu();

  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
    updateTrayMenu();
  });
}

let cachedTopProcesses = [];
let lastProcessFetchTime = 0;
let isFetchingProcesses = false;

function fetchTopProcessesThrottled() {
  if (isFetchingProcesses) return;
  isFetchingProcesses = true;
  if (process.platform === 'win32') {
    fetchTopProcessesWindows();
  } else {
    fetchTopProcessesUnix();
  }
}

function fetchTopProcessesUnix() {
  exec('ps -eo comm=,pid=,rss= --sort=-rss 2>/dev/null | head -n 6', (err, stdout) => {
    isFetchingProcesses = false;
    if (err || !stdout) return;
    try {
      const procs = [];
      for (const line of stdout.trim().split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 3) continue;
        const rssKB = parseFloat(parts[parts.length - 1]);
        const pid = parseInt(parts[parts.length - 2], 10);
        const name = parts.slice(0, parts.length - 2).join(' ').split('/').pop();
        if (!pid || isNaN(rssKB)) continue;
        const workingSetMB = Math.round((rssKB / 1024) * 10) / 10;
        if (workingSetMB < 25) continue;
        procs.push({ name: name.substring(0, 40), pid, workingSetMB });
        if (procs.length >= 5) break;
      }
      if (procs.length > 0) {
        cachedTopProcesses = procs;
        lastProcessFetchTime = Date.now();
      }
    } catch (e) {}
  });
}

function fetchTopProcessesWindows() {
  const cmd = `powershell -NoProfile -Command "[System.Diagnostics.Process]::GetProcesses() | Where-Object { $_.WorkingSet64 -gt 25MB } | Sort-Object WorkingSet64 -Descending | Select-Object -First 5 | ForEach-Object { [PSCustomObject]@{ name = $_.ProcessName; pid = $_.Id; workingSetMB = [math]::Round($_.WorkingSet64 / 1MB, 1) } } | ConvertTo-Json"`;
  exec(cmd, { windowsHide: true }, (err, stdout) => {
    isFetchingProcesses = false;
    if (err || !stdout) return;
    try {
      const parsed = JSON.parse(stdout.trim());
      const procs = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
      if (procs.length > 0) {
        cachedTopProcesses = procs;
        lastProcessFetchTime = Date.now();
      }
    } catch (e) {}
  });
}

// Initial populate of top processes
fetchTopProcessesThrottled();

// Shared Linux optimizer (sync + drop_caches, no process killing).
// Used by the tray menu and the optimize-memory IPC handler alike.
async function optimizeMemoryLinux() {
  const readAvailMB = () => {
    try {
      const t = fs.readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+)/m);
      return t ? parseInt(t[1], 10) / 1024 : 0;
    } catch (e) { return 0; }
  };
  const before = readAvailMB();
  await new Promise((res) => {
    exec(`sync; (echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || sudo -n sh -c 'echo 3 > /proc/sys/vm/drop_caches' 2>/dev/null); echo done`, () => res());
  });
  await new Promise((r) => setTimeout(r, 800));
  const after = readAvailMB();
  let freedMB = Math.round((after - before) * 10) / 10;
  if (!(freedMB > 0)) freedMB = 0;
  setTimeout(fetchTopProcessesThrottled, 300);
  return {
    freedMB,
    freedGB: Math.round((freedMB / 1024) * 100) / 100,
    processesTrimmed: 0,
    note: 'Linux boost: pagecache drop only, no processes touched.',
    timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
  };
}

// Execute PowerShell script helper
function runPowerShellScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, scriptPath);
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${fullPath}"`;
    exec(cmd, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing ${scriptPath}:`, error);
        return reject(error);
      }
      try {
        const data = JSON.parse(stdout.trim());
        resolve(data);
      } catch (parseError) {
        console.error(`JSON parse error for ${scriptPath}:`, stdout);
        reject(parseError);
      }
    });
  });
}

// IPC Handlers: Direct Node OS telemetry (Instant 0ms, Zero CPU overhead)
ipcMain.handle('get-memory-stats', async () => {
  try {
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

    // Refresh process rankings every 6 seconds without blocking the telemetry stream
    if (Date.now() - lastProcessFetchTime > 6000) {
      fetchTopProcessesThrottled();
    }

    // Linux: real cached/commit numbers from /proc/meminfo
    let cachedGB = Math.round(freeRamGB * 0.25 * 100) / 100;
    let commitTotalGB = Math.round(totalRamGB * 1.8 * 100) / 100;
    let commitUsedGB = Math.round((usedRamGB + 2.4) * 100) / 100;
    if (process.platform === 'linux') {
      try {
        const txt = fs.readFileSync('/proc/meminfo', 'utf8');
        const get = (k) => {
          const m = txt.match(new RegExp('^' + k + ':\\s+(\\d+)', 'm'));
          return m ? parseInt(m[1], 10) : 0;
        };
        const toGB = (kb) => Math.round((kb / 1024 / 1024) * 100) / 100;
        cachedGB = toGB(get('Cached') + get('Buffers') + get('SReclaimable'));
        commitTotalGB = Math.round((totalRamGB + toGB(get('SwapTotal'))) * 100) / 100;
        commitUsedGB = Math.round((usedRamGB + toGB(get('SwapTotal') - get('SwapFree'))) * 100) / 100;
      } catch (e) {}
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
      platform: process.platform,
      topProcesses: cachedTopProcesses,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    };
  } catch (err) {
    return { error: 'Failed to fetch system memory telemetry.' };
  }
});

ipcMain.handle('optimize-memory', async () => {
  try {
    if (process.platform !== 'win32') {
      return await optimizeMemoryLinux();
    }
    const result = await runPowerShellScript('scripts/optimize_memory.ps1');
    setTimeout(fetchTopProcessesThrottled, 300);
    return result;
  } catch (err) {
    return { error: 'Failed to execute memory optimization.' };
  }
});

ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.hide();
    updateTrayMenu();
  }
});

ipcMain.handle('toggle-always-on-top', () => {
  if (mainWindow) {
    isAlwaysOnTop = !isAlwaysOnTop;
    mainWindow.setAlwaysOnTop(isAlwaysOnTop, 'floating');
    updateTrayMenu();
    return isAlwaysOnTop;
  }
  return false;
});

ipcMain.handle('get-auto-start', () => {
  return isAutoStartEnabled();
});

ipcMain.handle('set-auto-start', (event, enable) => {
  setAutoStart(enable);
  updateTrayMenu();
  return isAutoStartEnabled();
});

ipcMain.handle('quit-app', () => {
  isQuitting = true;
  app.quit();
});

// Single instance handler
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    updateTrayMenu();
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // On Windows, keep running in background/tray unless explicitly quit
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  } else {
    createWindow();
  }
});
