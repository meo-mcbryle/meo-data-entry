const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  safeEncrypt: (plainText) => ipcRenderer.invoke('safe-encrypt', plainText),
  safeDecrypt: (encryptedBase64) => ipcRenderer.invoke('safe-decrypt', encryptedBase64),
  updateUnsavedStatus: (hasUnsavedChanges) => ipcRenderer.send('update-unsaved-status', hasUnsavedChanges),
  onAttemptClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('attempt-close', listener);
    return () => ipcRenderer.removeListener('attempt-close', listener);
  },
  confirmClose: () => ipcRenderer.send('confirm-close'),
  onUpdateStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener('update-status', listener);
  },
});
