// Minimal stand-in for the parts of electron the main-process code touches.
import * as os from 'node:os';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

export const handlers = new Map<string, Handler>();

export const ipcMain = {
  handle: (channel: string, fn: Handler) => {
    handlers.set(channel, fn);
  },
};

/** What the next save / open dialog answers. */
export const dialogState: { savePath: string | null; openPath: string | null } = { savePath: null, openPath: null };

export const dialog = {
  showSaveDialog: async () =>
    dialogState.savePath ? { canceled: false, filePath: dialogState.savePath } : { canceled: true, filePath: undefined },
  showOpenDialog: async () =>
    dialogState.openPath ? { canceled: false, filePaths: [dialogState.openPath] } : { canceled: true, filePaths: [] },
};

export const BrowserWindow = {
  getFocusedWindow: () => null,
  getAllWindows: () => [] as unknown[],
};

export const app = {
  isPackaged: false,
  getPath: () => os.tmpdir(),
  getVersion: () => '0.0.0-test',
  quit: () => undefined,
};

export const safeStorage = {};
export const session = {};
