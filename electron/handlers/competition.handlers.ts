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

  // Competition Officials
  ipcMain.handle('competition:listOfficials', async (_event, competitionId: number) => {
    return db.listCompetitionOfficials(competitionId);
  });

  ipcMain.handle('competition:addOfficial', async (_event, data: { competition_id: number; official_id: number; role: string; hours: number; notes?: string }) => {
    const id = db.addCompetitionOfficial(data);
    return { ok: id > 0, id };
  });

  ipcMain.handle('competition:updateOfficial', async (_event, { id, data }: { id: number; data: { role: string; hours: number; notes: string } }) => {
    const success = db.updateCompetitionOfficial(id, data);
    return { ok: success };
  });

  ipcMain.handle('competition:deleteOfficial', async (_event, id: number) => {
    const success = db.deleteCompetitionOfficial(id);
    return { ok: success };
  });

  ipcMain.handle('competition:generatePayments', async (_event, competitionId: number) => {
    const result = db.generatePaymentsForCompetition(competitionId);
    return { ok: true, ...result };
  });
}
