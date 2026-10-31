// Assignments (competition_officials). The tariff snapshot (base amounts and
// travel rate) is computed here with shared/tariff for NEW or CHANGED rows and
// stored; the database derives the totals (generated columns) and is the
// authority for everything money-related afterwards.
import type { z } from 'zod';
import type { assignmentSaveInput, assignmentBulkItem } from '@shared/schemas';
import { centsToEuros } from '@shared/money';
import { computeAssignment, isUnpaidStatus, type CompetitionStatus, type RoleRates } from '@shared/tariff';
import type { Assignment, AssignmentAmounts } from '@shared/types';
import { AppError } from '../ipc/errors';
import { db, unwrap } from './client';
import { getConfig, listRoles, roleRates } from './config.repo';
import { getCompetition } from './competitions.repo';
import { cents, num, paymentSummary, text, type Row } from './rows';

export type AssignmentSaveInput = z.output<typeof assignmentSaveInput>;
export type AssignmentBulkItem = z.output<typeof assignmentBulkItem>;

const toAssignment = (r: Row): Assignment => ({
  id: Number(r.id),
  competition_id: Number(r.competition_id),
  official_id: Number(r.official_id),
  official_name: text(r.official_name),
  official_rank: text(r.official_rank),
  role_id: Number(r.role_id),
  role_name: text(r.role_name),
  role_archived: r.role_archived === true,
  discipline_id: r.discipline_id == null ? null : Number(r.discipline_id),
  discipline_name: r.discipline_name ?? null,
  hours: num(r.hours),
  kilometers: num(r.kilometers),
  notes: text(r.notes),
  travel_rate: num(r.travel_rate),
  base_sodnik_cents: cents(r.base_sodnik),
  base_racun_cents: cents(r.base_racun),
  travel_cents: cents(r.travel_amount),
  total_sodnik_cents: cents(r.znesek_sodnik),
  total_racun_cents: cents(r.znesek_racun),
  payment: paymentSummary(r, { id: 'payment_id', tariff: 'payment_tariff', status: 'payment_status' }),
});

export async function listAssignments(competitionId: number): Promise<Assignment[]> {
  const rows = unwrap(
    await db.rest.from('assignment_details').select('*').eq('competition_id', competitionId).order('id'),
  );
  return (rows as Row[]).map(toAssignment);
}

async function getAssignment(id: number): Promise<Assignment> {
  return toAssignment(unwrap(await db.rest.from('assignment_details').select('*').eq('id', id).single()));
}

// --- Tariff computation ---------------------------------------------------

type Context = {
  status: CompetitionStatus;
  /** EUR/km that new snapshots get (0 for competitions that pay nothing). */
  travelRate: number;
  roles: Map<number, RoleRates>;
};

async function loadContext(competitionId: number): Promise<Context> {
  const [competition, config, roles] = await Promise.all([getCompetition(competitionId), getConfig(), listRoles()]);
  return {
    status: competition.status,
    travelRate: isUnpaidStatus(competition.status) ? 0 : config.travel_cost_per_km,
    roles: new Map(roles.map((r) => [r.id, roleRates(r)])),
  };
}

function amountsFor(ctx: Context, roleId: number, hours: number, kilometers: number): AssignmentAmounts {
  const role = ctx.roles.get(roleId);
  if (!role) throw new AppError('VALIDATION', 'Vloga ne obstaja.');
  const a = computeAssignment({ role, hours, kilometers, travelRate: ctx.travelRate, status: ctx.status });
  return {
    travel_rate: ctx.travelRate,
    base_sodnik_cents: a.baseSodnik,
    base_racun_cents: a.baseRacun,
    travel_cents: a.travel,
    total_sodnik_cents: a.totalSodnik,
    total_racun_cents: a.totalRacun,
  };
}

/** Live preview for a draft assignment. Stores nothing. */
export async function previewAssignment(input: {
  competition_id: number;
  role_id: number;
  hours: number;
  kilometers: number;
}): Promise<AssignmentAmounts> {
  const ctx = await loadContext(input.competition_id);
  return amountsFor(ctx, input.role_id, input.hours, input.kilometers);
}

// --- Writes ---------------------------------------------------------------

const euros = (c: number) => centsToEuros(c);

export async function saveAssignment(input: AssignmentSaveInput): Promise<Assignment> {
  const ctx = await loadContext(input.competition_id);
  const auto = amountsFor(ctx, input.role_id, input.hours, input.kilometers);

  const base = db.rest.from('competition_officials').select('*');
  const existingRows = unwrap(
    await (input.id
      ? base.eq('id', input.id)
      : base.eq('competition_id', input.competition_id).eq('official_id', input.official_id)),
  ) as Row[];
  const existing = existingRows[0];
  if (input.id && !existing) throw new AppError('VALIDATION', 'Dodelitev ne obstaja.');
  if (
    existing &&
    (Number(existing.competition_id) !== input.competition_id || Number(existing.official_id) !== input.official_id)
  ) {
    throw new AppError('VALIDATION', 'Dodelitve ni mogoče prestaviti na drugega sodnika ali tekmovanje.');
  }

  // Keep the stored snapshot unless something it depends on changed.
  const recompute =
    input.recalculate || !existing || Number(existing.role_id) !== input.role_id || num(existing.hours) !== input.hours;
  const baseSodnik = input.base_sodnik_cents ?? (recompute ? auto.base_sodnik_cents : cents(existing!.base_sodnik));
  const baseRacun = input.base_racun_cents ?? (recompute ? auto.base_racun_cents : cents(existing!.base_racun));
  const travelRate = recompute ? auto.travel_rate : num(existing!.travel_rate);

  const fields = {
    role_id: input.role_id,
    discipline_id: input.discipline_id,
    hours: input.hours,
    kilometers: input.kilometers,
    notes: input.notes,
    base_sodnik: euros(baseSodnik),
    base_racun: euros(baseRacun),
    travel_rate: travelRate,
  };

  if (existing) {
    unwrap(await db.rest.from('competition_officials').update(fields).eq('id', existing.id));
    return getAssignment(Number(existing.id));
  }
  const created = unwrap(
    await db.rest
      .from('competition_officials')
      .insert({ competition_id: input.competition_id, official_id: input.official_id, ...fields })
      .select('id')
      .single(),
  ) as Row;
  return getAssignment(Number(created.id));
}

/** Adds many officials at once in one request (all or none). Officials already assigned are skipped. */
export async function bulkAddAssignments(
  competitionId: number,
  items: AssignmentBulkItem[],
): Promise<{ added: number; skipped_official_ids: number[] }> {
  const ctx = await loadContext(competitionId);
  const taken = new Set(
    (
      unwrap(
        await db.rest.from('competition_officials').select('official_id').eq('competition_id', competitionId),
      ) as Row[]
    ).map((r) => Number(r.official_id)),
  );

  const skipped: number[] = [];
  const rows: Row[] = [];
  for (const item of items) {
    if (taken.has(item.official_id)) {
      skipped.push(item.official_id);
      continue;
    }
    taken.add(item.official_id);
    const a = amountsFor(ctx, item.role_id, item.hours, item.kilometers);
    rows.push({
      competition_id: competitionId,
      official_id: item.official_id,
      role_id: item.role_id,
      discipline_id: item.discipline_id,
      hours: item.hours,
      kilometers: item.kilometers,
      notes: item.notes,
      base_sodnik: euros(a.base_sodnik_cents),
      base_racun: euros(a.base_racun_cents),
      travel_rate: a.travel_rate,
    });
  }
  if (rows.length > 0) unwrap(await db.rest.from('competition_officials').insert(rows));
  return { added: rows.length, skipped_official_ids: skipped };
}

/**
 * Recomputes the snapshot of every assignment of a competition that has no
 * payment yet (e.g. after its status changed from free to completed).
 */
export async function recalculateCompetition(competitionId: number): Promise<number> {
  const ctx = await loadContext(competitionId);
  const list = (await listAssignments(competitionId)).filter((a) => a.payment === null);
  for (const a of list) {
    const r = amountsFor(ctx, a.role_id, a.hours, a.kilometers);
    unwrap(
      await db.rest
        .from('competition_officials')
        .update({
          base_sodnik: euros(r.base_sodnik_cents),
          base_racun: euros(r.base_racun_cents),
          travel_rate: r.travel_rate,
        })
        .eq('id', a.id),
    );
  }
  return list.length;
}

/** Fails with IN_USE once a payment exists for the assignment. */
export async function deleteAssignment(id: number): Promise<void> {
  unwrap(await db.rest.from('competition_officials').delete().eq('id', id));
}
