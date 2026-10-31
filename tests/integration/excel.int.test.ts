// Excel through the real handlers: export channels write valid workbooks,
// and the officials import (preview + confirm) works end to end.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, call, dialogState, ok, setup } from './harness';

const tmp = mkdtempSync(join(tmpdir(), 'zas-excel-'));
const createdOfficials: number[] = [];

beforeAll(setup);
afterAll(async () => {
  as('admin');
  for (const id of createdOfficials) await call('officials:delete', { id });
  dialogState.savePath = null;
  dialogState.openPath = null;
  rmSync(tmp, { recursive: true, force: true });
});

async function read(path: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  return wb;
}

describe('exports', () => {
  it('a cancelled dialog saves nothing', async () => {
    dialogState.savePath = null;
    expect(await ok('excel:officials')).toEqual({ saved: false });
  });

  it('writes D1 for a competition, in both tariffs', async () => {
    const comp = (await ok('competitions:list')).find((c) => c.name.length > 0 && c.status === 'completed')!;
    for (const tariff of ['sodnik', 'racun'] as const) {
      dialogState.savePath = join(tmp, `d1-${tariff}.xlsx`);
      const res = await call('excel:competitionReport', { competition_id: comp.id, tariff });
      if (!res.ok) {
        // A completed competition without assignments has nothing to report.
        expect(res.error).toEqual({ code: 'VALIDATION', message: 'Ni podatkov za to tekmo' });
        continue;
      }
      const wb = await read(dialogState.savePath);
      expect(wb.worksheets.map((w) => w.name)).toEqual(['Izpis']);
    }
  });

  it('reports "no data" for an empty competition', async () => {
    const c = await ok('competitions:create', { name: 'ITEST empty', date: '2031-01-01', location: '', status: 'completed', notes: '' });
    try {
      dialogState.savePath = join(tmp, 'empty.xlsx');
      expect(await call('excel:competitionReport', { competition_id: c.id, tariff: 'sodnik' })).toEqual({
        ok: false,
        error: { code: 'VALIDATION', message: 'Ni podatkov za to tekmo' },
      });
      expect(await call('excel:preview', { competition_id: c.id, tariff: 'sodnik' })).toEqual({
        ok: false,
        error: { code: 'VALIDATION', message: 'Ni dodeljenih sodnikov' },
      });
      expect(await ok('excel:summaryData', { competition_ids: [c.id], tariff: 'sodnik' })).toEqual([]);
    } finally {
      await ok('competitions:delete', { id: c.id });
    }
  });

  it('writes D2, D4, D5 and D6', async () => {
    const comps = await ok('competitions:list');
    dialogState.savePath = join(tmp, 'd2.xlsx');
    expect((await ok('excel:summary', { competition_ids: comps.map((c) => c.id), tariff: 'sodnik' })).saved).toBe(true);
    expect((await read(dialogState.savePath)).worksheets[0].name).toBe('Pregled');

    dialogState.savePath = join(tmp, 'd4.xlsx');
    expect((await ok('excel:officials')).saved).toBe(true);
    expect((await read(dialogState.savePath)).worksheets[0].name).toBe('Sodniki');

    dialogState.savePath = join(tmp, 'd5.xlsx');
    expect((await ok('excel:competitions')).saved).toBe(true);
    expect((await read(dialogState.savePath)).worksheets[0].name).toBe('Tekmovanja');

    dialogState.savePath = join(tmp, 'd6.xlsx');
    expect((await ok('excel:payments', { hide_zero: true })).saved).toBe(true);
    const sheet = (await read(dialogState.savePath)).worksheets[0];
    expect(sheet.name).toBe('Izplačila');
    expect(sheet.getRow(2).getCell(3).value).toBe('ZNESEK (€)');
    expect(sheet.getRow(2).getCell(5).value).toBe('OSTANE (€)');
  });

  it('D6 totals equal the filtered payments', async () => {
    const rows = await ok('payments:list', { status: 'open' });
    dialogState.savePath = join(tmp, 'd6-open.xlsx');
    await ok('excel:payments', { status: 'open' });
    const sheet = (await read(dialogState.savePath)).worksheets[0];
    const last = sheet.getRow(sheet.rowCount);
    expect(last.getCell(1).value).toBe('SKUPAJ');
    expect(last.getCell(5).value).toBeCloseTo(rows.reduce((s, r) => s + r.remaining_cents, 0) / 100, 2);
    expect(sheet.rowCount).toBe(rows.length + 4); // title, header, data, blank, summary
  });
});

describe('officials import', () => {
  it('previews header detection, hyperlink/formula/rich-text cells and duplicates, then inserts atomically', async () => {
    const existing = await ok('officials:create', {
      name: 'ITEST Import Existing', email: '', phone: '', rank: '', additional_exams: '', notes: '', active: true,
    });
    createdOfficials.push(existing.id);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('List');
    ws.addRow(['Seznam sodnikov za uvoz']); // title above the header
    ws.addRow([]);
    ws.addRow(['Ime', 'E-mail', 'Telefon', 'Rang', 'Dodatni izpiti']); // header on row 3
    ws.addRow(['ITEST Import One', { text: 'one@example.test', hyperlink: 'mailto:one@example.test' }, 41234567, 'A', 'B1']);
    ws.addRow([{ richText: [{ text: 'ITEST Import ' }, { text: 'Two' }] }, '', '', '', '']);
    ws.addRow([{ formula: 'A4', result: 'ITEST Import One' }, '', '', '', '']); // duplicate of row 4 by value
    ws.addRow(['  itest import existing  ', '', '', '', '']); // exists in the database
    ws.addRow(['itest import ONE', '', '', '', '']); // duplicate in file, other case
    ws.addRow([]); // blank
    ws.addRow(['', 'noname@example.test', '', '', '']); // no name
    ws.addRow(['ITEST Import Bad Mail', 'not-an-email', '', '', '']);
    ws.addRow(['ITEST Import Three', '', '', '3', '']);
    const file = join(tmp, 'import.xlsx');
    await wb.xlsx.writeFile(file);

    dialogState.openPath = file;
    const preview = (await ok('officials:importPreview'))!;
    expect(preview.fileName).toBe('import.xlsx');
    expect(preview.toInsert.map((r) => [r.row, r.name])).toEqual([
      [4, 'ITEST Import One'],
      [5, 'ITEST Import Two'],
      [12, 'ITEST Import Three'],
    ]);
    expect(preview.toInsert[0]).toMatchObject({ email: 'one@example.test', phone: '41234567', rank: 'A', additional_exams: 'B1' });
    expect(preview.skippedDuplicates).toEqual([
      { row: 6, name: 'ITEST Import One', reason: 'file' },
      { row: 7, name: 'itest import existing', reason: 'database' },
      { row: 8, name: 'itest import ONE', reason: 'file' },
    ]);
    expect(preview.errors).toEqual([
      { row: 10, message: 'Manjka ime' },
      { row: 11, message: 'Neveljaven e-poštni naslov' },
    ]);
    // Previewing stores nothing.
    expect((await ok('officials:list')).filter((o) => o.name.startsWith('ITEST Import')).length).toBe(1);

    const { row: _r, ...first } = preview.toInsert[0];
    void first;
    const confirm = await ok('officials:importConfirm', {
      rows: preview.toInsert.map(({ row: _row, ...r }) => r),
    });
    expect(confirm.inserted).toBe(3);
    const list = await ok('officials:list');
    for (const o of list.filter((x) => x.name.startsWith('ITEST Import') && x.id !== existing.id)) createdOfficials.push(o.id);
    expect(list.filter((o) => o.name === 'ITEST Import One' && o.active)).toHaveLength(1);

    // Confirming the same rows again inserts nothing (names now exist).
    expect((await ok('officials:importConfirm', { rows: preview.toInsert.map(({ row: _row, ...r }) => r) })).inserted).toBe(0);
  });

  it('cancelling the dialog returns null; a non-xlsx or broken file is a validation error', async () => {
    dialogState.openPath = null;
    expect(await ok('officials:importPreview')).toBeNull();

    dialogState.openPath = join(tmp, 'x.csv');
    const csv = await call('officials:importPreview');
    expect(csv.ok === false && csv.error.code).toBe('VALIDATION');

    const broken = join(tmp, 'broken.xlsx');
    writeFileSync(broken, 'not a zip');
    dialogState.openPath = broken;
    const res = await call('officials:importPreview');
    expect(res.ok === false && res.error.code).toBe('VALIDATION');

    const noHeader = new ExcelJS.Workbook();
    noHeader.addWorksheet('S').addRow(['a', 'b']);
    const f = join(tmp, 'noheader.xlsx');
    await noHeader.xlsx.writeFile(f);
    dialogState.openPath = f;
    const nh = await call('officials:importPreview');
    expect(nh.ok === false && nh.error.code).toBe('VALIDATION');
  });
});
