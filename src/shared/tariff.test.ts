import { describe, expect, it } from 'vitest';
import {
  baseRacunCents,
  baseSodnikCents,
  computeAssignment,
  findTier,
  type RoleRates,
  type Tier,
} from './tariff';

const tiers: Tier[] = [
  { from: 0, to: 2, rate: 20 },
  { from: 2, to: 4, rate: 35.5 },
  { from: 4, to: null, rate: 50 },
];
const legacyTiers: Tier[] = [
  { from: 0, to: 2, rate: 20 },
  { from: 2, to: 999, rate: 40 },
];
const invoiceTiers: Tier[] = [
  { from: 0, to: 3, rate: 30 },
  { from: 3, to: null, rate: 60 },
];

describe('tier matching', () => {
  it('matches hours > from && hours <= to', () => {
    expect(findTier(tiers, 1)?.rate).toBe(20);
    expect(findTier(tiers, 2)?.rate).toBe(20); // exactly on boundary belongs to the lower tier
    expect(findTier(tiers, 2.01)?.rate).toBe(35.5);
    expect(findTier(tiers, 4)?.rate).toBe(35.5);
    expect(findTier(tiers, 4.5)?.rate).toBe(50);
  });
  it('treats legacy 999 and null as infinity', () => {
    expect(findTier(legacyTiers, 500)?.rate).toBe(40);
    expect(findTier(tiers, 5000)?.rate).toBe(50);
  });
  it('hours 0 matches nothing when the first tier starts at 0', () => {
    expect(findTier(tiers, 0)).toBeUndefined();
    expect(baseSodnikCents({ rates: tiers }, 0)).toBe(0);
  });
  it('no match yields 0', () => {
    expect(baseSodnikCents({ rates: [{ from: 1, to: 2, rate: 10 }] }, 5)).toBe(0);
    expect(findTier([{ from: 1, to: 2, rate: 10 }], 1)).toBeUndefined();
  });
  it('picks the first matching tier in stored order', () => {
    const overlapping: Tier[] = [
      { from: 0, to: 10, rate: 11 },
      { from: 0, to: 10, rate: 22 },
    ];
    expect(findTier(overlapping, 3)?.rate).toBe(11);
  });
  it('tier amount is flat, not per hour', () => {
    expect(baseSodnikCents({ rates: tiers }, 3.5)).toBe(3550);
    expect(baseSodnikCents({ rates: tiers }, 3)).toBe(3550);
  });
});

describe('legacy hourlyRate', () => {
  it('uses hourlyRate x hours when no tiers', () => {
    expect(baseSodnikCents({ hourlyRate: 7.5 }, 3)).toBe(2250);
    expect(baseSodnikCents({ hourlyRate: 7.5, rates: [] }, 3)).toBe(2250);
    expect(baseSodnikCents({ hourlyRate: 0.333 }, 1.5)).toBe(50); // 0.4995 -> 0.50
  });
  it('is ignored when tiers exist (even without a match)', () => {
    expect(baseSodnikCents({ hourlyRate: 10, rates: [{ from: 5, to: 6, rate: 1 }] }, 2)).toBe(0);
  });
  it('0 / null hourlyRate gives 0; missing role gives 0', () => {
    expect(baseSodnikCents({ hourlyRate: 0 }, 3)).toBe(0);
    expect(baseSodnikCents({ hourlyRate: null }, 3)).toBe(0);
    expect(baseSodnikCents(undefined, 3)).toBe(0);
    expect(baseRacunCents(null, 3)).toBe(0);
  });
});

describe('račun tariff', () => {
  const role: RoleRates = { rates: tiers, invoiceRates: invoiceTiers };
  it('uses invoice tiers when present', () => {
    expect(baseRacunCents(role, 2)).toBe(3000);
    expect(baseRacunCents(role, 3.5)).toBe(6000);
  });
  it('invoice tiers present but no match -> 0 (no fallback)', () => {
    expect(baseRacunCents(role, 0)).toBe(0);
  });
  it('empty or missing invoice tiers fall back to sodnik tiers', () => {
    expect(baseRacunCents({ rates: tiers, invoiceRates: [] }, 3)).toBe(3550);
    expect(baseRacunCents({ rates: tiers, invoiceRates: null }, 3)).toBe(3550);
    expect(baseRacunCents({ rates: tiers }, 3)).toBe(3550);
  });
  it('falls back to hourlyRate when neither has tiers', () => {
    expect(baseRacunCents({ hourlyRate: 8, invoiceRates: [], rates: [] }, 2.5)).toBe(2000);
  });
});

describe('computeAssignment', () => {
  const role: RoleRates = { rates: tiers, invoiceRates: invoiceTiers };
  it('travel = km x rate rounded half-up; total = base + travel', () => {
    const r = computeAssignment({ role, hours: 3, kilometers: 12.5, travelRate: 0.37, status: 'completed' });
    expect(r.travel).toBe(463);
    expect(r.baseSodnik).toBe(3550);
    expect(r.baseRacun).toBe(3000);
    expect(r.totalSodnik).toBe(3550 + 463);
    expect(r.totalRacun).toBe(3000 + 463);
  });
  it('free and other_zas are 0 including travel', () => {
    for (const status of ['free', 'other_zas'] as const) {
      const r = computeAssignment({ role, hours: 3, kilometers: 100, travelRate: 0.37, status });
      expect(r).toEqual({ baseSodnik: 0, baseRacun: 0, travel: 0, totalSodnik: 0, totalRacun: 0 });
    }
  });
  it('planned and cancelled are computed normally (only free/other_zas zero out)', () => {
    for (const status of ['planned', 'cancelled'] as const) {
      expect(computeAssignment({ role, hours: 1, kilometers: 0, travelRate: 0.37, status }).totalSodnik).toBe(2000);
    }
  });
  it('zero hours still pays travel', () => {
    const r = computeAssignment({ role, hours: 0, kilometers: 10, travelRate: 0.37, status: 'completed' });
    expect(r.baseSodnik).toBe(0);
    expect(r.totalSodnik).toBe(370);
  });
  it('tolerates NaN-ish inputs like the old parseFloat(...) || 0', () => {
    const r = computeAssignment({ role, hours: NaN, kilometers: NaN, travelRate: 0.37, status: 'completed' });
    expect(r.totalSodnik).toBe(0);
  });
});
