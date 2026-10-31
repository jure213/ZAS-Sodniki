// Loads and shapes the data for the Excel builders from the repos. No layout
// and no Electron here; totals are plain sums of the amounts the database
// already computed.
import type { Tariff } from '@shared/tariff';
import type { CompetitionSummaryRow } from '@shared/types';
import { AppError } from '../ipc/errors';
import { listAssignments } from '../db/assignments.repo';
import { db, unwrap } from '../db/client';
import { getCompetition, listCompetitions } from '../db/competitions.repo';
import { cents, text, type Row } from '../db/rows';
import type { CompetitionReportData } from './competitionReport';
import type { PreviewData } from './preview';

export async function loadCompetitionReport(competitionId: number, tariff: Tariff): Promise<CompetitionReportData> {
  const [competition, assignments] = await Promise.all([getCompetition(competitionId), listAssignments(competitionId)]);
  if (assignments.length === 0) throw new AppError('VALIDATION', 'Ni podatkov za to tekmo');
  const racun = tariff === 'racun';
  return {
    competition,
    rows: assignments.map((a) => ({
      name: a.official_name || 'Neznano',
      rank: a.official_rank,
      role: a.role_name,
      discipline: a.discipline_name ?? '',
      hours: a.hours,
      base_cents: racun ? a.base_racun_cents : a.base_sodnik_cents,
      travel_cents: a.travel_cents,
      total_cents: racun ? a.total_racun_cents : a.total_sodnik_cents,
    })),
  };
}

export async function loadPreview(competitionId: number, tariff: Tariff): Promise<PreviewData> {
  const [competition, assignments] = await Promise.all([getCompetition(competitionId), listAssignments(competitionId)]);
  if (assignments.length === 0) throw new AppError('VALIDATION', 'Ni dodeljenih sodnikov');
  return { competition, tariff, assignments };
}

/** Per-competition totals for the selected competitions (those without assignments are left out). */
export async function loadSummary(competitionIds: number[], tariff: Tariff): Promise<CompetitionSummaryRow[]> {
  const wanted = new Set(competitionIds);
  const competitions = (await listCompetitions()).filter((c) => wanted.has(c.id));
  if (competitions.length === 0) throw new AppError('VALIDATION', 'Izbrane tekme niso bile najdene');

  const rows = unwrap(
    await db.rest
      .from('assignment_details')
      .select('competition_id, base_sodnik, base_racun, travel_amount, znesek_sodnik, znesek_racun')
      .in('competition_id', [...wanted]),
  ) as Row[];

  const totals = new Map<number, { officials: number; travel: number; total: number }>();
  for (const r of rows) {
    const id = Number(r.competition_id);
    const t = totals.get(id) ?? { officials: 0, travel: 0, total: 0 };
    t.officials += cents(tariff === 'racun' ? r.base_racun : r.base_sodnik);
    t.travel += cents(r.travel_amount);
    t.total += cents(tariff === 'racun' ? r.znesek_racun : r.znesek_sodnik);
    totals.set(id, t);
  }

  return competitions
    .filter((c) => totals.has(c.id))
    .map((c) => {
      const t = totals.get(c.id)!;
      return {
        id: c.id,
        name: c.name,
        date: text(c.date),
        location: c.location,
        officials_cents: t.officials,
        travel_cents: t.travel,
        total_cents: t.total,
      };
    });
}
