import { ipcMain, dialog } from 'electron';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

export function setupExportHandlers(db: any) {
  ipcMain.handle('export:generateCompetitionReport', async (_event, competitionId: number) => {
    try {
      // Get competition data
      const competitions = await db.listCompetitions();
      const competition = competitions.find((c: any) => c.id === competitionId);
      
      if (!competition) {
        return { ok: false, message: 'Tekma ni bila najdena' };
      }

      // Get report data
      const reportData = await db.getCompetitionReportData(competitionId);

      if (!reportData || reportData.length === 0) {
        return { ok: false, message: 'Ni podatkov za to tekmo' };
      }

      // Format date to dd.mm.yyyy
      const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
      };

      // Create workbook with ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Izpis');

      // Add title row (merged cell)
      const titleRow = worksheet.addRow([`${competition.name} - ${formatDate(competition.date)}`]);
      worksheet.mergeCells(1, 1, 1, 7); // Merge cells A1 to G1
      titleRow.font = { bold: true, size: 14 };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 25;
      
      // Add border to title cell
      const titleCell = worksheet.getCell('A1');
      titleCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      // Add header row
      const headerRow = worksheet.addRow(['IME', 'RANG', 'DISCIPLINA', 'URE', 'ZNESEK', 'POTNI STROŠKI', 'SKUPAJ']);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

      // Set column widths
      worksheet.columns = [
        { key: 'name', width: 25 },
        { key: 'rank', width: 8 },
        { key: 'discipline', width: 15 },
        { key: 'hours', width: 8 },
        { key: 'amount', width: 12 },
        { key: 'travelCost', width: 15 },
        { key: 'total', width: 12 },
      ];

      // Add data rows
      let grandTotal = 0;
      reportData.forEach((row: any) => {
        const rowTotal = row.amount + row.travelCost;
        grandTotal += rowTotal;
        
        worksheet.addRow({
          name: row.name,
          rank: parseInt(row.rank) || 0, // Save as number
          discipline: row.discipline,
          hours: row.hours,
          amount: row.amount.toFixed(2) + ' €',
          travelCost: row.travelCost.toFixed(2) + ' €',
          total: rowTotal.toFixed(2) + ' €',
        });
      });

      // Add total row (no empty row before it)
      const totalRowIndex = reportData.length + 2; // +1 for header, +1 for 1-based index
      const totalRow = worksheet.addRow({
        name: '',
        rank: '',
        discipline: '',
        hours: '',
        amount: '',
        travelCost: 'SKUPAJ:',
        total: grandTotal.toFixed(2) + ' €',
      });

      // Apply borders and center alignment to all cells
      const totalRowNumber = worksheet.rowCount; // Last row is the total row
      
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          // Skip title row (row 1) - border already applied
          if (rowNumber === 1) {
            return;
          }
          
          // Skip empty cells in total row (don't apply borders)
          if (rowNumber === totalRowNumber && !cell.value) {
            return;
          }
          
          // Borders for all cells (except title row and empty cells in total row)
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          
          // Center alignment for all cells
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          
          // Bold for header row (row 2) and total row
          if (rowNumber === 2 || rowNumber === totalRowNumber) {
            cell.font = { bold: true };
          }
        });
      });

      // Auto-fit column widths based on content
      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell!({ includeEmpty: true }, (cell) => {
          const cellValue = cell.value ? cell.value.toString() : '';
          maxLength = Math.max(maxLength, cellValue.length);
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2; // Minimum 10, add padding
      });

      // Show save dialog
      const sanitizedName = competition.name.replace(/[^a-zA-Z0-9]/g, '_');
      const fileDate = formatDate(competition.date).replace(/\./g, '-'); // dd-mm-yyyy for filename
      const defaultFileName = `Tekma_${sanitizedName}_${fileDate}.xlsx`;

      const result = await dialog.showSaveDialog({
        title: 'Shrani Excel poročilo',
        defaultPath: path.join(require('os').homedir(), 'Downloads', defaultFileName),
        filters: [
          { name: 'Excel Files', extensions: ['xlsx'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { ok: false, message: 'Shranjevanje preklicano' };
      }

      // Write file with ExcelJS
      await workbook.xlsx.writeFile(result.filePath);

      return { ok: true, filePath: result.filePath };
    } catch (error: any) {
      console.error('Error generating competition report:', error);
      return { ok: false, message: error.message || 'Neznana napaka' };
    }
  });
}
