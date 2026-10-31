import { ipcMain } from 'electron';
import type { SupabaseDatabaseManager } from '../supabase';

// Permissions are enforced by the database (only zas_admin may call the user
// functions); these handlers just forward and report errors.
export function setupUserHandlers(db: SupabaseDatabaseManager) {
  ipcMain.handle('user:list', async () => {
    return await db.listUsers();
  });

  ipcMain.handle('user:create', async (_event, data: { username: string; password: string; name: string; role: string }) => {
    try {
      const id = await db.addUser(data);
      return { ok: true, id };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('user:update', async (_event, { id, data }: { id: number; data: { username: string; name: string; role: string; password?: string } }) => {
    try {
      await db.updateUser(id, data);
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('user:delete', async (_event, id: number) => {
    try {
      await db.deleteUser(id);
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  });
}
