import { ipcMain } from 'electron';
import { DatabaseManager } from '../database';

export function setupUserHandlers(db: DatabaseManager) {
  ipcMain.handle('user:list', async () => {
    return db.listUsers();
  });

  ipcMain.handle('user:create', async (_event, data: { username: string; password: string; name: string; role: string }) => {
    const id = db.addUser(data);
    return { ok: id > 0, id };
  });

  ipcMain.handle('user:update', async (_event, { id, data }: { id: number; data: { username: string; name: string; role: string; password?: string } }) => {
    const success = db.updateUser(id, data);
    return { ok: success };
  });

  ipcMain.handle('user:delete', async (_event, id: number) => {
    const success = db.deleteUser(id);
    return { ok: success };
  });
}
