import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { SupabaseDatabaseManager } from '../supabase';

// "Remember me" stores the session token encrypted with the OS keychain
// (DPAPI on Windows). It is never readable by the renderer.
const sessionFile = () => path.join(app.getPath('userData'), 'session.bin');

function saveToken(token: string): void {
  if (!safeStorage.isEncryptionAvailable()) return;
  fs.writeFileSync(sessionFile(), safeStorage.encryptString(token), { mode: 0o600 });
}

function loadToken(): string | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(fs.readFileSync(sessionFile()));
  } catch {
    return null;
  }
}

function clearToken(): void {
  try {
    fs.rmSync(sessionFile(), { force: true });
  } catch {
    // Nothing to clear.
  }
}

export function setupAuthHandlers(db: SupabaseDatabaseManager) {
  db.setSessionExpiredHandler(() => {
    clearToken();
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('auth:expired');
    }
  });

  ipcMain.handle('auth:login', async (
    _event: IpcMainInvokeEvent,
    { username, password, remember }: { username: string; password: string; remember?: boolean },
  ) => {
    try {
      const result = await db.login(username, password, Boolean(remember));
      if (!result) {
        clearToken();
        return { ok: false, error: 'Napačno uporabniško ime ali geslo' };
      }
      if (remember) {
        saveToken(result.token);
      } else {
        clearToken();
      }
      return { ok: true, user: result.user };
    } catch (error: any) {
      return { ok: false, error: `Napaka pri povezavi s strežnikom: ${error?.message ?? error}` };
    }
  });

  ipcMain.handle('auth:restoreSession', async () => {
    const token = loadToken();
    if (!token) return { ok: false };

    db.setToken(token);
    const user = await db.me();
    if (!user) {
      db.setToken(null);
      clearToken();
      return { ok: false };
    }
    return { ok: true, user };
  });

  ipcMain.handle('auth:logout', async () => {
    db.setToken(null);
    clearToken();
    return { ok: true };
  });
}
