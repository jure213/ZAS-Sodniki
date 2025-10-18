import { ipcMain } from 'electron';
import { DatabaseManager } from '../database';

export function setupOfficialHandlers(db: DatabaseManager) {
  ipcMain.handle('official:list', async () => {
    return db.listOfficials();
  });

  ipcMain.handle('official:create', async (_event, data: { name: string; email: string; phone: string; license_number: string; active?: number }) => {
    const id = db.addOfficial(data);
    return { ok: id > 0, id };
  });

  ipcMain.handle('official:update', async (_event, { id, data }: { id: number; data: { name: string; email: string; phone: string; license_number: string; active: number } }) => {
    const success = db.updateOfficial(id, data);
    return { ok: success };
  });

  ipcMain.handle('official:delete', async (_event, id: number) => {
    const success = db.deleteOfficial(id);
    return { ok: success };
  });

  ipcMain.handle('official:setActive', async (_event, { id, active }: { id: number; active: number }) => {
    const success = db.setOfficialActive(id, active);
    return { ok: success };
  });
}
