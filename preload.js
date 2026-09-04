const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getMemoryStats: () => ipcRenderer.invoke('get-memory-stats'),
  optimizeMemory: () => ipcRenderer.invoke('optimize-memory'),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
  setAutoStart: (enable) => ipcRenderer.invoke('set-auto-start', enable),
  quitApp: () => ipcRenderer.invoke('quit-app'),
});
