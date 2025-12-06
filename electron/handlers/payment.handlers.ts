import { ipcMain, dialog } from 'electron';
import ExcelJS from 'exceljs';
import * as path from 'path';

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

  ipcMain.handle('payment:markPaid', async (_event, { id, datePaid, method, isPartial, partialAmount }: { id: number; datePaid?: string; method?: string; isPartial?: boolean; partialAmount?: number }) => {
    const success = await db.markPaymentAsPaid(id, datePaid, method, isPartial, partialAmount);
    return { ok: success };
  });

  ipcMain.handle('payment:exportToExcel', async (_event, payments: any[]) => {
    try {
      if (!payments || payments.length === 0) {
        return { ok: false, message: 'Ni podatkov za izvoz' };
      }

      // Format date helper
      const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
      };

      // Format payment method
      const formatMethod = (method: string) => {
        const methodMap: Record<string, string> = {
          'gotovina': 'Gotovina',
          'nakazilo': 'Nakazilo',
          'cash': 'Gotovina',
          'bank_transfer': 'Nakazilo',
          'check': 'Nakazilo',
          'other': 'Drugo'
        };
        return methodMap[method] || method || '';
      };

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Izplačila');

      // Add title
      const titleRow = worksheet.addRow(['PREGLED IZPLAČIL']);
      worksheet.mergeCells(1, 1, 1, 7);
      titleRow.font = { bold: true, size: 14 };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 25;

      // Add header row
      const headerRow = worksheet.addRow([
        'SODNIK',
        'TEKMOVANJE',
        'ZNESEK (€)',
        'NAČIN',
        'STATUS',
        'DATUM TEKMOVANJA',
        'DATUM PLAČILA'
      ]);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

      // Set column widths
      worksheet.columns = [
        { key: 'official', width: 25 },
        { key: 'competition', width: 30 },
        { key: 'amount', width: 12 },
        { key: 'method', width: 15 },
        { key: 'status', width: 15 },
        { key: 'date', width: 18 },
        { key: 'datePaid', width: 18 }
      ];

      // Add data rows
      let totalPaid = 0;
      let totalOwed = 0;

      payments.forEach((payment: any) => {
        const amount = payment.amount || 0;
        if (payment.status === 'paid') {
          totalPaid += amount;
        } else {
          totalOwed += amount;
        }

        const dataRow = worksheet.addRow({
          official: payment.official_name || '',
          competition: payment.competition_name || '',
          amount: parseFloat(amount.toFixed(2)),
          method: formatMethod(payment.method),
          status: payment.status === 'paid' ? 'Plačano' : 'Ni plačano',
          date: formatDate(payment.date),
          datePaid: formatDate(payment.date_paid)
        });
        dataRow.getCell(3).numFmt = '#,##0.00';
      });

      // Add summary row
      worksheet.addRow([]);
      const summaryRow = worksheet.addRow({
        official: 'SKUPAJ',
        competition: '',
        amount: parseFloat((totalPaid + totalOwed).toFixed(2)),
        method: '',
        status: '',
        date: `Plačano: ${totalPaid.toFixed(2)}`,
        datePaid: `Ni plačano: ${totalOwed.toFixed(2)}`
      });
      summaryRow.font = { bold: true };
      summaryRow.getCell(3).numFmt = '#,##0.00';

      // Apply borders to all cells
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Center align amount and status columns
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 2) { // Skip title and header
          [3, 4, 5, 6, 7].forEach(colNum => {
            const cell = row.getCell(colNum);
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          });
        }
      });

      // Save dialog
      const defaultFileName = `Izplacila_${new Date().toISOString().split('T')[0]}.xlsx`;

      const result = await dialog.showSaveDialog({
        title: 'Shrani seznam izplačil',
        defaultPath: path.join(require('os').homedir(), 'Downloads', defaultFileName),
        filters: [
          { name: 'Excel Files', extensions: ['xlsx'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { ok: false, message: 'Shranjevanje preklicano' };
      }

      // Write file
      await workbook.xlsx.writeFile(result.filePath);

      return { ok: true, filePath: result.filePath };
    } catch (error: any) {
      console.error('Error exporting payments:', error);
      return { ok: false, message: error.message || 'Neznana napaka' };
    }
  });
}
