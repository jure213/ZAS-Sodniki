import { ipcMain } from 'electron';
import { DatabaseManager } from '../database';

export function setupCompetitionHandlers(db: DatabaseManager) {
  ipcMain.handle('competition:list', async () => {
    return db.listCompetitions();
  });

  ipcMain.handle('competition:create', async (_event, data: { name: string; date: string; location: string; type: string; status: string; notes?: string }) => {
    const id = db.addCompetition(data);
    return { ok: id > 0, id };
  });

  ipcMain.handle('competition:update', async (_event, { id, data }: { id: number; data: { name: string; date: string; location: string; type: string; status: string; notes: string } }) => {
    const success = db.updateCompetition(id, data);
    return { ok: success };
  });

  ipcMain.handle('competition:delete', async (_event, id: number) => {
    const success = db.deleteCompetition(id);
    return { ok: success };
  });
}
