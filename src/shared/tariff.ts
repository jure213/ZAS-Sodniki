import { eurosToCents, mulToCents } from './money';

export type CompetitionStatus = 'planned' | 'completed' | 'cancelled' | 'free' | 'other_zas';
export type Tariff = 'sodnik' | 'racun';

/**
 * One tier: matches when hours > from && (to == null || hours <= to).
 * `to` null (or legacy 999) means no upper limit. The rate is a FLAT amount
 * for the whole assignment, not per hour.
 */
export type Tier = { from: number; to: number | null; rate: number };

/** Role as stored in settings (legacy JSON shape). */
export type RoleRates = {
  rates?: Tier[] | null;
  invoiceRates?: Tier[] | null;
  /** Legacy per-hour rate, used only when no tiers are defined. */
  hourlyRate?: number | null;
};

export const LEGACY_INFINITY = 999;

const hasTiers = (t: Tier[] | null | undefined): t is Tier[] => Array.isArray(t) && t.length > 0;

export function tierMatches(tier: Tier, hours: number): boolean {
  const unbounded = tier.to == null || tier.to === LEGACY_INFINITY;
  return hours > tier.from && (unbounded || hours <= (tier.to as number));
}

/** First matching tier in stored order, or undefined. */
export function findTier(tiers: Tier[], hours: number): Tier | undefined {
  return tiers.find((t) => tierMatches(t, hours));
}

function tiersOrHourly(
  tiers: Tier[] | null | undefined,
  hourlyRate: number | null | undefined,
  hours: number,
): number {
  if (hasTiers(tiers)) {
    const tier = findTier(tiers, hours);
    return tier ? eurosToCents(tier.rate) : 0;
  }
  if (hourlyRate) return mulToCents(hourlyRate, hours);
  return 0;
}

/** Base amount (cents), sodnik tariff: sodnik tiers, else legacy hourlyRate x hours. */
export function baseSodnikCents(role: RoleRates | null | undefined, hours: number): number {
  if (!role) return 0;
  return tiersOrHourly(role.rates, role.hourlyRate, hours);
}

/**
 * Base amount (cents), račun tariff: invoice tiers; if missing or empty falls
 * back to the sodnik tiers, then to hourlyRate x hours.
 */
export function baseRacunCents(role: RoleRates | null | undefined, hours: number): number {
  if (!role) return 0;
  if (hasTiers(role.invoiceRates)) return tiersOrHourly(role.invoiceRates, null, hours);
  return tiersOrHourly(role.rates, role.hourlyRate, hours);
}

/** Travel cost in cents: km x EUR/km rounded half-up to cents. */
export function travelCents(kilometers: number, ratePerKm: number): number {
  return mulToCents(kilometers || 0, ratePerKm || 0);
}

export type AssignmentInput = {
  role: RoleRates | null | undefined;
  hours: number;
  kilometers: number;
  travelRate: number;
  status: CompetitionStatus;
};

export type AssignmentAmounts = {
  baseSodnik: number;
  baseRacun: number;
  travel: number;
  totalSodnik: number;
  totalRacun: number;
};

export function isUnpaidStatus(status: CompetitionStatus): boolean {
  return status === 'free' || status === 'other_zas';
}

/** All amounts in cents. Free / other_zas competitions are 0 including travel. */
export function computeAssignment(input: AssignmentInput): AssignmentAmounts {
  if (isUnpaidStatus(input.status)) {
    return { baseSodnik: 0, baseRacun: 0, travel: 0, totalSodnik: 0, totalRacun: 0 };
  }
  const hours = Number(input.hours) || 0;
  const baseSodnik = baseSodnikCents(input.role, hours);
  const baseRacun = baseRacunCents(input.role, hours);
  const travel = travelCents(Number(input.kilometers) || 0, input.travelRate);
  return { baseSodnik, baseRacun, travel, totalSodnik: baseSodnik + travel, totalRacun: baseRacun + travel };
}
