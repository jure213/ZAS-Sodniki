import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // App
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  ping: async () => ipcRenderer.invoke('app:ping'),
  // Auth
  auth: {
    login: (payload: { username: string; password: string }) =>
      ipcRenderer.invoke('auth:login', payload),
    logout: () => ipcRenderer.invoke('auth:logout'),
    validateSession: (userId: number) => ipcRenderer.invoke('auth:validateSession', userId),
  },
  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    getRoles: () => ipcRenderer.invoke('settings:getRoles'),
    setRoles: (roles: any) => ipcRenderer.invoke('settings:setRoles', roles),
  },
  // Officials
  officials: {
    list: () => ipcRenderer.invoke('official:list'),
    create: (data: any) => ipcRenderer.invoke('official:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('official:update', { id, data }),
    delete: (id: number) => ipcRenderer.invoke('official:delete', id),
    setActive: (id: number, active: number) => ipcRenderer.invoke('official:setActive', { id, active }),
  },
  // Competitions
  competitions: {
    list: () => ipcRenderer.invoke('competition:list'),
    create: (data: any) => ipcRenderer.invoke('competition:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('competition:update', { id, data }),
    delete: (id: number) => ipcRenderer.invoke('competition:delete', id),
  },
  // Payments
  payments: {
    list: (filters?: any) => ipcRenderer.invoke('payment:list', filters),
    create: (data: any) => ipcRenderer.invoke('payment:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('payment:update', { id, data }),
    delete: (id: number) => ipcRenderer.invoke('payment:delete', id),
    markPaid: (id: number) => ipcRenderer.invoke('payment:markPaid', id),
  },
  // Users
  users: {
    list: () => ipcRenderer.invoke('user:list'),
    create: (data: any) => ipcRenderer.invoke('user:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('user:update', { id, data }),
    delete: (id: number) => ipcRenderer.invoke('user:delete', id),
  },
  // Dashboard
  dashboard: {
    getStats: () => ipcRenderer.invoke('dashboard:getStats'),
  },
});

export {};
