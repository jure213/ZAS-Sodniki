// D4: list of officials.
import type { Official } from '@shared/types';
import type { Workbook } from './common';
import { addListHeader, newSheet, THIN_BORDER } from './common';

export function buildOfficials(officials: Official[]): Workbook {
  const { workbook, sheet } = newSheet('Sodniki');
  addListHeader(sheet, 'Seznam sodnikov', ['Ime', 'Email', 'Telefon', 'Rang', 'Dodatni izpiti', 'Status', 'Opombe']);

  for (const o of officials) {
    const row = sheet.addRow([
      o.name,
      o.email,
      o.phone,
      o.rank,
      o.additional_exams,
      o.active ? 'Aktiven' : 'Neaktiven',
      o.notes,
    ]);
    row.eachCell((cell, col) => {
      cell.border = THIN_BORDER;
      if (col !== 1 && col !== 2 && col !== 7) cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  }

  sheet.columns = [
    { width: 25 }, // Ime
    { width: 30 }, // Email
    { width: 15 }, // Telefon
    { width: 10 }, // Rang
    { width: 20 }, // Dodatni izpiti
    { width: 12 }, // Status
    { width: 40 }, // Opombe
  ];
  return workbook;
}
