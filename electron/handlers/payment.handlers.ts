import { ipcMain } from 'electron';

export function setupPaymentHandlers(db: any) {
  ipcMain.handle('payment:list', async (_event, filters?: any) => {
    return await db.listPayments(filters);
  });

  ipcMain.handle('payment:create', async (_event, data: any) => {
    const id = await db.addPayment(data);
    return { ok: id > 0, id };
  });

  ipcMain.handle('payment:update', async (_event, { id, data }: { id: number; data: any }) => {
    const success = await db.updatePayment(id, data);
    return { ok: success };
  });

  ipcMain.handle('payment:delete', async (_event, id: number) => {
    const success = await db.deletePayment(id);
    return { ok: success };
  });

  ipcMain.handle('payment:markPaid', async (_event, id: number) => {
    const success = await db.markPaymentAsPaid(id);
    return { ok: success };
  });
}
