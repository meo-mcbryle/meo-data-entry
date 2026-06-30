const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { autoUpdater } = require('electron-updater');

let mainWindow;

// Register 'app' protocol scheme as privileged to support standard features (Cookies, Storage, Fetch)
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function createWindow() {
  const isDev = !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

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

  // Check for updates automatically in production packaged app
  if (app.isPackaged) {
    autoUpdater.logger = console;
    autoUpdater.checkForUpdatesAndNotify();
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
