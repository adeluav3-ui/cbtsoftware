'use strict';


const { app, BrowserWindow, dialog, shell, Menu } = require('electron');
const { spawn, execSync } = require('child_process');
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
  // Store the database in the user-data directory so it survives app reinstalls/updates.
  const dbPath = path.join(app.getPath('userData'), 'cbt-local.db');
  log(`dbPath=${dbPath}`);

  log(`spawning: ${NODE_EXE} ${SERVER_MJS} cwd=${SERVER_DIR}`);
  serverProcess = spawn(NODE_EXE, [SERVER_MJS], {
    cwd:         SERVER_DIR,
    env:         { ...process.env, SQLITE_PATH: dbPath },
    stdio:       ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  // Pipe server stdout/stderr to the electron log file so errors are visible
  if (serverProcess.stdout) {
    serverProcess.stdout.on('data', (data) => log(`[server] ${data.toString().trimEnd()}`));
  }
  if (serverProcess.stderr) {
    serverProcess.stderr.on('data', (data) => log(`[server:err] ${data.toString().trimEnd()}`));
  }

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

// Adds a Windows Firewall inbound rule for port 8080 on first launch.
// Runs once — a flag file in userData prevents repeat prompts.
function ensureFirewallRule() {
  const flagPath = path.join(app.getPath('userData'), '.firewall-configured');
  if (fs.existsSync(flagPath)) return;

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'One-Time Network Setup',
    message: 'Allow student devices to connect',
    detail:
      'CBT Software needs to open port 8080 in Windows Firewall so students ' +
      'on the same Wi-Fi network can reach this server from their devices.\n\n' +
      'Click "Allow" and then click "Yes" on the Windows security prompt that appears.',
    buttons: ['Allow', 'Skip'],
    defaultId: 0,
  }).then(({ response }) => {
    if (response !== 0) {
      log('Firewall setup skipped by user');
      return;
    }
    try {
      execSync(
        'powershell -WindowStyle Hidden -Command "' +
          'Start-Process cmd ' +
          "-ArgumentList '/c netsh advfirewall firewall add rule " +
            'name=\\"CBT Software Local\\" ' +
            'dir=in action=allow protocol=TCP localport=8080 profile=any' +
          "' " +
          '-Verb RunAs -Wait"',
        { windowsHide: true, timeout: 30000 }
      );
      fs.writeFileSync(flagPath, '1');
      log('Firewall rule added successfully');
    } catch (err) {
      log(`Firewall rule setup failed: ${err.message}`);
    }
  });
}

function resetSchool() {
  const dbPath = path.join(app.getPath('userData'), 'cbt-local.db');

  dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Reset & Create New School',
    message: 'This will permanently delete all school data.',
    detail:
      'All students, teachers, exams, results, and settings will be erased. ' +
      'The app will restart and show the school setup screen.\n\n' +
      'This cannot be undone. Are you sure?',
    buttons: ['Reset & Start Over', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
  }).then(({ response }) => {
    if (response !== 0) return;

    log('User requested school reset — stopping server');
    stopServer();

    // Delete the database and its journal files
    for (const suffix of ['', '-shm', '-wal']) {
      const f = dbPath + suffix;
      try { fs.unlinkSync(f); log(`Deleted: ${f}`); } catch (_) {}
    }

    log('Restarting server after reset');
    startServer();

    waitForServer().then(() => {
      if (mainWindow) {
        mainWindow.loadURL(`http://localhost:${PORT}`);
      }
    }).catch((err) => {
      log(`Server restart after reset failed: ${err.message}`);
      dialog.showErrorBox('Restart Failed', err.message);
    });
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reset & Create New School…',
          accelerator: null,
          click: resetSchool,
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'forceReload', label: 'Force Reload' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toggle Full Screen' },
        ...(!app.isPackaged ? [
          { type: 'separator' },
          { role: 'toggleDevTools', label: 'Developer Tools' },
        ] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open Log File',
          click: () => shell.openPath(LOG_FILE),
        },
        {
          label: `Version ${app.getVersion()}`,
          enabled: false,
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
    // Allow blank popups — window.open('', '_blank') is used by print functions
    // (broadsheet PDF, credentials, report cards write HTML then call .print())
    if (!url || url === 'about:blank') {
      return { action: 'allow' };
    }
    // Route all real external URLs to the system browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();

    // Open port 8080 in Windows Firewall on first launch so students can connect.
    ensureFirewallRule();

    // Check for updates in background — silently downloads; prompts admin when ready.
    if (app.isPackaged) {
      try {
        const { autoUpdater } = require('electron-updater');
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.on('update-downloaded', () => {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'CBT Software Update Ready',
            message: 'A software update has been downloaded. It will install automatically when you close the app.',
            buttons: ['Install Now', 'Install on Close'],
            defaultId: 1,
          }).then(({ response }) => {
            if (response === 0) autoUpdater.quitAndInstall(true, true);
          });
        });
        autoUpdater.checkForUpdates().catch(() => {}); // ignore if no internet
      } catch (_) {}
    }
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

  buildMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});

app.on('will-quit', () => {
  stopServer();
});
