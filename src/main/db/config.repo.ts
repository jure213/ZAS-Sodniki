// Roles with their tariff tiers, disciplines and the single app_config row.
import type { AppConfig, Discipline, Role, Usage } from '@shared/types';
import type { RoleRates, Tier } from '@shared/tariff';
import { db, unwrap } from './client';
import { method, num, text, type Row } from './rows';

// --- Roles ----------------------------------------------------------------

const ROLE_COLS = 'id, name, archived, position, role_rates(tariff, position, hours_from, hours_to, rate)';

function tiers(rates: Row[], tariff: string): Tier[] {
  return rates
    .filter((r) => r.tariff === tariff)
    .sort((a, b) => a.position - b.position)
    .map((r) => ({ from: num(r.hours_from), to: r.hours_to == null ? null : num(r.hours_to), rate: num(r.rate) }));
}

const toRole = (r: Row): Role => ({
  id: Number(r.id),
  name: text(r.name),
  archived: r.archived === true,
  position: num(r.position),
  rates: tiers(r.role_rates ?? [], 'sodnik'),
  invoiceRates: tiers(r.role_rates ?? [], 'racun'),
});

export async function listRoles(): Promise<Role[]> {
  const rows = unwrap(await db.rest.from('roles').select(ROLE_COLS).order('position').order('id'));
  return (rows as Row[]).map(toRole);
}

export async function getRole(id: number): Promise<Role> {
  return toRole(unwrap(await db.rest.from('roles').select(ROLE_COLS).eq('id', id).single()));
}

/** The shape shared/tariff.ts computes with. */
export const roleRates = (r: Role): RoleRates => ({ rates: r.rates, invoiceRates: r.invoiceRates });

export async function saveRole(input: {
  id?: number;
  name: string;
  rates: Tier[];
  invoiceRates: Tier[];
  archived: boolean;
}): Promise<number> {
  const asJson = (t: Tier[]) => t.map(({ from, to, rate }) => ({ from, to, rate }));
  const id = unwrap(
    await db.rest.rpc('save_role', {
      id: input.id ?? null,
      name: input.name,
      sodnik_rates: asJson(input.rates),
      racun_rates: asJson(input.invoiceRates),
      archived: input.archived,
    }),
  );
  return Number(id);
}

/** Deletes the role, or archives it when assignments still use it. */
export async function deleteRole(id: number): Promise<'deleted' | 'archived'> {
  return unwrap(await db.rest.rpc('delete_role', { id })) as 'deleted' | 'archived';
}

async function usage(column: 'role_id' | 'discipline_id', id: number): Promise<Usage> {
  const rows = unwrap(
    await db.rest
      .from('assignment_details')
      .select('id, competition_id, competition_name, official_id, official_name')
      .eq(column, id)
      .order('competition_date', { ascending: false })
      .order('id'),
  ) as Row[];
  return {
    count: rows.length,
    items: rows.map((r) => ({
      assignment_id: Number(r.id),
      competition_id: Number(r.competition_id),
      competition_name: text(r.competition_name),
      official_id: Number(r.official_id),
      official_name: text(r.official_name),
    })),
  };
}

export const roleUsage = (id: number) => usage('role_id', id);
export const disciplineUsage = (id: number) => usage('discipline_id', id);

// --- Disciplines -------------------------------------------------------------

const toDiscipline = (r: Row): Discipline => ({
  id: Number(r.id),
  name: text(r.name),
  archived: r.archived === true,
  position: num(r.position),
});

const DISC_COLS = 'id, name, archived, position';

export async function listDisciplines(): Promise<Discipline[]> {
  const rows = unwrap(await db.rest.from('disciplines').select(DISC_COLS).order('position').order('id'));
  return (rows as Row[]).map(toDiscipline);
}

export async function addDiscipline(name: string): Promise<Discipline> {
  return toDiscipline(unwrap(await db.rest.from('disciplines').insert({ name }).select(DISC_COLS).single()));
}

export async function updateDiscipline(id: number, patch: { name?: string; archived?: boolean }): Promise<Discipline> {
  return toDiscipline(
    unwrap(await db.rest.from('disciplines').update(patch).eq('id', id).select(DISC_COLS).single()),
  );
}

export async function deleteDiscipline(id: number): Promise<'deleted' | 'archived'> {
  return unwrap(await db.rest.rpc('delete_discipline', { id })) as 'deleted' | 'archived';
}

export async function reorderDisciplines(ids: number[]): Promise<void> {
  unwrap(await db.rest.rpc('reorder_disciplines', { ids }));
}

// --- app_config ------------------------------------------------------------------

const toConfig = (r: Row): AppConfig => ({
  travel_cost_per_km: num(r.travel_cost_per_km),
  default_payment_method: method(r.default_payment_method),
  min_client_version: r.min_client_version ?? null,
});

const CONFIG_COLS = 'travel_cost_per_km, default_payment_method, min_client_version';

export async function getConfig(): Promise<AppConfig> {
  return toConfig(unwrap(await db.rest.from('app_config').select(CONFIG_COLS).single()));
}

export async function updateConfig(patch: {
  travel_cost_per_km: number;
  default_payment_method: string;
}): Promise<AppConfig> {
  return toConfig(
    unwrap(await db.rest.from('app_config').update(patch).eq('id', true).select(CONFIG_COLS).single()),
  );
}

/** Danger zone: wipes officials, competitions, payments and all users but the caller. */
export async function clearAllData(): Promise<void> {
  unwrap(await db.rest.rpc('admin_clear_all_data'));
}
