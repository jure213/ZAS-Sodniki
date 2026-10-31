import { describe, expect, it } from 'vitest';
import type { Assignment, PaymentRow } from '@shared/types';
import { buildCompetitionReport } from './competitionReport';
import { buildCompetitions } from './competitions';
import { competitionReportName, paymentsName, previewName, summaryName } from './fileNames';
import { buildOfficials } from './officials';
import { buildPayments } from './payments';
import { buildPreview } from './preview';
import { buildSummary } from './summary';

const THIN = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

describe('D1 competition report', () => {
  const wb = buildCompetitionReport({
    competition: { name: 'Test Meet', date: '2025-03-07' },
    rows: [
      { name: 'Ana', rank: '2', role: 'Sodnik', discipline: 'Daljina', hours: 4, base_cents: 2500, travel_cents: 1850, total_cents: 4350 },
      { name: 'Boris', rank: '', role: 'Sodnik', discipline: '', hours: 6.5, base_cents: 3000, travel_cents: 0, total_cents: 3000 },
    ],
  });
  const ws = wb.getWorksheet('Izpis');

  it('has the v1 layout', () => {
    expect(ws.getCell('A1').value).toBe('Test Meet - 07.03.2025');
    expect((ws.model as unknown as { merges: string[] }).merges).toEqual(['A1:H1']);
    expect(ws.getRow(1).height).toBe(25);
    expect(ws.getCell('A1').font).toMatchObject({ bold: true, size: 14 });
    expect(ws.getRow(2).values).toEqual([
      undefined, 'IME', 'RANG', 'VLOGA', 'DISCIPLINA', 'URE', 'ZNESEK (€)', 'POTNI STROŠKI (€)', 'SKUPAJ (€)',
    ]);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((c) => ws.getColumn(c).width)).toEqual([25, 8, 15, 15, 8, 12, 15, 12]);
  });

  it('writes amounts as numbers with a money format and a bold SKUPAJ row directly under the data', () => {
    expect(ws.getRow(3).values).toEqual([undefined, 'Ana', 2, 'Sodnik', 'Daljina', 4, 25, 18.5, 43.5]);
    expect(ws.getRow(4).getCell(2).value).toBe(0);
    expect(ws.getCell('F3').numFmt).toBe('#,##0.00');
    const total = ws.getRow(5);
    expect(total.getCell(7).value).toBe('SKUPAJ:');
    expect(total.getCell(8).value).toBe(73.5);
    expect(total.getCell(8).font).toMatchObject({ bold: true });
    expect(total.getCell(8).border).toMatchObject(THIN);
    expect(total.getCell(1).border).toBeUndefined(); // empty summary cells carry no border
    expect(ws.getCell('C3').alignment).toMatchObject({ horizontal: 'center', vertical: 'middle' });
  });
});

describe('D2 summary / D4 / D5', () => {
  it('summary rows and totals', () => {
    const ws = buildSummary([
      { id: 1, name: 'A', date: '2025-01-02', location: 'X', officials_cents: 1000, travel_cents: 250, total_cents: 1250 },
      { id: 2, name: 'B', date: '2025-02-03', location: '', officials_cents: 500, travel_cents: 0, total_cents: 500 },
    ]).getWorksheet('Pregled');
    expect(ws.getCell('A1').value).toBe('PREGLED TEKEM');
    expect((ws.model as unknown as { merges: string[] }).merges).toEqual(['A1:F1']);
    expect(ws.getRow(3).values).toEqual([undefined, 'A', '02.01.2025', 'X', 10, 2.5, 12.5]);
    expect(ws.getRow(5).getCell(6).value).toBe(17.5);
  });

  it('officials list keeps the grey header and status text', () => {
    const ws = buildOfficials([
      { id: 1, name: 'Ana', email: 'a@x.si', phone: '1', rank: '2', additional_exams: '', notes: '', active: true },
      { id: 2, name: 'Boris', email: '', phone: '', rank: '', additional_exams: '', notes: 'n', active: false },
    ]).getWorksheet('Sodniki');
    expect(ws.getCell('A1').value).toBe('Seznam sodnikov');
    expect(ws.getRow(2).hasValues).toBe(false);
    expect(ws.getCell('A3').fill).toMatchObject({ type: 'pattern', fgColor: { argb: 'FFE0E0E0' } });
    expect(ws.getRow(4).getCell(6).value).toBe('Aktiven');
    expect(ws.getRow(5).getCell(6).value).toBe('Neaktiven');
    expect(ws.getColumn(7).width).toBe(40);
  });

  it('competitions list uses Slovenian status labels and dd.mm.yyyy dates', () => {
    const ws = buildCompetitions([
      { id: 1, name: 'A', date: '2025-07-01', location: 'L', status: 'other_zas', notes: '' },
    ]).getWorksheet('Tekmovanja');
    expect(ws.getRow(4).values).toEqual([undefined, 'A', '01.07.2025', 'L', 'Plača drug ZAS', '']);
  });
});

describe('D3 preview follows the selected tariff', () => {
  const a = {
    official_name: 'Ana', role_name: 'Sodnik', hours: 4, kilometers: 10, travel_cents: 370,
    base_sodnik_cents: 2000, total_sodnik_cents: 2370, base_racun_cents: 3000, total_racun_cents: 3370,
  } as Assignment;
  const rowFor = (tariff: 'sodnik' | 'racun') =>
    buildPreview({ competition: { name: 'C', date: '2025-01-01' }, tariff, assignments: [a] })
      .getWorksheet('Predogled')
      .getRow(3).values;

  it('uses sodnik or racun amounts', () => {
    expect(rowFor('sodnik')).toEqual([undefined, 'Ana', 'Sodnik', 4, 10, 20, 3.7, 23.7]);
    expect(rowFor('racun')).toEqual([undefined, 'Ana', 'Sodnik', 4, 10, 30, 3.7, 33.7]);
  });
});

describe('D6 payments', () => {
  const p = (over: Partial<PaymentRow>): PaymentRow => ({
    id: 1, assignment_id: 1, official_id: 1, official_name: 'Ana', competition_id: 1, competition_name: 'C',
    competition_date: '2025-05-01', competition_status: 'completed', tariff: 'sodnik', amount_due_cents: 10000,
    paid_cents: 0, remaining_cents: 10000, status: 'owed', last_paid_on: null, installments: 0, notes: '', ...over,
  });
  const ws = buildPayments([
    p({}),
    p({ id: 2, paid_cents: 4000, remaining_cents: 6000, status: 'partial', last_paid_on: '2025-06-02', installments: 1 }),
    p({ id: 3, paid_cents: 10000, remaining_cents: 0, status: 'paid', last_paid_on: '2025-06-03', installments: 1 }),
  ]).getWorksheet('Izplačila');

  it('shows due, paid and remaining with their totals', () => {
    expect(ws.getRow(2).getCell(3).value).toBe('ZNESEK (€)');
    expect(ws.getRow(4).values).toEqual([undefined, 'Ana', 'C', 100, 40, 60, 'Delno plačano', '01.05.2025', '02.06.2025']);
    expect(ws.getRow(3).getCell(8).value).toBe('-');
    const summary = ws.getRow(ws.rowCount);
    expect([summary.getCell(1).value, summary.getCell(3).value, summary.getCell(4).value, summary.getCell(5).value]).toEqual([
      'SKUPAJ', 300, 140, 160,
    ]);
    expect(ws.getRow(ws.rowCount - 1).hasValues).toBe(false);
  });
});

describe('default file names (as in v1)', () => {
  it('matches the v1 patterns', () => {
    const c = { name: 'AZS - Ekipno, Celje!', date: '2025-03-07' };
    expect(competitionReportName(c, 'sodnik')).toBe('Tekma_AZS___Ekipno__Celje__07-03-2025_sodniki.xlsx');
    expect(competitionReportName(c, 'racun')).toBe('Tekma_AZS___Ekipno__Celje__07-03-2025_racun.xlsx');
    expect(previewName(c)).toBe('Predogled_AZS___Ekipno__Celje__07-03-2025.xlsx');
    expect(summaryName('racun', '2025-10-31')).toBe('Pregled_tekem_2025-10-31_racun.xlsx');
    expect(paymentsName('2025-10-31')).toBe('Izplacila_2025-10-31.xlsx');
  });
});
