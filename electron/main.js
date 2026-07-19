const { app, BrowserWindow, protocol, net, ipcMain, safeStorage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const preloadPath = path.join(__dirname, 'preload.js');
const { autoUpdater } = require('electron-updater');

let mainWindow;

// Register 'app' protocol scheme as privileged to support standard features (Cookies, Storage, Fetch)
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes || null,
      releaseDate: info.releaseDate || null,
    });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-status', { status: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-status', {
      status: 'downloading',
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-status', {
      status: 'downloaded',
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-status', {
      status: 'error',
      message: err?.message || 'An unknown error occurred.',
    });
  });
}

function createWindow() {
  const isDev = !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: preloadPath
    }
  });

  // Hide the default electron menu bar for a clean dashboard look
  mainWindow.removeMenu();

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in dev mode
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('app://local/index.html');
  }

  mainWindow.on('close', (event) => {
    if (hasUnsavedChanges) {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: ['Yes, Exit', 'No, Keep Working'],
        title: 'Confirm Exit',
        message: 'You have unsaved changes. Are you sure you want to close the app?',
        defaultId: 1,
        cancelId: 1
      });
      if (choice === 1) {
        event.preventDefault();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let hasUnsavedChanges = false;
ipcMain.on('update-unsaved-status', (event, value) => {
  hasUnsavedChanges = value;
});

// IPC: expose app version to renderer
ipcMain.handle('get-app-version', () => app.getVersion());

// IPC: get system info (OS username and OS platform details)
ipcMain.handle('get-system-info', () => {
  try {
    return {
      osUsername: os.userInfo().username,
      osPlatform: os.platform(),
      osType: os.type()
    };
  } catch (e) {
    return {
      osUsername: 'Unknown',
      osPlatform: os.platform() || 'Unknown',
      osType: os.type() || 'Unknown'
    };
  }
});

// IPC: check for updates manually
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { status: 'dev-mode' };
  }
  try {
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (err) {
    return { success: false, message: err?.message };
  }
});

// IPC: start downloading the update
ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    return { success: false, message: err?.message };
  }
});

// IPC: quit and install the downloaded update
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

// IPC: safeStorage encryption/decryption
ipcMain.handle('safe-encrypt', (event, plainText) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this platform.');
  }
  const encryptedBuffer = safeStorage.encryptString(plainText);
  return encryptedBuffer.toString('base64');
});

ipcMain.handle('safe-decrypt', (event, encryptedBase64) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this platform.');
  }
  const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
  return safeStorage.decryptString(encryptedBuffer);
});


app.whenReady().then(() => {
  // Intercept 'app' protocol to serve Next.js static files under a constant origin
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    // Clean path and extract route location
    let reqPath = url.pathname;
    
    // On Windows, resolve double slashes that might lead to bad path joins
    if (reqPath.startsWith('//')) {
      reqPath = reqPath.slice(2);
    }
    
    let filePath = path.join(__dirname, '../out', decodeURIComponent(reqPath));

    // Handle directories (serve index.html)
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    // Next.js Route resolution (check for path.html fallbacks)
    if (!fs.existsSync(filePath)) {
      if (fs.existsSync(filePath + '.html')) {
        filePath = filePath + '.html';
      } else {
        filePath = path.join(__dirname, '../out/index.html');
      }
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  // Set up auto-updater event listeners
  setupAutoUpdater();

  // Check for updates automatically in production packaged app
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
