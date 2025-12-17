import { ipcMain } from 'electron';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export function setupUserHandlers(db: any) {
  ipcMain.handle('user:list', async () => {
    return await db.listUsers();
  });

  ipcMain.handle('user:create', async (_event, data: { username: string; password: string; name: string; role: string }) => {
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
    const id = await db.addUser({ ...data, password: hashedPassword });
    return { ok: id > 0, id };
  });

  ipcMain.handle('user:update', async (_event, { id, data }: { id: number; data: { username: string; name: string; role: string; password?: string } }) => {
    const updateData = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, SALT_ROUNDS);
    }
    const success = await db.updateUser(id, updateData);
    return { ok: success };
  });

  ipcMain.handle('user:delete', async (_event, id: number) => {
    const success = await db.deleteUser(id);
    return { ok: success };
  });
}
