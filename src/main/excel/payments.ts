// D6: payments with amount due, paid and remaining (v1 showed a single
// overwritten amount, method and payment date).
import { formatDate } from '@shared/dates';
import type { PaymentRow, PaymentStatus } from '@shared/types';
import type { Workbook } from './common';
import { addTitle, eur, MONEY_FMT, newSheet, THIN_BORDER } from './common';

const STATUS_TEXT: Record<PaymentStatus, string> = {
  paid: 'Plačano',
  partial: 'Delno plačano',
  owed: 'Ni plačano',
};

const COLUMNS = 8;

export function buildPayments(payments: PaymentRow[]): Workbook {
  const { workbook, sheet } = newSheet('Izplačila');
  addTitle(sheet, 'PREGLED IZPLAČIL', COLUMNS);

  const header = sheet.addRow([
    'SODNIK',
    'TEKMOVANJE',
    'ZNESEK (€)',
    'PLAČANO (€)',
    'OSTANE (€)',
    'STATUS',
    'DATUM TEKMOVANJA',
    'ZADNJE PLAČILO',
  ]);
  header.font = { bold: true };
  header.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.columns = [
    { key: 'official', width: 25 },
    { key: 'competition', width: 30 },
    { key: 'due', width: 14 },
    { key: 'paid', width: 14 },
    { key: 'remaining', width: 14 },
    { key: 'status', width: 15 },
    { key: 'date', width: 18 },
    { key: 'lastPaid', width: 18 },
  ];

  let due = 0;
  let paid = 0;
  let remaining = 0;
  for (const p of payments) {
    due += p.amount_due_cents;
    paid += p.paid_cents;
    remaining += p.remaining_cents;
    const row = sheet.addRow({
      official: p.official_name,
      competition: p.competition_name,
      due: eur(p.amount_due_cents),
      paid: eur(p.paid_cents),
      remaining: eur(p.remaining_cents),
      status: STATUS_TEXT[p.status],
      date: formatDate(p.competition_date) || '-',
      lastPaid: formatDate(p.last_paid_on) || '-',
    });
    for (const col of [3, 4, 5]) row.getCell(col).numFmt = MONEY_FMT;
  }

  sheet.addRow([]);
  const summary = sheet.addRow({
    official: 'SKUPAJ',
    competition: '',
    due: eur(due),
    paid: eur(paid),
    remaining: eur(remaining),
    status: '',
    date: '',
    lastPaid: '',
  });
  summary.font = { bold: true };
  for (const col of [3, 4, 5]) summary.getCell(col).numFmt = MONEY_FMT;

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = THIN_BORDER;
    });
  });
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 2) {
      for (const col of [3, 4, 5, 6, 7, 8]) {
        row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }
  });
  return workbook;
}
