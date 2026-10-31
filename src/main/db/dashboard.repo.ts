import type { DashboardStats, OwedByOfficial } from '@shared/types';
import { db, unwrap } from './client';
import { cents, num, text, type Row } from './rows';

export async function dashboardStats(year?: number): Promise<DashboardStats> {
  const r = unwrap(await db.rest.rpc('dashboard_stats', year === undefined ? {} : { for_year: year })) as Row;
  return {
    year: num(r.year),
    total_officials: num(r.total_officials),
    active_competitions: num(r.active_competitions),
    paid_cents: cents(r.paid_payments),
    owed_cents: cents(r.owed_payments),
    total_cents: cents(r.total_payments),
  };
}

/** Everything still owed, grouped by official id (names can repeat), largest first. */
export async function owedByOfficial(): Promise<OwedByOfficial[]> {
  const rows = unwrap(
    await db.rest.from('payment_balances').select('official_id, official_name, remaining').gt('remaining', 0),
  ) as Row[];
  const byId = new Map<number, OwedByOfficial>();
  for (const r of rows) {
    const id = Number(r.official_id);
    const entry = byId.get(id) ?? { official_id: id, official_name: text(r.official_name), payments: 0, owed_cents: 0 };
    entry.payments += 1;
    entry.owed_cents += cents(r.remaining);
    byId.set(id, entry);
  }
  return [...byId.values()].sort((a, b) => b.owed_cents - a.owed_cents || a.official_id - b.official_id);
}
