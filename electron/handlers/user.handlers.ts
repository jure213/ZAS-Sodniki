import { ipcMain } from 'electron';

export function setupUserHandlers(db: any) {
  ipcMain.handle('user:list', async () => {
    return await db.listUsers();
  });

  ipcMain.handle('user:create', async (_event, data: { username: string; password: string; name: string; role: string }) => {
    const id = await db.addUser(data);
    return { ok: id > 0, id };
  });

  ipcMain.handle('user:update', async (_event, { id, data }: { id: number; data: { username: string; name: string; role: string; password?: string } }) => {
    const success = await db.updateUser(id, data);
    return { ok: success };
  });

  ipcMain.handle('user:delete', async (_event, id: number) => {
    const success = await db.deleteUser(id);
    return { ok: success };
  });
}
