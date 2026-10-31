// D2: one row per competition with the officials total, travel and grand total.
import { formatDate } from '@shared/dates';
import type { CompetitionSummaryRow } from '@shared/types';
import type { Workbook } from './common';
import { buildReportTable, eur } from './common';

export function buildSummary(rows: CompetitionSummaryRow[]): Workbook {
  let grand = 0;
  const dataRows = rows.map((r) => {
    grand += r.total_cents;
    return {
      name: r.name,
      date: formatDate(r.date),
      location: r.location,
      officials: eur(r.officials_cents),
      travel: eur(r.travel_cents),
      total: eur(r.total_cents),
    };
  });
  return buildReportTable('Pregled', {
    title: 'PREGLED TEKEM',
    headers: ['TEKMA', 'DATUM', 'LOKACIJA', 'SODNIKI (€)', 'POTNI STROŠKI (€)', 'SKUPAJ (€)'],
    columns: [
      { key: 'name', width: 35 },
      { key: 'date', width: 12 },
      { key: 'location', width: 20 },
      { key: 'officials', width: 15 },
      { key: 'travel', width: 15 },
      { key: 'total', width: 15 },
    ],
    rows: dataRows,
    total: { name: '', date: '', location: '', officials: '', travel: 'SKUPAJ:', total: eur(grand) },
    moneyColumns: [4, 5, 6],
    totalColumn: 6,
  });
}
