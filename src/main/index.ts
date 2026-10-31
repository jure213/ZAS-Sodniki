import { app, BrowserWindow, session } from 'electron';
import * as path from 'node:path';
import { registerAppHandlers } from './handlers/app';
import { registerAuthHandlers } from './handlers/auth';
import { registerDataHandlers } from './handlers/index';
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
  registerAppHandlers();
  registerDataHandlers();
  registerUpdater(() => mainWindow);
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
