import { app } from 'electron';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const stripHash = (url: string) => url.split('#')[0];

/** URL of the bundled renderer entry (production / packaged). */
export function indexFileUrl(): string {
  return pathToFileURL(path.join(__dirname, '../renderer/index.html')).href;
}

/** Dev server URL. Only ever honoured when the app is NOT packaged. */
export function devServerUrl(): string | null {
  return !app.isPackaged && process.env['ELECTRON_RENDERER_URL']
    ? process.env['ELECTRON_RENDERER_URL']
    : null;
}

/** True only for the bundled UI (or, in dev, the Vite dev server). */
export function isTrustedUrl(url: string): boolean {
  if (stripHash(url).toLowerCase() === stripHash(indexFileUrl()).toLowerCase()) return true;
  const dev = devServerUrl();
  if (!dev) return false;
  try {
    return new URL(url).origin === new URL(dev).origin;
  } catch {
    return false;
  }
}

// Relaxed policy for the Vite dev server (HMR needs inline scripts + ws).
const DEV_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws://localhost:* http://localhost:*; object-src 'none'; base-uri 'none'";

/** Sets the relaxed dev CSP header. Does nothing in a packaged app. */
export function installDevCsp(session: Electron.Session): void {
  if (app.isPackaged) return;
  session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [DEV_CSP],
      },
    });
  });
}

/** Deny pop-ups, off-origin navigation, webviews and every permission prompt. */
export function lockDownWindow(win: Electron.BrowserWindow): void {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault();
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
}
