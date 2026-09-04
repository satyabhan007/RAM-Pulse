const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getMemoryStats: () => ipcRenderer.invoke('get-memory-stats'),
  optimizeMemory: () => ipcRenderer.invoke('optimize-memory'),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
});
