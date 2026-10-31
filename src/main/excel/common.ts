// Shared layout code for the Excel exports. The builders are pure: they take
// plain data and return an ExcelJS workbook; saving is a separate step (save.ts).
import ExcelJS from 'exceljs';

export type { Workbook, Worksheet } from 'exceljs';

export const MONEY_FMT = '#,##0.00';

export const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

const CENTER: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };

/** Integer cents to the number written into a cell. */
export const eur = (cents: number): number => cents / 100;

export function newSheet(name: string): { workbook: ExcelJS.Workbook; sheet: ExcelJS.Worksheet } {
  const workbook = new ExcelJS.Workbook();
  return { workbook, sheet: workbook.addWorksheet(name) };
}

/** Merged, bold, centred title in row 1 with a border on A1. */
export function addTitle(sheet: ExcelJS.Worksheet, text: string, columns: number): void {
  const row = sheet.addRow([text]);
  sheet.mergeCells(1, 1, 1, columns);
  row.font = { bold: true, size: 14 };
  row.alignment = CENTER;
  row.height = 25;
  sheet.getCell('A1').border = THIN_BORDER;
}

export type ReportTable = {
  title: string;
  headers: string[];
  /** Column keys and widths, in order. */
  columns: { key: string; width: number }[];
  /** Data rows, keyed by column key. */
  rows: Record<string, string | number>[];
  /** Summary row (last row). */
  total: Record<string, string | number>;
  /** 1-based columns that get the money number format in data rows. */
  moneyColumns: number[];
  /** 1-based column of the total in the summary row. */
  totalColumn: number;
};

/**
 * The layout shared by the competition report, the summary and the preview:
 * title, bold header, bordered centred cells, bold summary row directly under
 * the data (empty summary cells stay unbordered).
 */
export function buildReportTable(sheetName: string, t: ReportTable): ExcelJS.Workbook {
  const { workbook, sheet } = newSheet(sheetName);
  addTitle(sheet, t.title, t.headers.length);

  const headerRow = sheet.addRow(t.headers);
  headerRow.font = { bold: true };
  headerRow.alignment = CENTER;

  sheet.columns = t.columns;

  for (const values of t.rows) {
    const row = sheet.addRow(values);
    for (const col of t.moneyColumns) row.getCell(col).numFmt = MONEY_FMT;
  }

  const totalRow = sheet.addRow(t.total);
  totalRow.getCell(t.totalColumn).numFmt = MONEY_FMT;

  const totalRowNumber = sheet.rowCount;
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      if (rowNumber === 1) return; // title keeps its own border
      if (rowNumber === totalRowNumber && !cell.value) return; // empty summary cells
      cell.border = THIN_BORDER;
      cell.alignment = CENTER;
      if (rowNumber === 2 || rowNumber === totalRowNumber) cell.font = { bold: true };
    });
  });
  return workbook;
}

/** Title, blank row, grey bordered header: the layout of the officials / competitions lists. */
export function addListHeader(sheet: ExcelJS.Worksheet, title: string, headers: string[]): void {
  addTitle(sheet, title, headers.length);
  sheet.addRow([]);
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.alignment = CENTER;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    cell.border = THIN_BORDER;
  });
}
