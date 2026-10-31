import type { Official, OfficialHistoryRow } from '@shared/types';
import type { officialSchema } from '@shared/schemas';
import type { z } from 'zod';
import { db, unwrap } from './client';
import { compStatus, cents, num, paymentSummary, text, type Row } from './rows';

const COLS = 'id, name, email, phone, rank, additional_exams, notes, active';
export type OfficialInput = z.output<typeof officialSchema>;

const toOfficial = (r: Row): Official => ({
  id: Number(r.id),
  name: text(r.name),
  email: text(r.email),
  phone: text(r.phone),
  rank: text(r.rank),
  additional_exams: text(r.additional_exams),
  notes: text(r.notes),
  active: r.active === true,
});

export async function listOfficials(): Promise<Official[]> {
  const rows = unwrap(await db.rest.from('officials').select(COLS).order('name').order('id'));
  return (rows as Row[]).map(toOfficial);
}

export async function createOfficial(input: OfficialInput): Promise<Official> {
  return toOfficial(unwrap(await db.rest.from('officials').insert(input).select(COLS).single()));
}

/** Inserts all rows in ONE request, so either every row is stored or none. */
export async function insertOfficials(rows: Partial<OfficialInput>[]): Promise<number> {
  if (rows.length === 0) return 0;
  const inserted = unwrap(await db.rest.from('officials').insert(rows).select('id'));
  return (inserted as Row[]).length;
}

export async function updateOfficial(id: number, input: OfficialInput): Promise<Official> {
  return toOfficial(unwrap(await db.rest.from('officials').update(input).eq('id', id).select(COLS).single()));
}

export async function setOfficialActive(id: number, active: boolean): Promise<void> {
  unwrap(await db.rest.from('officials').update({ active }).eq('id', id));
}

/** Fails with IN_USE (foreign key) while the official still has assignments or payments. */
export async function deleteOfficial(id: number): Promise<void> {
  unwrap(await db.rest.from('officials').delete().eq('id', id));
}

export async function officialHistory(officialId: number): Promise<OfficialHistoryRow[]> {
  const rows = unwrap(
    await db.rest
      .from('assignment_details')
      .select(
        'id, competition_id, competition_name, competition_date, competition_status, role_name, discipline_name, hours, kilometers, znesek_sodnik, znesek_racun, payment_id, payment_tariff, amount_due, paid_total, remaining, payment_status',
      )
      .eq('official_id', officialId)
      .order('competition_date', { ascending: false })
      .order('id', { ascending: false }),
  ) as Row[];
  return rows.map((r) => ({
    assignment_id: Number(r.id),
    competition_id: Number(r.competition_id),
    competition_name: text(r.competition_name),
    competition_date: text(r.competition_date),
    competition_status: compStatus(r.competition_status),
    role_name: text(r.role_name),
    discipline_name: r.discipline_name ?? null,
    hours: num(r.hours),
    kilometers: num(r.kilometers),
    total_sodnik_cents: cents(r.znesek_sodnik),
    total_racun_cents: cents(r.znesek_racun),
    payment: paymentSummary(r, { id: 'payment_id', tariff: 'payment_tariff', status: 'payment_status' }),
  }));
}
