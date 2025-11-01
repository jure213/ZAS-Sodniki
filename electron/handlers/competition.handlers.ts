import { ipcMain } from 'electron';

export function setupCompetitionHandlers(db: any) {
  ipcMain.handle('competition:list', async () => {
    return await db.listCompetitions();
  });

  ipcMain.handle('competition:create', async (_event, data: { name: string; date: string; location: string; type: string; status: string; notes?: string }) => {
    const id = await db.addCompetition(data);
    return { ok: id > 0, id };
  });

  ipcMain.handle('competition:update', async (_event, { id, data }: { id: number; data: { name: string; date: string; location: string; type: string; status: string; notes: string } }) => {
    const success = await db.updateCompetition(id, data);
    return { ok: success };
  });

  ipcMain.handle('competition:delete', async (_event, id: number) => {
    const success = await db.deleteCompetition(id);
    return { ok: success };
  });

  // Competition Officials
  ipcMain.handle('competition:listOfficials', async (_event, competitionId: number) => {
    return await db.listCompetitionOfficials(competitionId);
  });

  ipcMain.handle('competition:listAllOfficials', async () => {
    return await db.listAllCompetitionOfficials();
  });

  ipcMain.handle('competition:addOfficial', async (_event, data: { competition_id: number; official_id: number; role: string; hours: number; kilometers?: number; discipline?: string; notes?: string; znesek_sodnik?: number; znesek_racun?: number }) => {
    const id = await db.addCompetitionOfficial(data);
    return { ok: id > 0, id };
  });

  ipcMain.handle('competition:updateOfficial', async (_event, { id, data }: { id: number; data: { role: string; hours: number; kilometers?: number; discipline?: string; notes: string; znesek_sodnik?: number; znesek_racun?: number } }) => {
    const success = await db.updateCompetitionOfficial(id, data);
    return { ok: success };
  });

  ipcMain.handle('competition:deleteOfficial', async (_event, id: number) => {
    const success = await db.deleteCompetitionOfficial(id);
    return { ok: success };
  });

  ipcMain.handle('competition:generatePayments', async (_event, competitionId: number) => {
    const result = await db.generatePaymentsForCompetition(competitionId);
    return { ok: true, ...result };
  });

  ipcMain.handle('competition:getReportData', async (_event, competitionId: number, tariffType: string = 'official') => {
    return await db.getCompetitionReportData(competitionId, tariffType);
  });
}
