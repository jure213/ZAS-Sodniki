import { ipcMain } from 'electron';
import { DatabaseManager } from '../database';

export function setupSettingsHandlers(db: DatabaseManager) {
  ipcMain.handle('settings:get', async () => {
    const roles = db.getSetting('official_roles') ?? [];
    return { language: 'sl', theme: 'light', roles };
  });

  ipcMain.handle('settings:setRoles', async (_event, roles: Array<{ id: number; name: string; hourlyRate: number }>) => {
    db.setSetting('official_roles', roles);
    return { ok: true };
  });

  ipcMain.handle('settings:getRoles', async () => {
    return db.getSetting('official_roles') ?? [];
  });
}
