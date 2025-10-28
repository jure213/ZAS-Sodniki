import { app, BrowserWindow, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { SupabaseDatabaseManager } from './supabase';

// Configure logging
import { setupOfficialHandlers } from './handlers/official.handlers';
import { setupCompetitionHandlers } from './handlers/competition.handlers';
import { setupPaymentHandlers } from './handlers/payment.handlers';
import { setupAuthHandlers } from './handlers/auth.handlers';
import { setupSettingsHandlers } from './handlers/settings.handlers';
import { setupUserHandlers } from './handlers/user.handlers';
import { setupDashboardHandlers } from './handlers/dashboard.handlers';

let mainWindow: BrowserWindow | null = null;
let db: SupabaseDatabaseManager;

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
    db = new SupabaseDatabaseManager();
    console.log('Supabase database initialized');

    // Set up IPC handlers
    setupAuthHandlers(db as any);
    setupSettingsHandlers(db as any);
    setupOfficialHandlers(db as any);
    setupCompetitionHandlers(db as any);
    setupPaymentHandlers(db as any);
    setupUserHandlers(db as any);
    setupDashboardHandlers(db as any);

    console.log('IPC handlers registered');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
}

// App lifecycle
app.whenReady().then(async () => {
  console.log('=== APP STARTED ===');
  console.log('Is packaged:', app.isPackaged);
  console.log('Version:', app.getVersion());
  console.log('Path:', app.getAppPath());
  
  await initializeApp();
  createWindow();

  // Check for updates (skip in development mode)
  if (app.isPackaged) {
    console.log('=== AUTO-UPDATER ENABLED ===');
    console.log('Current version:', app.getVersion());
    
    // Configure auto-updater
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for updates...');
    });
    
    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info.version);
      console.log('Release notes:', info.releaseNotes);
    });
    
    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available. Current version is', info.version);
    });
    
    autoUpdater.on('error', (err) => {
      console.error('Error in auto-updater:', err);
    });
    
    autoUpdater.on('download-progress', (progressObj) => {
      console.log(`Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`);
    });
    
    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info.version);
      console.log('Will install on app restart');
      
      // Optionally show dialog to user
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded');
      }
    });
    
    // Start checking for updates
    autoUpdater.checkForUpdatesAndNotify();
    
    // Check every 10 minutes
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, 10 * 60 * 1000);
    
  } else {
    console.log('Running in development - skipping auto-update check');
  }

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
