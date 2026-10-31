import { app, safeStorage } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

// "Remember me" stores the session token encrypted with the OS keychain
// (DPAPI on Windows). It is never readable by the renderer.
const sessionFile = () => path.join(app.getPath('userData'), 'session.bin');

export function saveToken(token: string): void {
  if (!safeStorage.isEncryptionAvailable()) return;
  fs.writeFileSync(sessionFile(), safeStorage.encryptString(token), { mode: 0o600 });
}

export function loadToken(): string | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(fs.readFileSync(sessionFile()));
  } catch {
    return null;
  }
}

export function clearToken(): void {
  try {
    fs.rmSync(sessionFile(), { force: true });
  } catch {
    // Nothing to clear.
  }
}
