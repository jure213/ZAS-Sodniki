// D3: preview of what will be paid for a competition, before payments exist.
// Follows the selected tariff (v1 always showed the sodnik tariff).
import { formatDate } from '@shared/dates';
import type { Assignment } from '@shared/types';
import type { Tariff } from '@shared/tariff';
import type { Workbook } from './common';
import { buildReportTable, eur } from './common';

export type PreviewData = {
  competition: { name: string; date: string };
  tariff: Tariff;
  assignments: Assignment[];
};

export function buildPreview(data: PreviewData): Workbook {
  let grand = 0;
  const rows = data.assignments.map((a) => {
    const base = data.tariff === 'racun' ? a.base_racun_cents : a.base_sodnik_cents;
    const total = data.tariff === 'racun' ? a.total_racun_cents : a.total_sodnik_cents;
    grand += total;
    return {
      sodnik: a.official_name,
      vloga: a.role_name,
      ure: a.hours,
      km: a.kilometers,
      postavka: eur(base),
      potni: eur(a.travel_cents),
      skupaj: eur(total),
    };
  });
  return buildReportTable('Predogled', {
    title: `${data.competition.name} - ${formatDate(data.competition.date)} - PREDOGLED`,
    headers: ['SODNIK', 'VLOGA', 'URE', 'KM', 'POSTAVKA (€)', 'POTNI STROŠKI (€)', 'SKUPAJ (€)'],
    columns: [
      { key: 'sodnik', width: 25 },
      { key: 'vloga', width: 20 },
      { key: 'ure', width: 8 },
      { key: 'km', width: 8 },
      { key: 'postavka', width: 12 },
      { key: 'potni', width: 15 },
      { key: 'skupaj', width: 12 },
    ],
    rows,
    total: { sodnik: '', vloga: '', ure: '', km: '', postavka: '', potni: 'SKUPAJ:', skupaj: eur(grand) },
    moneyColumns: [5, 6, 7],
    totalColumn: 7,
  });
}
