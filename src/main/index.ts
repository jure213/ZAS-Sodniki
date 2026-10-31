import { app, BrowserWindow, session } from 'electron';
import * as path from 'node:path';
import { handle } from './ipc/handle';
import { registerAuthHandlers } from './handlers/auth';
import { registerUpdater } from './updater';
import { devServerUrl, indexFileUrl, installDevCsp, lockDownWindow } from './security';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    title: 'ZAS Sodniki',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // The window may only ever show the bundled UI: no pop-ups, no navigation
  // away from index.html (hash routes are in-page and unaffected).
  lockDownWindow(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
  });

  const dev = devServerUrl();
  const load = dev ? mainWindow.loadURL(dev) : mainWindow.loadURL(indexFileUrl());
  load.catch((err) => console.error('Failed to load UI', err));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerHandlers(): void {
  registerAuthHandlers();
  registerUpdater(() => mainWindow);
  handle('app:getVersion', null, () => app.getVersion());
  handle('app:quit', null, () => {
    app.quit();
    return null;
  });
}

app.whenReady().then(() => {
  installDevCsp(session.defaultSession);
  registerHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
