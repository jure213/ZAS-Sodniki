// Read-only: the numbers must equal the M0 baseline / migration report
// (owed 1518.42; paid in 2025 under the new installment semantics 2689.02).
// Requires the unmodified prod-copy stack; runs first (alphabetical order).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { call, ok, setup } from './harness';

beforeAll(setup);

describe('dashboard numbers', () => {
  it('stats for 2025: paid by installment date, owed = everything remaining', async () => {
    const s = await ok('dashboard:stats', { year: 2025 });
    expect(s.year).toBe(2025);
    expect(s.owed_cents).toBe(151842);
    expect(s.paid_cents).toBe(268902);
    expect(s.total_cents).toBe(151842 + 268902);
    expect(s.total_officials).toBe(125);
    expect(s.active_competitions).toBe(36);
  });

  it('stats for 2026 has nothing paid and the same owed amount', async () => {
    const s = await ok('dashboard:stats', { year: 2026 });
    expect(s.paid_cents).toBe(0);
    expect(s.owed_cents).toBe(151842);
  });

  it('stats without a year defaults to the current year', async () => {
    const s = await ok('dashboard:stats');
    expect(s.year).toBe(new Date().getFullYear());
  });

  it('owed per official equals the baseline for every official', async () => {
    const owed = await ok('dashboard:owedByOfficial');
    const baseline = readFileSync(resolve(__dirname, '../../parity/baseline/owed_by_official.csv'), 'utf8')
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((l) => l.split(','))
      .map(([id, payments, euros]) => ({ id: Number(id), payments: Number(payments), cents: Math.round(Number(euros) * 100) }));

    expect(owed.length).toBe(baseline.length);
    for (const b of baseline) {
      const row = owed.find((o) => o.official_id === b.id);
      expect(row, `official ${b.id}`).toBeDefined();
      expect(row!.owed_cents).toBe(b.cents);
      expect(row!.payments).toBe(b.payments);
    }
    expect(owed.reduce((s, o) => s + o.owed_cents, 0)).toBe(151842);
    // Grouped by id, largest first.
    for (let i = 1; i < owed.length; i++) expect(owed[i - 1].owed_cents).toBeGreaterThanOrEqual(owed[i].owed_cents);
  });

  it('rejects an invalid year with a validation error', async () => {
    const res = await call('dashboard:stats', { year: 1 });
    expect(res.ok).toBe(false);
  });
});
