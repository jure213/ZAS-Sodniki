import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { DatabaseManager } from '../database';

export function setupAuthHandlers(db: DatabaseManager) {
  ipcMain.handle('auth:login', async (_event: IpcMainInvokeEvent, { username, password }: { username: string; password: string }) => {
    const user = db.getUserByUsername(username);
    if (!user) return { ok: false, error: 'Uporabnik ne obstaja' };
    // NOTE: Plain-text for prototype; replace with hashed password check (bcrypt) in production
    if (user.password !== password) return { ok: false, error: 'Napačno geslo' };
    return { ok: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } };
  });

  ipcMain.handle('auth:logout', async () => {
    return { ok: true };
  });

  ipcMain.handle('auth:validateSession', async (_event: IpcMainInvokeEvent, userId: number) => {
    const user = db.getUserById(userId);
    if (!user) return { ok: false };
    return { ok: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } };
  });
}
