'use strict';

const { app, BrowserWindow, dialog, shell } = require('electron');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs   = require('fs');
const os   = require('os');

// Log to system temp — works from both ASAR and non-ASAR contexts
const LOG_FILE = path.join(os.tmpdir(), 'cbt-electron.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch (_) {}
}

const PORT = 8080;

const SERVER_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'server')
  : path.join(__dirname, '..', 'api-server', 'dist-local');

const NODE_EXE   = path.join(SERVER_DIR, 'node-runtime', 'node.exe');
const SERVER_MJS = path.join(SERVER_DIR, 'server.mjs');

log('main.js loaded');
log(`app.isPackaged=${app.isPackaged}`);
log(`SERVER_DIR=${SERVER_DIR}`);
log(`NODE_EXE exists=${fs.existsSync(NODE_EXE)}`);
log(`SERVER_MJS exists=${fs.existsSync(SERVER_MJS)}`);

let serverProcess = null;
let mainWindow    = null;

function startServer() {
  log(`spawning: ${NODE_EXE} ${SERVER_MJS} cwd=${SERVER_DIR}`);
  const SERVER_LOG = path.join(os.tmpdir(), 'cbt-server.log');
  const serverLogFd = fs.openSync(SERVER_LOG, 'a');
  log(`server log: ${SERVER_LOG}`);
  serverProcess = spawn(NODE_EXE, [SERVER_MJS], {
    cwd:         SERVER_DIR,
    stdio:       ['ignore', serverLogFd, serverLogFd],
    windowsHide: true,
  });

  serverProcess.on('error', (err) => {
    log(`spawn error: ${err.message}`);
    dialog.showErrorBox(
      'CBT Software Local — Server Error',
      `The local server failed to start.\n\n${err.message}\n\nMake sure port ${PORT} is not in use by another application.`
    );
    app.quit();
  });
}

function waitForServer(maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function check() {
      const req = http.get(`http://localhost:${PORT}/api/setup-status`, (res) => {
        res.resume();
        resolve();
      });

      req.setTimeout(1500, () => {
        req.destroy();
        retry();
      });

      req.on('error', retry);
    }

    function retry() {
      attempts++;
      if (attempts >= maxAttempts) {
        reject(new Error(`Server did not respond after ${maxAttempts} seconds.`));
      } else {
        setTimeout(check, 1000);
      }
    }

    setTimeout(check, 1500);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width:    1280,
    height:   800,
    minWidth:  900,
    minHeight: 600,
    title:    'CBT Software Local',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    show: false,
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  log('app ready');
  startServer();

  try {
    log('waiting for server...');
    await waitForServer();
    log('server ready');
  } catch (err) {
    log(`waitForServer failed: ${err.message}`);
    dialog.showErrorBox(
      'CBT Software Local — Startup Failed',
      `${err.message}\n\nIf this keeps happening, restart the app or check that no other application is using port ${PORT}.`
    );
    stopServer();
    app.quit();
    return;
  }

  createWindow();
});

app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});

app.on('will-quit', () => {
  stopServer();
});
