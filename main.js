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

// Set a custom cache directory with guaranteed write permissions
const cacheDir = path.join(os.homedir(), 'AppData', 'Local', 'RAMPulseCache');
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
    return fs.existsSync(startupShortcutPath);
  } catch (e) {
    return false;
  }
}

function setAutoStart(enable) {
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
          const result = await runPowerShellScript('scripts/optimize_memory.ps1');
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

// IPC Handlers
ipcMain.handle('get-memory-stats', async () => {
  try {
    return await runPowerShellScript('scripts/get_memory.ps1');
  } catch (err) {
    return { error: 'Failed to fetch system memory telemetry.' };
  }
});

ipcMain.handle('optimize-memory', async () => {
  try {
    return await runPowerShellScript('scripts/optimize_memory.ps1');
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
