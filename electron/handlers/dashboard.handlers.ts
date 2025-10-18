import { ipcMain } from 'electron';
import { DatabaseManager } from '../database';

export function setupDashboardHandlers(db: DatabaseManager) {
  ipcMain.handle('dashboard:getStats', async () => {
    return db.getDashboardStats();
  });
}
