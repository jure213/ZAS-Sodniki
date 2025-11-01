import { ipcMain, dialog } from 'electron';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

export function setupExportHandlers(db: any) {
  ipcMain.handle('export:generateCompetitionReport', async (_event, competitionId: number, tariffType: string = 'official') => {
    try {
      // Get competition data
      const competitions = await db.listCompetitions();
      const competition = competitions.find((c: any) => c.id === competitionId);
      
      if (!competition) {
        return { ok: false, message: 'Tekma ni bila najdena' };
      }

      // Get report data with selected tariff type
      const reportData = await db.getCompetitionReportData(competitionId, tariffType);

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
      worksheet.mergeCells(1, 1, 1, 8); // Merge cells A1 to H1 (8 columns now)
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
      const headerRow = worksheet.addRow(['IME', 'RANG', 'VLOGA', 'DISCIPLINA', 'URE', 'ZNESEK', 'POTNI STROŠKI', 'SKUPAJ']);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

      // Set column widths
      worksheet.columns = [
        { key: 'name', width: 25 },
        { key: 'rank', width: 8 },
        { key: 'role', width: 15 },
        { key: 'discipline', width: 15 },
        { key: 'hours', width: 8 },
        { key: 'amount', width: 12 },
        { key: 'travelCost', width: 15 },
        { key: 'total', width: 12 },
      ];

      // Add data rows
      let grandTotal = 0;
      reportData.forEach((row: any) => {
        // payment.amount already includes travel costs, so we need to separate them
        // row.amount = total payment, row.travelCost = travel costs only
        // So base amount (without travel) = row.amount - row.travelCost
        const baseAmount = row.amount - row.travelCost;
        const rowTotal = row.amount; // Total is the payment amount (already includes travel)
        grandTotal += rowTotal;
        
        worksheet.addRow({
          name: row.name,
          rank: parseInt(row.rank) || 0, // Save as number
          role: row.role,
          discipline: row.discipline,
          hours: row.hours,
          amount: baseAmount.toFixed(2) + ' €',
          travelCost: row.travelCost.toFixed(2) + ' €',
          total: rowTotal.toFixed(2) + ' €',
        });
      });

      // Add total row (no empty row before it)
      const totalRowIndex = reportData.length + 2; // +1 for header, +1 for 1-based index
      const totalRow = worksheet.addRow({
        name: '',
        rank: '',
        role: '',
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
      const tariffLabel = tariffType === 'invoice' ? 'racun' : 'sodniki';
      const defaultFileName = `Tekma_${sanitizedName}_${fileDate}_${tariffLabel}.xlsx`;

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

  ipcMain.handle('export:generateCompetitionsSummary', async (_event, competitionIds: number[], tariffType: string = 'official') => {
    try {
      if (!competitionIds || competitionIds.length === 0) {
        return { ok: false, message: 'Nobena tekma ni bila izbrana' };
      }

      // Get all competitions
      const competitions = await db.listCompetitions();
      const selectedCompetitions = competitions.filter((c: any) => competitionIds.includes(c.id));

      if (!selectedCompetitions || selectedCompetitions.length === 0) {
        return { ok: false, message: 'Izbrane tekme niso bile najdene' };
      }

      // For each competition, get report data and calculate totals
      const summaryData = [];
      
      for (const comp of selectedCompetitions) {
        const reportData = await db.getCompetitionReportData(comp.id, tariffType);
        
        if (reportData && reportData.length > 0) {
          let officialsTotal = 0;
          let travelTotal = 0;
          
          reportData.forEach((row: any) => {
            officialsTotal += (row.amount - row.travelCost); // Base amount without travel
            travelTotal += row.travelCost;
          });
          
          summaryData.push({
            id: comp.id,
            name: comp.name,
            date: comp.date,
            location: comp.location,
            officialsTotal,
            travelTotal,
            grandTotal: officialsTotal + travelTotal
          });
        }
      }

      if (summaryData.length === 0) {
        return { ok: false, message: 'Ni podatkov za izbrane tekme' };
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
      const worksheet = workbook.addWorksheet('Pregled');

      // Add title row
      const titleRow = worksheet.addRow(['PREGLED TEKEM']);
      worksheet.mergeCells(1, 1, 1, 6);
      titleRow.font = { bold: true, size: 14 };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 25;

      const titleCell = worksheet.getCell('A1');
      titleCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      // Add header row
      const headerRow = worksheet.addRow(['TEKMA', 'DATUM', 'LOKACIJA', 'SODNIKI', 'POTNI STROŠKI', 'SKUPAJ']);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

      // Set column widths
      worksheet.columns = [
        { key: 'name', width: 35 },
        { key: 'date', width: 12 },
        { key: 'location', width: 20 },
        { key: 'officials', width: 15 },
        { key: 'travel', width: 15 },
        { key: 'total', width: 15 },
      ];

      // Add data rows and calculate grand totals
      let totalOfficials = 0;
      let totalTravel = 0;
      let grandTotal = 0;

      summaryData.forEach((row: any) => {
        totalOfficials += row.officialsTotal;
        totalTravel += row.travelTotal;
        grandTotal += row.grandTotal;

        worksheet.addRow({
          name: row.name,
          date: formatDate(row.date),
          location: row.location,
          officials: row.officialsTotal.toFixed(2) + ' €',
          travel: row.travelTotal.toFixed(2) + ' €',
          total: row.grandTotal.toFixed(2) + ' €',
        });
      });

      // Add total row
      const totalRow = worksheet.addRow({
        name: '',
        date: '',
        location: '',
        officials: '',
        travel: 'SKUPAJ:',
        total: grandTotal.toFixed(2) + ' €',
      });

      // Apply borders and center alignment to all cells
      const totalRowNumber = worksheet.rowCount;

      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          // Skip title row (row 1) - border already applied
          if (rowNumber === 1) {
            return;
          }

          // Skip empty cells in total row
          if (rowNumber === totalRowNumber && !cell.value) {
            return;
          }

          // Borders for all cells
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

      // Save dialog
      const sanitizedDate = new Date().toISOString().split('T')[0].replace(/-/g, '-');
      const tariffLabel = tariffType === 'invoice' ? 'racun' : 'sodniki';
      const defaultFileName = `Pregled_tekem_${sanitizedDate}_${tariffLabel}.xlsx`;

      const result = await dialog.showSaveDialog({
        title: 'Shrani pregled tekem',
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
      console.error('Error generating competitions summary:', error);
      return { ok: false, message: error.message || 'Neznana napaka' };
    }
  });

  ipcMain.handle('export:getSummaryData', async (_event, competitionIds: number[], tariffType: string = 'official') => {
    try {
      return await db.getCompetitionsSummaryData(competitionIds, tariffType);
    } catch (error: any) {
      console.error('Error getting summary data:', error);
      return [];
    }
  });

  // Generate preview report for competition officials (before generating payments)
  ipcMain.handle('export:generatePreviewReport', async (_event, competitionId: number, officials: any[]) => {
    try {
      // Get competition data
      const competitions = await db.listCompetitions();
      const competition = competitions.find((c: any) => c.id === competitionId);
      
      if (!competition) {
        return { ok: false, message: 'Tekma ni bila najdena' };
      }

      if (!officials || officials.length === 0) {
        return { ok: false, message: 'Ni dodeljenih sodnikov' };
      }

      // Format date to dd.mm.yyyy
      const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
      };

      // Get travel cost setting
      const travelCostPerKm = (await db.getAppSetting('travelCostPerKm')) || 0.37;

      // Create workbook with ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Predogled');

      // Add title row (merged cell)
      const titleRow = worksheet.addRow([
        `${competition.name} - ${formatDate(competition.date)} - PREDOGLED`,
      ]);
      worksheet.mergeCells(1, 1, 1, 7); // 7 columns total
      titleRow.font = { bold: true, size: 14 };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 25;

      // Add border to title cell
      const titleCell = worksheet.getCell('A1');
      titleCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      // Add header row
      const headerRow = worksheet.addRow([
        'SODNIK',
        'VLOGA',
        'URE',
        'KM',
        'POSTAVKA',
        'POTNI STROŠKI',
        'SKUPAJ',
      ]);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

      // Set column widths
      worksheet.columns = [
        { key: 'sodnik', width: 25 },
        { key: 'vloga', width: 20 },
        { key: 'ure', width: 8 },
        { key: 'km', width: 8 },
        { key: 'postavka', width: 12 },
        { key: 'potni', width: 15 },
        { key: 'skupaj', width: 12 },
      ];

      // Add data rows
      let grandTotal = 0;
      officials.forEach((official: any) => {
        const kilometers = official.kilometers || 0;
        const travelCost = kilometers * travelCostPerKm;
        const totalAmount = official.znesek_sodnik || 0;
        const baseAmount = totalAmount - travelCost;
        grandTotal += totalAmount;

        worksheet.addRow({
          sodnik: official.official_name,
          vloga: official.role,
          ure: official.hours,
          km: kilometers,
          postavka: baseAmount.toFixed(2) + ' €',
          potni: travelCost.toFixed(2) + ' €',
          skupaj: totalAmount.toFixed(2) + ' €',
        });
      });

      // Add total row
      const totalRow = worksheet.addRow({
        sodnik: '',
        vloga: '',
        ure: '',
        km: '',
        postavka: '',
        potni: 'SKUPAJ:',
        skupaj: grandTotal.toFixed(2) + ' €',
      });

      // Apply borders and center alignment to all cells
      const totalRowNumber = worksheet.rowCount;

      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          // Skip title row (row 1) - border already applied
          if (rowNumber === 1) {
            return;
          }

          // Skip empty cells in total row
          if (rowNumber === totalRowNumber && !cell.value) {
            return;
          }

          // Borders for all cells
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };

          // Center alignment for all cells
          cell.alignment = { horizontal: 'center', vertical: 'middle' };

          // Bold for header row (row 2) and total row
          if (rowNumber === 2 || rowNumber === totalRowNumber) {
            cell.font = { bold: true };
          }
        });
      });

      // Show save dialog
      const sanitizedName = competition.name.replace(/[^a-zA-Z0-9]/g, '_');
      const fileDate = formatDate(competition.date).replace(/\./g, '-');
      const defaultFileName = `Predogled_${sanitizedName}_${fileDate}.xlsx`;

      const result = await dialog.showSaveDialog({
        title: 'Shrani predogled izplačil',
        defaultPath: path.join(require('os').homedir(), 'Downloads', defaultFileName),
        filters: [
          { name: 'Excel Files', extensions: ['xlsx'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { ok: false, message: 'Shranjevanje preklicano' };
      }

      // Write file with ExcelJS
      await workbook.xlsx.writeFile(result.filePath);

      return { ok: true, filePath: result.filePath };
    } catch (error: any) {
      console.error('Error generating preview report:', error);
      return { ok: false, message: error.message || 'Neznana napaka' };
    }
  });
}