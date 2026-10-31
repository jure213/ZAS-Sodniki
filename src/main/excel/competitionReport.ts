// D1: report of one competition (officials, base amount, travel, total).
import { formatDate } from '@shared/dates';
import type { Workbook } from './common';
import { buildReportTable, eur } from './common';

export type CompetitionReportRow = {
  name: string;
  rank: string;
  role: string;
  discipline: string;
  hours: number;
  base_cents: number;
  travel_cents: number;
  total_cents: number;
};

export type CompetitionReportData = {
  competition: { name: string; date: string };
  rows: CompetitionReportRow[];
};

export function buildCompetitionReport(data: CompetitionReportData): Workbook {
  let grand = 0;
  const rows = data.rows.map((r) => {
    grand += r.total_cents;
    return {
      name: r.name,
      rank: parseInt(r.rank, 10) || 0,
      role: r.role,
      discipline: r.discipline,
      hours: r.hours,
      amount: eur(r.base_cents),
      travelCost: eur(r.travel_cents),
      total: eur(r.total_cents),
    };
  });
  return buildReportTable('Izpis', {
    title: `${data.competition.name} - ${formatDate(data.competition.date)}`,
    headers: ['IME', 'RANG', 'VLOGA', 'DISCIPLINA', 'URE', 'ZNESEK (€)', 'POTNI STROŠKI (€)', 'SKUPAJ (€)'],
    columns: [
      { key: 'name', width: 25 },
      { key: 'rank', width: 8 },
      { key: 'role', width: 15 },
      { key: 'discipline', width: 15 },
      { key: 'hours', width: 8 },
      { key: 'amount', width: 12 },
      { key: 'travelCost', width: 15 },
      { key: 'total', width: 12 },
    ],
    rows,
    total: {
      name: '',
      rank: '',
      role: '',
      discipline: '',
      hours: '',
      amount: '',
      travelCost: 'SKUPAJ:',
      total: eur(grand),
    },
    moneyColumns: [6, 7, 8],
    totalColumn: 8,
  });
}
