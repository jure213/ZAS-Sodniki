import { ipcMain } from 'electron';

export function setupSettingsHandlers(db: any) {
  ipcMain.handle('settings:get', async () => {
    const roles = await db.getSetting('official_roles') ?? [];
    const appSettings = await db.getSetting('app_settings') || {};
    return { 
      language: 'sl', 
      theme: 'light', 
      roles,
      ...appSettings
    };
  });

  ipcMain.handle('settings:setRoles', async (_event, roles: Array<{ id: number; name: string; hourlyRate: number }>) => {
    await db.setSetting('official_roles', roles);
    return { ok: true };
  });

  ipcMain.handle('settings:getRoles', async () => {
    return await db.getSetting('official_roles') ?? [];
  });

  ipcMain.handle('settings:checkRoleUsage', async (_event, roleName: string) => {
    const usage = await db.checkRoleUsage(roleName);
    return usage;
  });

  ipcMain.handle('settings:deleteRoleReferences', async (_event, roleName: string) => {
    const deletedCount = await db.deleteRoleReferences(roleName);
    return { deletedCount };
  });

  ipcMain.handle('settings:clearDatabase', async () => {
    await db.clearAllData();
    return { ok: true };
  });

  ipcMain.handle('settings:updateAppSetting', async (_event, key: string, value: any) => {
    await db.updateAppSetting(key, value);
    return { ok: true };
  });

  // Disciplines handlers
  ipcMain.handle('settings:getDisciplines', async () => {
    return await db.getDisciplines();
  });

  ipcMain.handle('settings:setDisciplines', async (_event, disciplines: string[]) => {
    await db.setDisciplines(disciplines);
    return { ok: true };
  });

  ipcMain.handle('settings:checkDisciplineUsage', async (_event, discipline: string) => {
    const usage = await db.checkDisciplineUsage(discipline);
    return usage;
  });

  ipcMain.handle('settings:deleteDisciplineReferences', async (_event, discipline: string) => {
    const success = await db.deleteDisciplineReferences(discipline);
    return { ok: success };
  });
}
