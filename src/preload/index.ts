// Sandboxed preload: the only runtime import is electron. Types come from
// type-only imports, which are erased at build time.
import { contextBridge, ipcRenderer } from 'electron';
import type { PreloadApi } from '../shared/ipc';

const CHANNEL = /^(auth|prefs|app|updater):[A-Za-z]+$/;
const EVENT = /^(auth:expired|updater:[a-z-]+)$/;

const api: PreloadApi = {
  invoke: ((channel: string, input?: unknown) => {
    if (typeof channel !== 'string' || !CHANNEL.test(channel)) {
      return Promise.reject(new Error(`Channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, input);
  }) as PreloadApi['invoke'],

  on: ((event: string, callback: (payload: unknown) => void) => {
    if (typeof event !== 'string' || !EVENT.test(event)) {
      throw new Error(`Event not allowed: ${event}`);
    }
    const listener = (_e: unknown, payload: unknown) => callback(payload);
    ipcRenderer.on(event, listener);
    return () => {
      ipcRenderer.removeListener(event, listener);
    };
  }) as PreloadApi['on'],
};

contextBridge.exposeInMainWorld('api', api);
