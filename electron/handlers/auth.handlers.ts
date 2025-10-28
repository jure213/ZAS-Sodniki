import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';

export function setupAuthHandlers(db: any) {
  ipcMain.handle('auth:login', async (_event: IpcMainInvokeEvent, { username, password }: { username: string; password: string }) => {
    const user = await db.getUserByUsername(username);
    if (!user) return { ok: false, error: 'Uporabnik ne obstaja' };
    // NOTE: Plain-text for prototype; replace with hashed password check (bcrypt) in production
    if (user.password !== password) return { ok: false, error: 'Napačno geslo' };
    return { ok: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } };
  });

  ipcMain.handle('auth:logout', async () => {
    return { ok: true };
  });

  ipcMain.handle('auth:validateSession', async (_event: IpcMainInvokeEvent, userId: number) => {
    const user = await db.getUserById(userId);
    if (!user) return { ok: false };
    return { ok: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } };
  });
}
