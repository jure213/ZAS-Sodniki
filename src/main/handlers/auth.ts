import { BrowserWindow } from 'electron';
import { loginSchema } from '@shared/schemas';
import { ApiError, db } from '../db/client';
import { handle } from '../ipc/handle';
import { AppError } from '../ipc/errors';
import { clearToken, loadToken, saveToken } from '../session/token';
import { getPrefs, setPrefs } from '../session/prefs';

export function registerAuthHandlers(): void {
  db.setSessionExpiredHandler(() => {
    clearToken();
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('auth:expired');
    }
  });

  handle('auth:login', loginSchema, async ({ username, password, remember }) => {
    setPrefs({ rememberMe: remember });
    const result = await db.login(username, password, remember);
    if (!result) {
      clearToken();
      throw new AppError('VALIDATION', 'Napačno uporabniško ime ali geslo');
    }
    if (remember) saveToken(result.token);
    else clearToken();
    return result.user;
  });

  handle('auth:restoreSession', null, async () => {
    if (!getPrefs().rememberMe) return null;
    const token = loadToken();
    if (!token) return null;

    db.setToken(token);
    // Throws (→ NETWORK) when the server is unreachable; the remembered token
    // is kept so the renderer can retry once the connection is back.
    let user;
    try {
      user = await db.me();
    } catch (e) {
      // A 502/503 from nginx while the API is down counts as "unreachable" too.
      if (e instanceof ApiError && e.status && e.status >= 500) {
        throw new AppError('NETWORK', 'Strežnik ni dosegljiv');
      }
      throw e;
    }
    if (!user) {
      db.setToken(null);
      clearToken();
      return null;
    }
    return user;
  });

  handle('auth:logout', null, async () => {
    db.setToken(null);
    clearToken();
    return null;
  });
}
