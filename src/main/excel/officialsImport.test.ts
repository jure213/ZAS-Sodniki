import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { cellText, nameKey, parseOfficialsSheet } from './officialsImport';

function sheet(rows: ExcelJS.CellValue[][]): ExcelJS.Worksheet {
  const ws = new ExcelJS.Workbook().addWorksheet('S');
  for (const r of rows) ws.addRow(r);
  return ws;
}

describe('cellText', () => {
  it('reads plain, hyperlink, formula, rich text and numeric cells', () => {
    expect(cellText('  a  ')).toBe('a');
    expect(cellText(41234567)).toBe('41234567');
    expect(cellText({ text: 'a@b.si', hyperlink: 'mailto:a@b.si' })).toBe('a@b.si');
    expect(cellText({ hyperlink: 'mailto:a@b.si' } as never)).toBe('a@b.si');
    expect(cellText({ formula: 'A1', result: 'x' } as never)).toBe('x');
    expect(cellText({ richText: [{ text: 'a ' }, { text: 'b' }] })).toBe('a b');
    expect(cellText({ error: '#N/A' } as never)).toBe('');
    expect(cellText(null)).toBe('');
  });
});

describe('parseOfficialsSheet', () => {
  it('finds the header within the first five rows and accepts v1 column aliases', () => {
    const ws = sheet([
      ['Seznam'],
      [],
      ['Rang', 'Priimek in ime', 'Name', 'Telefon', 'E-mail', 'Dodatni_izpiti'],
      ['A', 'ignored', 'Ana Test', '040', 'ana@x.si', 'GS'],
    ]);
    const p = parseOfficialsSheet(ws, [], 'f.xlsx');
    expect(p.toInsert).toEqual([
      { row: 4, name: 'Ana Test', email: 'ana@x.si', phone: '040', rank: 'A', additional_exams: 'GS' },
    ]);
  });

  it('does not look for the header below row five', () => {
    const rows: ExcelJS.CellValue[][] = [[], [], [], [], [], ['Ime']];
    expect(() => parseOfficialsSheet(sheet(rows), [], 'f.xlsx')).toThrow(/glavo/);
  });

  it('separates new rows, duplicates (database and file, any case) and errors', () => {
    const ws = sheet([
      ['Ime', 'Email'],
      ['Ana', ''],
      ['ANA ', ''],
      ['Boris', ''],
      ['  boris', ''],
      ['Existing  Person', ''],
      [],
      ['', 'x@y.si'],
      ['Cene', 'bad'],
    ]);
    const p = parseOfficialsSheet(ws, ['existing person'], 'f.xlsx');
    expect(p.toInsert.map((r) => r.name)).toEqual(['Ana', 'Boris']);
    expect(p.skippedDuplicates).toEqual([
      { row: 3, name: 'ANA', reason: 'file' },
      { row: 5, name: 'boris', reason: 'file' },
      { row: 6, name: 'Existing  Person', reason: 'database' },
    ]);
    expect(p.errors).toEqual([
      { row: 8, message: 'Manjka ime' },
      { row: 9, message: 'Neveljaven e-poštni naslov' },
    ]);
  });

  it('nameKey ignores case and repeated whitespace', () => {
    expect(nameKey('  Jan   Novak ')).toBe(nameKey('jan novak'));
  });
});
