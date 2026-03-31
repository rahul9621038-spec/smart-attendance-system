const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let serverProcess = null;
let mainWindow = null;

function startServer() {
  serverProcess = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  });
  serverProcess.on('error', err => console.error('Server error:', err));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Smart Attendance System — Enterprise',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  // Wait for Express to bind, then load
  const tryLoad = (attempts = 0) => {
    setTimeout(() => {
      mainWindow.loadURL('http://localhost:3000').catch(() => {
        if (attempts < 5) tryLoad(attempts + 1);
      });
    }, 1000 + attempts * 500);
  };
  tryLoad();

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.on('did-fail-load', () => tryLoad());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  startServer();
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
