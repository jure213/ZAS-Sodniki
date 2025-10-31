import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // App
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  ping: async () => ipcRenderer.invoke('app:ping'),
  restart: async () => ipcRenderer.invoke('app:restart'),
  quit: async () => ipcRenderer.invoke('app:quit'),
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
    checkRoleUsage: (roleName: string) => ipcRenderer.invoke('settings:checkRoleUsage', roleName),
    deleteRoleReferences: (roleName: string) => ipcRenderer.invoke('settings:deleteRoleReferences', roleName),
    clearDatabase: () => ipcRenderer.invoke('settings:clearDatabase'),
    updateAppSetting: (key: string, value: any) => ipcRenderer.invoke('settings:updateAppSetting', key, value),
  },
  // Officials
  officials: {
    list: () => ipcRenderer.invoke('official:list'),
    create: (data: any) => ipcRenderer.invoke('official:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('official:update', { id, data }),
    delete: (id: number) => ipcRenderer.invoke('official:delete', id),
    setActive: (id: number, active: number) => ipcRenderer.invoke('official:setActive', { id, active }),
    importExcel: () => ipcRenderer.invoke('official:importExcel'),
  },
  // Competitions
  competitions: {
    list: () => ipcRenderer.invoke('competition:list'),
    create: (data: any) => ipcRenderer.invoke('competition:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('competition:update', { id, data }),
    delete: (id: number) => ipcRenderer.invoke('competition:delete', id),
    listOfficials: (competitionId: number) => ipcRenderer.invoke('competition:listOfficials', competitionId),
    listAllOfficials: () => ipcRenderer.invoke('competition:listAllOfficials'),
    addOfficial: (data: any) => ipcRenderer.invoke('competition:addOfficial', data),
    updateOfficial: (id: number, data: any) => ipcRenderer.invoke('competition:updateOfficial', { id, data }),
    deleteOfficial: (id: number) => ipcRenderer.invoke('competition:deleteOfficial', id),
    generatePayments: (competitionId: number) => ipcRenderer.invoke('competition:generatePayments', competitionId),
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
  // Exports
  exports: {
    generateCompetitionReport: (competitionId: number) => ipcRenderer.invoke('export:generateCompetitionReport', competitionId),
  },
});

export {};
