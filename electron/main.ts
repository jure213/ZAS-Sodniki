import { app, BrowserWindow, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import { DatabaseManager } from './database';
import { setupOfficialHandlers } from './handlers/official.handlers';
import { setupCompetitionHandlers } from './handlers/competition.handlers';
import { setupPaymentHandlers } from './handlers/payment.handlers';
import { setupAuthHandlers } from './handlers/auth.handlers';
import { setupSettingsHandlers } from './handlers/settings.handlers';
import { setupUserHandlers } from './handlers/user.handlers';
import { setupDashboardHandlers } from './handlers/dashboard.handlers';

let mainWindow: BrowserWindow | null = null;
let db: DatabaseManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'ZAS Sodniki - Athletic Officials Payment Tracker',
  });

  // Load the app
  const indexHtml = path.join(__dirname, '../src/index.html');
  mainWindow.loadFile(indexHtml).catch((err) => {
    console.error('Failed to load index.html', err);
  });
  if (!app.isPackaged) {
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize database and IPC handlers
async function initializeApp() {
  try {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'zas-sodniki.db');
    
    db = new DatabaseManager(dbPath);
    console.log('Database initialized at:', dbPath);

    // Set up IPC handlers
    setupAuthHandlers(db);
    setupSettingsHandlers(db);
    setupOfficialHandlers(db);
    setupCompetitionHandlers(db);
    setupPaymentHandlers(db);
    setupUserHandlers(db);
    setupDashboardHandlers(db);

    console.log('IPC handlers registered');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
}

// App lifecycle
app.whenReady().then(async () => {
  await initializeApp();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) {
      db.close();
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (db) {
    db.close();
  }
});

// Handle IPC for app info
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPath', (_event: IpcMainInvokeEvent, name: string) => {
  return app.getPath(name as any);
});

ipcMain.handle('app:ping', async () => {
  return { pong: true, at: Date.now() };
});

ipcMain.handle('app:restart', async () => {
  if (mainWindow) {
    // Reload the window instead of restarting the entire app
    mainWindow.reload();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('app:quit', async () => {
  if (db) {
    db.close();
  }
  app.quit();
  return { success: true };
});
