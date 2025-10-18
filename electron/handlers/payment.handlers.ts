import { ipcMain } from 'electron';
import { DatabaseManager } from '../database';

export function setupPaymentHandlers(db: DatabaseManager) {
  ipcMain.handle('payment:list', async (_event, filters?: any) => {
    return db.listPayments(filters);
  });

  ipcMain.handle('payment:create', async (_event, data: any) => {
    const id = db.addPayment(data);
    return { ok: id > 0, id };
  });

  ipcMain.handle('payment:update', async (_event, { id, data }: { id: number; data: any }) => {
    const success = db.updatePayment(id, data);
    return { ok: success };
  });

  ipcMain.handle('payment:delete', async (_event, id: number) => {
    const success = db.deletePayment(id);
    return { ok: success };
  });

  ipcMain.handle('payment:markPaid', async (_event, id: number) => {
    const success = db.markPaymentAsPaid(id);
    return { ok: success };
  });
}
