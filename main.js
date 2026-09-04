const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
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
let isAlwaysOnTop = false;

function createWindow() {
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Center window on screen initially or place on right side of desktop
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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
  app.quit();
});

ipcMain.handle('toggle-always-on-top', () => {
  if (mainWindow) {
    isAlwaysOnTop = !isAlwaysOnTop;
    mainWindow.setAlwaysOnTop(isAlwaysOnTop, 'floating');
    return isAlwaysOnTop;
  }
  return false;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
