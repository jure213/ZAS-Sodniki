import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type Prefs = { rememberMe: boolean };

const prefsFile = () => path.join(app.getPath('userData'), 'prefs.json');

export function getPrefs(): Prefs {
  try {
    const raw = JSON.parse(fs.readFileSync(prefsFile(), 'utf8'));
    return { rememberMe: raw?.rememberMe === true };
  } catch {
    return { rememberMe: false };
  }
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...patch };
  try {
    fs.mkdirSync(path.dirname(prefsFile()), { recursive: true });
    fs.writeFileSync(prefsFile(), JSON.stringify(next, null, 2));
  } catch (e) {
    console.error('Failed to save prefs:', e);
  }
  return next;
}
