import { ipcMain } from 'electron';

export function setupDashboardHandlers(db: any) {
  ipcMain.handle('dashboard:getStats', async () => {
    return await db.getDashboardStats();
  });
}
