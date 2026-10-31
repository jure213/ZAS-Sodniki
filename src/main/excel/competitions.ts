// D5: list of competitions.
import { formatDate } from '@shared/dates';
import { STATUS_LABELS } from '@shared/labels';
import type { Competition } from '@shared/types';
import type { Workbook } from './common';
import { addListHeader, newSheet, THIN_BORDER } from './common';

export function buildCompetitions(competitions: Competition[]): Workbook {
  const { workbook, sheet } = newSheet('Tekmovanja');
  addListHeader(sheet, 'Seznam tekmovanj', ['Ime', 'Datum', 'Lokacija', 'Status', 'Opombe']);

  for (const c of competitions) {
    const row = sheet.addRow([c.name, formatDate(c.date), c.location, STATUS_LABELS[c.status] ?? c.status, c.notes]);
    row.eachCell((cell, col) => {
      cell.border = THIN_BORDER;
      if (col === 2 || col === 4) cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  }

  sheet.columns = [{ width: 40 }, { width: 12 }, { width: 25 }, { width: 15 }, { width: 40 }];
  return workbook;
}
