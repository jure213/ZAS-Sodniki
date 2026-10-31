import { app } from 'electron';
import type { BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { IpcEvents } from '@shared/ipc';
import { handle } from './ipc/handle';
import { AppError } from './ipc/errors';

export function registerUpdater(getWindow: () => BrowserWindow | null): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = <E extends keyof IpcEvents>(event: E, payload?: IpcEvents[E]) =>
    getWindow()?.webContents.send(event, payload);

  autoUpdater.on('update-available', (info) =>
    send('updater:available', {
      version: info.version,
      currentVersion: app.getVersion(),
      releaseNotes: info.releaseNotes as never,
    }),
  );
  autoUpdater.on('update-not-available', () => send('updater:not-available'));
  autoUpdater.on('error', (err) => send('updater:error', err.message));
  autoUpdater.on('download-progress', (p) => send('updater:progress', { percent: p.percent }));
  autoUpdater.on('update-downloaded', (info) =>
    send('updater:downloaded', { version: info.version, currentVersion: app.getVersion() }),
  );

  handle('updater:check', null, async () => {
    if (!app.isPackaged) return { checked: false };
    await autoUpdater.checkForUpdates();
    return { checked: true };
  });
  handle('updater:download', null, async () => {
    if (!app.isPackaged) throw new AppError('FORBIDDEN', 'Posodobitve so na voljo samo v nameščeni aplikaciji.');
    await autoUpdater.downloadUpdate();
    return null;
  });
  handle('updater:install', null, () => {
    if (!app.isPackaged) throw new AppError('FORBIDDEN', 'Posodobitve so na voljo samo v nameščeni aplikaciji.');
    autoUpdater.quitAndInstall(false, true);
    return null;
  });

  // Check shortly after start, only in a packaged app.
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => console.error('Failed to check for updates:', err));
    }, 3000);
  }
}
